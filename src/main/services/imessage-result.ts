export function parseIMessageResult(stdout: string): Record<string, unknown> {
  let result: Record<string, unknown>
  try {
    const parsed = JSON.parse(stdout)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid response')
    result = parsed
  } catch { throw new Error('The local Messages helper returned an unreadable response. No message was sent.') }
  if (result.ok !== true) {
    if (result.error === 'messages_database_permission_denied') {
      throw new Error('Messages access is denied. Enable Full Disk Access for the installed SplittBot app in System Settings → Privacy & Security, then quit and reopen SplittBot. No message was sent.')
    }
    const code = typeof result.error === 'string' && /^[a-z_]{1,80}$/.test(result.error) ? ` (${result.error})` : ''
    throw new Error(`The local Messages check could not complete${code}. No message was sent.`)
  }
  return result
}
