import fs from 'node:fs/promises'
import path from 'node:path'
import { normalizeLinuxArtifactName, normalizeLinuxArtifactPath } from './linux-packaging-utils.mjs'

export default async function artifactBuildCompleted(event) {
  if (!event?.file) {
    return
  }

  const normalizedFile = normalizeLinuxArtifactPath(event.file)
  if (normalizedFile === event.file) {
    return
  }

  await fs.rm(normalizedFile, { force: true })
  await fs.rename(event.file, normalizedFile)
  event.file = normalizedFile

  if (typeof event.safeArtifactName === 'string' && event.safeArtifactName.length > 0) {
    event.safeArtifactName = normalizeLinuxArtifactName(path.basename(event.safeArtifactName))
  }

  if (event.updateInfo && typeof event.updateInfo === 'object') {
    normalizeUpdateInfo(event.updateInfo)
  }
}

function normalizeUpdateInfo(updateInfo) {
  if (typeof updateInfo.path === 'string') {
    updateInfo.path = normalizeLinuxArtifactName(updateInfo.path)
  }

  if (!Array.isArray(updateInfo.files)) {
    return
  }

  for (const file of updateInfo.files) {
    if (!file || typeof file !== 'object') {
      continue
    }
    if (typeof file.url === 'string') {
      file.url = normalizeLinuxArtifactName(file.url)
    }
    if (typeof file.path === 'string') {
      file.path = normalizeLinuxArtifactName(file.path)
    }
  }
}
