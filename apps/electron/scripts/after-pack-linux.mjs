import { createRequire } from 'node:module'
import validateLinuxCliRuntime from './validate-linux-cli-runtime.mjs'

const require = createRequire(import.meta.url)
const applySandboxFix = require('electron-builder-sandbox-fix')

export default async function afterPack(context) {
  await validateLinuxCliRuntime(context)
  await applySandboxFix(context)
}
