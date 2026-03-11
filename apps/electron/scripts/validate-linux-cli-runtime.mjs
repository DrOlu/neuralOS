import path from 'node:path'
import { assertLinuxBinaryMatchesTarget, getLinuxRuntimeBinaryPath } from './linux-packaging-utils.mjs'

const ARCH_BY_BUILDER_VALUE = {
  1: 'x64',
  3: 'arm64',
}

export default async function afterPack(context) {
  if (context?.electronPlatformName !== 'linux') {
    return
  }

  const arch = ARCH_BY_BUILDER_VALUE[context.arch]
  if (!arch) {
    throw new Error(`Unsupported Linux pack architecture: ${context.arch}`)
  }

  const runtimeRoot = path.join(context.appOutDir, 'resources', 'cli')
  const runtimeBinary = getLinuxRuntimeBinaryPath(runtimeRoot)
  assertLinuxBinaryMatchesTarget(runtimeBinary, `linux-${arch}`)
}
