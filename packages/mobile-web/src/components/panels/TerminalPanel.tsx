import React from 'react'
import { Plus, X } from 'lucide-react'
import type { GatewayTerminalSummary } from '../../types'

interface TerminalPanelProps {
  terminals: GatewayTerminalSummary[]
  onCreateTerminal: () => void
  onCloseTerminal: (terminalId: string) => void
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  terminals,
  onCreateTerminal,
  onCloseTerminal
}) => {
  return (
    <section className="panel-scroll terminal-panel">
      <div className="panel-toolbar">
        <div className="panel-title-spacer" />
        <button
          type="button"
          className="panel-icon-btn"
          aria-label="New terminal"
          title="New terminal"
          onClick={onCreateTerminal}
        >
          <Plus size={16} />
        </button>
      </div>

      {terminals.length === 0 ? (
        <p className="panel-empty">No active terminals.</p>
      ) : (
        <div className="terminal-list">
          {terminals.map((terminal) => {
            return (
              <article key={terminal.id} className="terminal-item-flat">
                <div className="terminal-item-main">
                  <strong>{terminal.title}</strong>
                  <p>{terminal.type}</p>
                </div>
                <button
                  type="button"
                  className="terminal-close-btn"
                  aria-label={`Close ${terminal.title}`}
                  title={`Close ${terminal.title}`}
                  onClick={() => onCloseTerminal(terminal.id)}
                  disabled={terminals.length <= 1}
                >
                  <X size={14} />
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
