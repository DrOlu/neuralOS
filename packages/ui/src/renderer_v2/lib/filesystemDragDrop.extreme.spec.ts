import {
  FILESYSTEM_PANEL_DRAG_MIME,
  decodeTerminalScopedFilePath,
  encodeFileSystemPanelDragPayload,
  encodeTerminalScopedFilePath,
  hasFileSystemPanelDragPayloadType,
  hasNativeFileDragType,
  getFileMentionDisplayName,
  parseFileSystemPanelDragPayload
} from './filesystemDragDrop'

const assertCondition = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message)
  }
}

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`)
  }
}

const runCase = async (name: string, fn: () => Promise<void> | void): Promise<void> => {
  await fn()
  console.log(`PASS ${name}`)
}

const run = async (): Promise<void> => {
  await runCase('terminal scoped file paths round-trip with URI-safe terminal IDs', () => {
    const encoded = encodeTerminalScopedFilePath('local/main tab', '/tmp/demo.txt')
    const decoded = decodeTerminalScopedFilePath(encoded)
    assertCondition(!!decoded, 'decode should parse encoded scoped path')
    assertEqual(decoded?.terminalId || '', 'local/main tab', 'decoded terminal id should match source')
    assertEqual(decoded?.filePath || '', '/tmp/demo.txt', 'decoded file path should match source')
  })

  await runCase('file mention display name resolves scoped file path basename', () => {
    const scoped = encodeTerminalScopedFilePath('ssh-main', '/home/demo/readme.md')
    assertEqual(getFileMentionDisplayName(scoped), 'readme.md', 'scoped file path should render basename only')
  })

  await runCase('filesystem panel drag payload encode/decode round-trip', () => {
    const payload = {
      version: 1 as const,
      sourceTerminalId: 'ssh-1',
      sourceBasePath: '/home/demo',
      entries: [
        {
          name: 'a.txt',
          path: '/home/demo/a.txt',
          isDirectory: false,
          size: 4
        },
        {
          name: 'docs',
          path: '/home/demo/docs',
          isDirectory: true
        }
      ]
    }
    const encoded = encodeFileSystemPanelDragPayload(payload)
    const parsed = parseFileSystemPanelDragPayload({
      types: [FILESYSTEM_PANEL_DRAG_MIME],
      getData: (type: string) => (type === FILESYSTEM_PANEL_DRAG_MIME ? encoded : '')
    } as unknown as Pick<DataTransfer, 'types' | 'getData'>)

    assertCondition(!!parsed, 'payload should parse successfully')
    assertEqual(parsed?.sourceTerminalId || '', 'ssh-1', 'source terminal id should be preserved')
    assertEqual(parsed?.entries.length || 0, 2, 'entry count should be preserved')
    assertEqual(parsed?.entries[0].name || '', 'a.txt', 'first entry name should be preserved')
  })

  await runCase('invalid drag payload should fail closed', () => {
    const parsed = parseFileSystemPanelDragPayload({
      types: [FILESYSTEM_PANEL_DRAG_MIME],
      getData: () => '{"version":2}'
    } as unknown as Pick<DataTransfer, 'types' | 'getData'>)
    assertEqual(parsed, null, 'unsupported payload version should be rejected')
  })

  await runCase('drag type detection works without reading payload body', () => {
    const customOnly = hasFileSystemPanelDragPayloadType({
      types: [FILESYSTEM_PANEL_DRAG_MIME]
    } as unknown as Pick<DataTransfer, 'types'>)
    assertEqual(customOnly, true, 'filesystem payload mime type should be detected via types only')

    const nativeOnly = hasNativeFileDragType({
      types: ['Files']
    } as unknown as Pick<DataTransfer, 'types'>)
    assertEqual(nativeOnly, true, 'native file drag should be detected via Files type')

    const none = hasNativeFileDragType({
      types: ['text/plain']
    } as unknown as Pick<DataTransfer, 'types'>)
    assertEqual(none, false, 'non-file drags should be ignored')
  })
}

void run()
  .then(() => {
    console.log('All filesystemDragDrop extreme tests passed.')
  })
  .catch((error) => {
    console.error(error)
    throw error
  })
