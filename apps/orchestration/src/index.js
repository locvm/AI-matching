// @ts-check

import { connect, disconnect } from '@locvm/database'
import { MatchingQueue } from './queue/index.js'
import { createMatchingServer, startServer } from './http/server.js'
import { startRecovery } from './queue/recovery.js'
import { startScanner } from './queue/scanner.js'

await connect()

const queue = new MatchingQueue()
const server = createMatchingServer(queue)

const recoveryTimer = startRecovery(queue)
const scannerTimer = startScanner(queue)
await startServer(server)

process.on('SIGTERM', async () => {
  clearInterval(recoveryTimer)
  clearInterval(scannerTimer)
  await new Promise((resolve) => server.close(resolve))
  await queue.waitForDrain()
  await disconnect()
})
