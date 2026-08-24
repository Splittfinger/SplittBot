import { readFile, realpath, stat } from 'node:fs/promises'
import { basename, isAbsolute } from 'node:path'
import { avatarImageMime } from './avatar-image'

export const MAX_CHAT_IMAGE_BYTES = 20 * 1024 * 1024
export const MAX_CHAT_IMAGES = 4

export interface ResolvedChatImage {
  type: 'image'
  name: string
  path: string
  size: number
}

export async function validateChatImagePath(inputPath: string): Promise<ResolvedChatImage> {
  if (!isAbsolute(inputPath)) throw new Error('Attached image paths must be absolute.')
  const path = await realpath(inputPath)
  const metadata = await stat(path)
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > MAX_CHAT_IMAGE_BYTES) throw new Error('Choose an image smaller than 20 MB.')
  const bytes = await readFile(path)
  if (!avatarImageMime(bytes)) throw new Error('Attached images must be valid PNG, JPEG, or WebP files.')
  return { type: 'image', name: basename(path), path, size: metadata.size }
}
