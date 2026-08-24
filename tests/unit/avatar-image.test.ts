import { describe, expect, it } from 'vitest'
import { avatarImageMime, MAX_AVATAR_BYTES } from '../../src/main/services/avatar-image'

describe('avatar image validation', () => {
  it('accepts supported image signatures and rejects renamed non-images', () => {
    expect(avatarImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(avatarImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(avatarImageMime(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp')
    expect(avatarImageMime(new TextEncoder().encode('not really a picture.png'))).toBeNull()
    expect(MAX_AVATAR_BYTES).toBe(5 * 1024 * 1024)
  })
})
