import type { ActionItemPriority, ActionItemType } from '../../shared/contracts'

export interface ExtractedAction {
  title: string
  summary: string
  type: ActionItemType
  priority: ActionItemPriority
  excerpt: string
}

interface SectionRule {
  type: ActionItemType
  pattern: RegExp
}

const SECTION_RULES: SectionRule[] = [
  { type: 'task', pattern: /^top(?:\s+(?:three|\d+))?\s+actions?\s*:?\s*(.*)$/i },
  { type: 'decision', pattern: /^(?:decisions?|choices?)(?:\s+(?:still\s+)?needed|\s+required|\s+pending)?\s*:\s*(.*)$/i },
  { type: 'task', pattern: /^(?:action items?|actions? needed|next actions?|to[ -]?do|needs attention|items? needing attention|outstanding items?)\s*:\s*(.*)$/i },
  { type: 'followUp', pattern: /^(?:follow[ -]?ups?|waiting for|pending follow[ -]?ups?)\s*:\s*(.*)$/i },
  { type: 'risk', pattern: /^(?:risks?|alerts?|concerns?|watch items?)\s*:\s*(.*)$/i }
]

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'for', 'from',
  'has', 'have', 'if', 'in', 'is', 'it', 'may', 'of', 'on', 'or', 'should', 'still', 'that', 'the', 'this', 'to', 'was',
  'were', 'whether', 'will', 'with', 'today', 'recent', 'recently', 'needed', 'need', 'pending', 'decide', 'decision'
])

export function extractActionsFromOutput(output: string): ExtractedAction[] {
  const lines = output.replace(/\r/g, '').split('\n')
  const actions: ExtractedAction[] = []
  let activeType: ActionItemType | null = null

  for (const rawLine of lines) {
    const line = cleanLine(rawLine)
    if (!line) {
      continue
    }

    if (isCategoryCount(line)) {
      activeType = null
      continue
    }

    const section = SECTION_RULES.find((rule) => rule.pattern.test(line))
    if (section) {
      const inline = line.match(section.pattern)?.[1]?.trim() ?? ''
      activeType = inline ? null : section.type
      if (inline) for (const item of splitEnumeratedItems(inline)) actions.push(toAction(item, section.type, rawLine))
      continue
    }

    const checkbox = rawLine.match(/^\s*[-*]?\s*\[\s?\]\s+(.+)$/)
    if (checkbox?.[1]) {
      actions.push(toAction(checkbox[1], activeType ?? 'task', rawLine))
      continue
    }

    const explicit = line.match(/^(decision|action|follow[ -]?up|risk)\s*:\s*(.+)$/i)
    if (explicit?.[2]) {
      const label = explicit[1]!.toLocaleLowerCase()
      const type: ActionItemType = label.startsWith('follow') ? 'followUp' : label === 'decision' ? 'decision' : label === 'risk' ? 'risk' : 'task'
      actions.push(toAction(explicit[2], type, rawLine))
      continue
    }

    if (activeType && /^\s*(?:[-*•]|\d+[.)])\s+/.test(rawLine)) {
      actions.push(toAction(line, activeType, rawLine))
      continue
    }


    activeType = null
  }

  const unique = new Map<string, ExtractedAction>()
  for (const action of actions) {
    const key = normalizedActionKey(action.title)
    if (key && !unique.has(key)) unique.set(key, action)
  }
  return [...unique.values()].slice(0, 20)
}

export function inferManualAction(text: string): Pick<ExtractedAction, 'title' | 'summary' | 'type' | 'priority'> {
  const cleaned = cleanItem(text).slice(0, 2_000)
  const lowered = cleaned.toLocaleLowerCase()
  const type: ActionItemType = /\b(decide|decision|whether|approve|choose)\b/.test(lowered)
    ? 'decision'
    : /\b(waiting|follow[ -]?up|check back|awaiting)\b/.test(lowered)
      ? 'followUp'
      : /\b(risk|warning|security|legal|fraud|breach)\b/.test(lowered)
        ? 'risk'
        : 'task'
  const action = toAction(cleaned, type, cleaned)
  return { title: action.title, summary: action.summary, type, priority: action.priority }
}

export function normalizedActionKey(value: string): string {
  const tokens = value.toLocaleLowerCase()
    .replace(/[^a-z0-9@.]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map((token) => token.replace(/(?:ing|ed|es|s)$/i, ''))
  return [...new Set(tokens)].sort().join(' ').slice(0, 500)
}

export function isMalformedCapturedAction(title: string, summary: string): boolean {
  const combined = cleanItem(summary || title)
  return isCategoryCount(combined) || /^(?:decide whether\s+)?(?:urgent today|decision needed|quick reply|delegate\s*\/\s*follow[ -]?up|fyi\s*\/\s*archive)\s*:\s*\d+$/i.test(combined)
}

function splitEnumeratedItems(value: string): string[] {
  const normalized = value.replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '')
  const parts = normalized
    .split(/\s*;\s*|,\s+(?:and\s+)?(?=(?:whether|to|confirm|review|decide|submit|schedule|contact|ask|verify)\b)/i)
    .map(cleanItem)
    .filter((item) => item.length >= 6)
  return parts.length ? parts : cleanItem(normalized).length >= 6 ? [normalized] : []
}

function toAction(value: string, type: ActionItemType, excerpt: string): ExtractedAction {
  const summary = cleanItem(value).slice(0, 2_000)
  const baseTitle = summary.split(/(?<=[.!?])\s+/)[0]!.replace(/[.!]+$/, '').slice(0, 180)
  const title = type === 'decision' && !/^decide\b/i.test(baseTitle)
    ? `Decide ${/^whether\b/i.test(baseTitle) ? '' : 'whether '}${baseTitle}`
    : type === 'followUp' && !/^follow up\b/i.test(baseTitle)
      ? `Follow up: ${baseTitle}`
      : type === 'risk' && !/^(?:review|investigate|address)\b/i.test(baseTitle)
        ? `Review risk: ${baseTitle}`
        : capitalize(baseTitle)
  return { title: title.slice(0, 200), summary, type, priority: inferPriority(summary, type), excerpt: cleanItem(excerpt).slice(0, 1_000) }
}

function inferPriority(value: string, type: ActionItemType): ActionItemPriority {
  const lowered = value.toLocaleLowerCase()
  if (/\b(urgent|immediately|overdue|breach|fraud|compromised|today|final notice)\b/.test(lowered)) return 'urgent'
  if (type === 'risk' || /\b(security|legal|deadline|invoice|payment|billing|overdraft|collections|settlement|claim|account access|executive|client escalation)\b/.test(lowered)) return 'high'
  if (/\b(when convenient|optional|low priority|someday)\b/.test(lowered)) return 'low'
  return 'normal'
}

function cleanLine(value: string): string {
  return value.trim().replace(/^#{1,6}\s+/, '').replace(/^\*\*(.+)\*\*$/, '$1').replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()
}

function cleanItem(value: string): string {
  return cleanLine(value)
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/^\*+|\*+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isCategoryCount(value: string): boolean {
  return /^(?:[-*•]\s*)?(?:urgent today|decision needed|quick reply|delegate\s*\/\s*follow[ -]?up|fyi\s*\/\s*archive)\s*:\s*(?:\*\*)?\d+(?:\*\*)?$/i.test(value.trim())
}

function capitalize(value: string): string {
  return value ? `${value[0]!.toLocaleUpperCase()}${value.slice(1)}` : 'Needs attention'
}
