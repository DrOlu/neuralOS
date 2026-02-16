import React from 'react'
import { ChevronLeft, Layers3 } from 'lucide-react'

interface TopBarProps {
  title: string
  sessionId?: string
  connectionStatus: 'connecting' | 'connected' | 'disconnected'
  onOpenSessions: () => void
  onBack?: () => void
  showSessionMeta?: boolean
  showSessionAction?: boolean
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  sessionId,
  connectionStatus,
  onOpenSessions,
  onBack,
  showSessionMeta,
  showSessionAction
}) => {
  return (
    <header className="top-bar-modern">
      <div className="top-bar-left">
        {onBack && (
          <button
            type="button"
            className="top-back-btn"
            onClick={onBack}
            aria-label="Back to sessions"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="title-block-modern">
          <p className="app-kicker">GyShell Mobile</p>
          <h1>{title}</h1>
          {showSessionMeta ? (
            <div className="title-meta-row">
              <span className={`conn-dot ${connectionStatus}`}></span>
              <span className="title-meta-text">
                {sessionId ? `Session ${sessionId}` : 'No active session'}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {showSessionAction ? (
        <div className="top-actions">
          <button type="button" onClick={onOpenSessions} aria-label="Sessions" title="Sessions">
            <Layers3 size={16} />
          </button>
        </div>
      ) : null}
    </header>
  )
}
