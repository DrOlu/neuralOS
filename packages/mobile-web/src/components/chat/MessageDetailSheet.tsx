import React from 'react'
import { ChevronLeft } from 'lucide-react'
import type { AgentTimelineItem } from '../../lib/chat-timeline'
import type { ChatMessage } from '../../types'
import { DetailMessageCard } from './DetailMessageCard'

interface MessageDetailSheetProps {
  open: boolean
  turn: AgentTimelineItem | null
  onClose: () => void
  onAskDecision: (message: ChatMessage, decision: 'allow' | 'deny') => void
}

export const MessageDetailSheet: React.FC<MessageDetailSheetProps> = ({
  open,
  turn,
  onClose,
  onAskDecision
}) => {
  const messages = turn?.detailMessages || []

  return (
    <aside className={`detail-screen ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <header className="detail-screen-header">
        <button type="button" className="top-back-btn" onClick={onClose} aria-label="Close detail">
          <ChevronLeft size={20} />
        </button>
        <h2>Message Detail</h2>
        <div style={{ width: 28 }} /> {/* Spacer to balance the header */}
      </header>

      <section className="detail-sheet-meta">
        <span>{messages.length} events</span>
      </section>

      <section className="detail-list">
        {messages.length === 0 ? (
          <p className="panel-empty">No detail messages for this turn.</p>
        ) : (
          messages.map((message) => (
            <DetailMessageCard key={message.id} message={message} onAskDecision={onAskDecision} />
          ))
        )}
      </section>
    </aside>
  )
}
