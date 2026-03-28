// @ts-check

export class IdempotencyService {
  /**
   * @param {import('ioredis').default} redis
   * @param {{ ttl?: number, keyPrefix?: string }} [opts]
   */
  constructor(redis, opts = {}) {
    this.redis = redis
    this.ttl = opts.ttl ?? 3_600_000
    this.prefix = opts.keyPrefix ?? 'idempotency'
  }

  /** @param {string} key @param {number} [ttl] @returns {Promise<boolean>} */
  async check(key, ttl) {
    const full = `${this.prefix}:${key}`
    try {
      if (await this.redis.exists(full)) return true
      await this.redis.setex(full, Math.floor((ttl ?? this.ttl) / 1000), '1')
      return false
    } catch {
      return false
    }
  }

  /**
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} fn
   * @param {number} [ttl]
   * @returns {Promise<T>}
   */
  async execute(key, fn, ttl) {
    if (await this.check(key, ttl)) throw new Error(`Duplicate operation: ${key}`)
    return fn()
  }

  /** @param {string} key */
  clear(key) {
    return this.redis.del(`${this.prefix}:${key}`)
  }

  /**
   * @param {string} type
   * @param {string} id
   */
  static jobKey(type, id) {
    return `${type}:${id}`
  }
}
