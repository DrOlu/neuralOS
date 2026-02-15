import { startGyBackend } from '../../../packages/backend/src/runtimes/gybackend/startGyBackend'

void startGyBackend().catch((error) => {
  console.error('[gybackend] Fatal startup error:', error)
  process.exit(1)
})
