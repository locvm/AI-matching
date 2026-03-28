// @ts-check

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export class JsonStore {
  /** @param {string} filePath */
  constructor(filePath) {
    this.filePath = filePath
  }

  /** @returns {Promise<any[]>} */
  async read() {
    try {
      return JSON.parse(await readFile(this.filePath, 'utf-8'))
    } catch {
      return []
    }
  }

  /** @param {any[]} data */
  async write(data) {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(data, null, 2))
  }

  /** @param {Record<string, any>} item @returns {Promise<any>} */
  async append(item) {
    const data = await this.read()
    data.push(item)
    await this.write(data)
    return item
  }

  /**
   * @param {(item: any) => boolean} predicate
   * @param {Record<string, any>} changes
   */
  async updateWhere(predicate, changes) {
    const data = await this.read()
    await this.write(data.map((item) => (predicate(item) ? { ...item, ...changes } : item)))
  }

  /** @param {(item: any) => boolean} predicate @returns {Promise<any | null>} */
  async findOne(predicate) {
    return (await this.read()).find(predicate) ?? null
  }

  /** @param {(item: any) => boolean} predicate @returns {Promise<any[]>} */
  async findMany(predicate) {
    return (await this.read()).filter(predicate)
  }
}
