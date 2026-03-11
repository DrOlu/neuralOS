import fs from 'node:fs'
import path from 'node:path'

const ELF_HEADER_SIZE = 64
const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46]
const ELF_CLASS_64 = 2
const ELF_DATA_LSB = 1
const EM_X86_64 = 62
const EM_AARCH64 = 183

const EXPECTED_ELF_MACHINE_BY_TARGET = new Map([
  ['linux-x64', EM_X86_64],
  ['linux-arm64', EM_AARCH64],
])

const ARCH_LABEL_BY_ELF_MACHINE = new Map([
  [EM_X86_64, 'x64'],
  [EM_AARCH64, 'arm64'],
])

const CANONICAL_LINUX_ARCH_BY_ALIAS = new Map([
  ['x86_64', 'x64'],
  ['amd64', 'x64'],
  ['aarch64', 'arm64'],
])

const LINUX_PACKAGE_EXTENSIONS = new Set(['.AppImage', '.deb', '.pacman', '.rpm'])

export function getLinuxRuntimeBinaryPath(runtimeRoot) {
  return path.join(runtimeRoot, 'bin', 'gyll')
}

export function assertLinuxBinaryMatchesTarget(filePath, target) {
  const expectedMachine = EXPECTED_ELF_MACHINE_BY_TARGET.get(target)
  if (!expectedMachine) {
    throw new Error(`Unsupported Linux target "${target}" for CLI runtime validation`)
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Linux CLI runtime binary: ${filePath}`)
  }

  const actualMachine = readElfMachine(filePath)
  if (actualMachine !== expectedMachine) {
    const expectedArch = ARCH_LABEL_BY_ELF_MACHINE.get(expectedMachine) ?? `machine-${expectedMachine}`
    const actualArch = ARCH_LABEL_BY_ELF_MACHINE.get(actualMachine) ?? `machine-${actualMachine}`
    throw new Error(
      `CLI runtime architecture mismatch for ${target}: expected ${expectedArch}, found ${actualArch} (${filePath})`,
    )
  }
}

export function normalizeLinuxArtifactName(fileName) {
  return fileName.replace(/(^|[-_.])(x86_64|amd64|aarch64)(?=[-_.]|$)/g, (match, prefix, archAlias) => {
    const canonicalArch = CANONICAL_LINUX_ARCH_BY_ALIAS.get(archAlias)
    return canonicalArch ? `${prefix}${canonicalArch}` : match
  })
}

export function normalizeLinuxArtifactPath(filePath) {
  const extension = path.extname(filePath)
  if (!LINUX_PACKAGE_EXTENSIONS.has(extension)) {
    return filePath
  }

  const normalizedName = normalizeLinuxArtifactName(path.basename(filePath))
  if (normalizedName === path.basename(filePath)) {
    return filePath
  }

  return path.join(path.dirname(filePath), normalizedName)
}

function readElfMachine(filePath) {
  const fileDescriptor = fs.openSync(filePath, 'r')
  const header = Buffer.alloc(ELF_HEADER_SIZE)

  try {
    const bytesRead = fs.readSync(fileDescriptor, header, 0, ELF_HEADER_SIZE, 0)
    if (bytesRead < ELF_HEADER_SIZE) {
      throw new Error(`File is too small to be a valid ELF binary: ${filePath}`)
    }

    for (let index = 0; index < ELF_MAGIC.length; index += 1) {
      if (header[index] !== ELF_MAGIC[index]) {
        throw new Error(`File is not an ELF binary: ${filePath}`)
      }
    }

    if (header[4] !== ELF_CLASS_64) {
      throw new Error(`Unsupported ELF class in ${filePath}: ${header[4]}`)
    }

    if (header[5] !== ELF_DATA_LSB) {
      throw new Error(`Unsupported ELF endianness in ${filePath}: ${header[5]}`)
    }

    return header.readUInt16LE(18)
  } finally {
    fs.closeSync(fileDescriptor)
  }
}
