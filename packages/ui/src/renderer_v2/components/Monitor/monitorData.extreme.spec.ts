import { resolvePrimaryDisk } from './monitorData'

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`)
  }
}

const runCase = (name: string, fn: () => void): void => {
  fn()
  console.log(`PASS ${name}`)
}

runCase('resolvePrimaryDisk prefers the system drive for windows snapshots', () => {
  const disk = resolvePrimaryDisk({
    system: { platform: 'windows' },
    disks: [
      { mountPoint: 'F:\\', filesystem: 'NTFS', totalBytes: 1, usedBytes: 1, availableBytes: 0, usagePercent: 99.6 },
      { mountPoint: 'D:\\', filesystem: 'NTFS', totalBytes: 1, usedBytes: 1, availableBytes: 0, usagePercent: 91.4 },
      { mountPoint: 'C:\\', filesystem: 'NTFS', totalBytes: 1, usedBytes: 1, availableBytes: 0, usagePercent: 91.2 },
    ],
  } as any)

  assertEqual(disk?.mountPoint, 'C:\\', 'windows compact disk should prefer C drive')
})

runCase('resolvePrimaryDisk prefers the data volume for darwin snapshots', () => {
  const disk = resolvePrimaryDisk({
    system: { platform: 'darwin' },
    disks: [
      { mountPoint: '/Volumes/Backup', filesystem: 'apfs', totalBytes: 1, usedBytes: 1, availableBytes: 0, usagePercent: 20 },
      { mountPoint: '/', filesystem: 'apfs', totalBytes: 1, usedBytes: 1, availableBytes: 0, usagePercent: 10 },
      { mountPoint: '/System/Volumes/Data', filesystem: 'apfs', totalBytes: 1, usedBytes: 1, availableBytes: 0, usagePercent: 64 },
    ],
  } as any)

  assertEqual(disk?.mountPoint, '/System/Volumes/Data', 'mac compact disk should prefer the data volume')
})
