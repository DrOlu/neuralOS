export const isTerminalTrackedByBackend = async (terminalId: string): Promise<boolean> => {
  try {
    const snapshot = await window.gyshell.terminal.list()
    if (!Array.isArray(snapshot?.terminals)) return false
    return snapshot.terminals.some((entry) => entry?.id === terminalId)
  } catch {
    return false
  }
}
