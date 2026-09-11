/** Serialize work for one key while allowing unrelated keys to run concurrently. */
export class KeyedSerialQueue {
  private tails = new Map<string, Promise<unknown>>()

  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key)
    const task = (previous ?? Promise.resolve()).catch(() => undefined).then(work)
    this.tails.set(key, task)
    try {
      return await task
    } finally {
      if (this.tails.get(key) === task) this.tails.delete(key)
    }
  }
}

/** Collapse a burst of refreshes into one request plus the latest pending request. */
export class LatestRefresh<T> {
  private pending: { value: T } | null = null
  private active: Promise<void> | null = null

  constructor(private readonly refresh: (value: T) => Promise<void>) {}

  request(value: T): Promise<void> {
    this.pending = { value }
    if (!this.active) {
      this.active = Promise.resolve().then(async () => {
        try {
          while (this.pending) {
            const next = this.pending.value
            this.pending = null
            await this.refresh(next)
          }
        } finally {
          this.active = null
        }
      })
    }
    return this.active
  }
}
