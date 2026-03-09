import type { MonitorSnapshot } from '../../lib/ipcTypes'

type ResourceSnapshot = MonitorSnapshot
type DiskEntry = NonNullable<ResourceSnapshot['disks']>[number]

export const resolvePrimaryDisk = (snapshot: ResourceSnapshot): DiskEntry | undefined => {
  const disks = snapshot.disks || []
  if (disks.length === 0) {
    return undefined
  }

  const platform = snapshot.system?.platform || 'unknown'
  if (platform === 'windows') {
    return (
      disks.find((entry: DiskEntry) => /^c:\\/i.test(entry.mountPoint)) ||
      disks.find((entry: DiskEntry) => /^[a-z]:\\/i.test(entry.mountPoint)) ||
      disks[0]
    )
  }

  if (platform === 'darwin') {
    return (
      disks.find((entry: DiskEntry) => entry.mountPoint === '/System/Volumes/Data') ||
      disks.find((entry: DiskEntry) => entry.mountPoint === '/') ||
      disks[0]
    )
  }

  if (platform === 'linux') {
    return (
      disks.find((entry: DiskEntry) => entry.mountPoint === '/') ||
      disks.find((entry: DiskEntry) => entry.mountPoint === '/home') ||
      disks[0]
    )
  }

  return disks[0]
}
