import React from 'react'
import { Circle, CircleDot, Plus, X } from 'lucide-react'
import type { GatewayTerminalSummary } from '../../types'

interface TerminalPanelProps {
  terminals: GatewayTerminalSummary[]
  activeTerminalTargetId: string | null
  activeSessionTerminalId?: string
  onSelectTerminalTarget: (terminalId: string) => void
  onCreateTerminal: () => void
  onCloseTerminal: (terminalId: string) => void
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  terminals,
  activeTerminalTargetId,
  activeSessionTerminalId,
  onSelectTerminalTarget,
  onCreateTerminal,
  onCloseTerminal
}) => {
  return (
    <section className="panel-scroll terminal-panel">
      <header className="panel-head">
        <h2>Terminal Tabs</h2>
        <p>Set default terminal target for new sessions.</p>
        <button
          type="button"
          className="panel-icon-btn"
          aria-label="Create terminal tab"
          title="Create terminal tab"
          onClick={onCreateTerminal}
        >
          <Plus size={15} />
        </button>
      </header>

      {terminals.length === 0 ? (
        <p className="panel-empty">No terminal tab available.</p>
      ) : (
        <div className="terminal-list">
          {terminals.map((terminal) => {
            const isDefault = terminal.id === activeTerminalTargetId
            const isBound = terminal.id === activeSessionTerminalId
            return (
              <article key={terminal.id} className={`terminal-item ${isDefault ? 'active' : ''}`}>
                <div className="terminal-item-main">
                  <strong>{terminal.title}</strong>
                  <p>{terminal.type}</p>
                </div>
                <div className="terminal-item-flags actions">
                  {isBound ? <span className="terminal-dot-active" title="Bound to active session"></span> : null}
                  <button
                    type="button"
                    className="terminal-mini-btn"
                    aria-label={isDefault ? 'Default terminal' : 'Set as default terminal'}
                    title={isDefault ? 'Default terminal' : 'Set as default terminal'}
                    onClick={() => onSelectTerminalTarget(terminal.id)}
                  >
                    {isDefault ? <CircleDot size={14} /> : <Circle size={14} />}
                  </button>
                  <button
                    type="button"
                    className="terminal-mini-btn danger"
                    aria-label={`Close ${terminal.title}`}
                    title={`Close ${terminal.title}`}
                    onClick={() => onCloseTerminal(terminal.id)}
                    disabled={terminals.length <= 1}
                  >
                    <X size={14} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
