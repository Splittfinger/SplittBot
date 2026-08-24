import { mkdtemp, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAX_CHAT_IMAGE_BYTES, validateChatImagePath } from '../../src/main/services/chat-attachments'

const validPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XG8QAAAAAElFTkSuQmCC', 'base64')

describe('chat image attachments', () => {
  it('accepts a local image by file signature and returns safe metadata', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'splittbot-chat-image-'))
    const imagePath = join(directory, 'evidence.png')
    await writeFile(imagePath, validPng)
    const canonicalPath = await realpath(imagePath)

    await expect(validateChatImagePath(imagePath)).resolves.toEqual({
      type: 'image',
      name: 'evidence.png',
      path: canonicalPath,
      size: validPng.length
    })
  })

  it('rejects relative paths, renamed text, and oversized files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'splittbot-chat-image-invalid-'))
    const fakeImagePath = join(directory, 'not-really.png')
    const oversizedPath = join(directory, 'oversized.png')
    await writeFile(fakeImagePath, 'plain text')
    await writeFile(oversizedPath, Buffer.concat([validPng, Buffer.alloc(MAX_CHAT_IMAGE_BYTES)]))

    await expect(validateChatImagePath('relative.png')).rejects.toThrow('absolute')
    await expect(validateChatImagePath(fakeImagePath)).rejects.toThrow('valid PNG, JPEG, or WebP')
    await expect(validateChatImagePath(oversizedPath)).rejects.toThrow('smaller than 20 MB')
  })
})
