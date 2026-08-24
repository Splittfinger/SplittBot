import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { friendlySkillName, resolveSkillDisplayName } from '../../src/main/services/skill-display-name'

describe('friendly skill names', () => {
  it('removes plugin namespaces and formats product names and acronyms', () => {
    expect(friendlySkillName('app-69312da8e4dc81919370cb86fd172b6c:adobe-batch-edit-photos')).toBe('Adobe Batch Edit Photos')
    expect(friendlySkillName('data-analytics:analyze-data-quality')).toBe('Analyze Data Quality')
    expect(friendlySkillName('figma:figma-code-connect')).toBe('Figma Code Connect')
    expect(friendlySkillName('openai-mcp-sdk')).toBe('OpenAI MCP SDK')
  })

  it('uses useful aliases and names generic namespace indexes', () => {
    expect(friendlySkillName('manage-imessages')).toBe('Local iMessage')
    expect(friendlySkillName('computer-use:computer-use')).toBe('Computer Control')
    expect(friendlySkillName('data-analytics:index')).toBe('Data Analytics Tools')
  })

  it('prefers the display name declared by the skill metadata', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'splittbot-skill-name-'))
    const skillPath = join(directory, 'SKILL.md')
    await mkdir(join(directory, 'agents'))
    await writeFile(skillPath, '# Test skill\n')
    await writeFile(join(directory, 'agents', 'openai.yaml'), 'interface:\n  display_name: "Editorial Research Desk"\n')

    await expect(resolveSkillDisplayName({ name: 'cryptic-skill-id', description: 'Research approved sources.', path: skillPath })).resolves.toBe('Editorial Research Desk')
  })

  it('falls back safely when metadata is absent or unusable', async () => {
    await expect(resolveSkillDisplayName({ name: 'box:box-legal-workflows-contract', description: 'Review contracts.', path: '/missing/SKILL.md' })).resolves.toBe('Box Legal Workflows Contract')
    expect(friendlySkillName('', 'prepare a polished project brief. More details follow.')).toBe('Prepare a polished project brief')
  })
})
