import {
  Laptop,
  Server,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react'
import type { TerminalConnectionIconKind } from '@gyshell/shared'

export const resolveTerminalTabIcon = (
  iconKind: TerminalConnectionIconKind,
): LucideIcon => {
  if (iconKind === 'remote') {
    return Server
  }
  if (iconKind === 'local') {
    return Laptop
  }
  return SquareTerminal
}
