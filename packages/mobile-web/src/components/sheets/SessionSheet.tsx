import React from 'react'
import { Plus, X } from 'lucide-react'
import { formatRelativeTime } from '../../format'

export interface SessionSheetItem {
  id: string
  title: string
  updatedAt: number
  preview: string
  messagesCount: number
  isRunning: boolean
}

interface SessionSheetProps {
  open: boolean
  activeSessionId: string | null
  items: SessionSheetItem[]
  onClose: () => void
  onCreateSession: () => void
  onSwitchSession: (sessionId: string) => void
}

export const SessionSheet: React.FC<SessionSheetProps> = ({
  open,
  activeSessionId,
  items,
  onClose,
  onCreateSession,
  onSwitchSession
}) => {
  return (
    <>
      <div className={`sheet-overlay ${open ? 'is-open' : ''}`} onClick={onClose}></div>
      <aside className={`bottom-sheet ${open ? 'is-open' : ''}`}>
        <header className="sheet-header">
          <div>
            <p>Session Center</p>
            <h2>Work Progress</h2>
          </div>
          <button type="button" className="sheet-icon-btn" onClick={onClose} aria-label="Close sessions">
            <X size={15} />
            <span className="sr-only">Close</span>
          </button>
        </header>

        <section className="sheet-top-actions">
          <button
            type="button"
            className="accent-btn icon-only"
            onClick={onCreateSession}
            aria-label="Create new session"
            title="Create new session"
          >
            <Plus size={16} />
            <span className="sr-only">New Session</span>
          </button>
        </section>

        <section className="session-list-modern">
          {items.map((item) => {
            const isActive = item.id === activeSessionId
            return (
              <button
                key={item.id}
                type="button"
                className={`session-item-modern ${isActive ? 'active' : ''}`}
                onClick={() => onSwitchSession(item.id)}
              >
                <div className="session-item-head-modern">
                  <h3>{item.title}</h3>
                  <span>{formatRelativeTime(item.updatedAt)}</span>
                </div>

                <p>{item.preview || 'No updates yet.'}</p>

                <div className="session-item-foot-modern">
                  <span>{item.messagesCount} messages</span>
                  <span className={item.isRunning ? 'busy' : 'idle'}>{item.isRunning ? 'RUNNING' : 'IDLE'}</span>
                </div>
              </button>
            )
          })}
        </section>
      </aside>
    </>
  )
}
