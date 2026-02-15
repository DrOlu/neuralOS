import React from 'react'
import { clipMultiline, formatClock, messageDetail, messageTypeTitle } from '../../format'
import { isEmptyMessageContent, normalizeDisplayText, trimOuterBlankLines } from '../../session-store'
import type { ChatMessage } from '../../types'
import { MentionContent } from '../common/MentionContent'

interface MessageItemProps {
  message: ChatMessage
  onAskDecision: (message: ChatMessage, decision: 'allow' | 'deny') => void
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, onAskDecision }) => {
  const TOOL_PREVIEW_LINES = 2
  const [expanded, setExpanded] = React.useState(false)
  const isTextMessage = message.type === 'text' && (message.role === 'user' || message.role === 'assistant')

  if (isTextMessage) {
    const displayText = trimOuterBlankLines(String(message.content || '').replace(/\u001b\[[0-9;]*m/g, ''))
    if (!normalizeDisplayText(displayText).trim()) {
      return null
    }
    return (
      <article className={`bubble-row ${message.role}`}>
        <div className={`bubble ${message.role}`}>
          <p>
            <MentionContent text={displayText} />
          </p>
          <footer>
            <span>{formatClock(message.timestamp)}</span>
            {message.streaming ? <span className="streaming">streaming</span> : null}
          </footer>
        </div>
      </article>
    )
  }

  const title = messageTypeTitle(message)
  const detail = trimOuterBlankLines(messageDetail(message))
  if (!detail.trim() && isEmptyMessageContent(message) && message.type !== 'ask' && message.type !== 'command') {
    return null
  }

  const isToolCall = message.type === 'tool_call'
  const detailToRender = isToolCall && !expanded ? clipMultiline(detail, TOOL_PREVIEW_LINES) : detail

  const detailLines = detail.split('\n').length
  const showExpandToggle = isToolCall && detailLines > TOOL_PREVIEW_LINES

  const decision = message.metadata?.decision
  const showDecisionButtons = message.type === 'ask' && decision !== 'allow' && decision !== 'deny'

  return (
    <article className={`event-card ${isToolCall ? 'activity-card tool-call' : message.type}`}>
      <header>
        <div className="event-title-group">
          {isToolCall ? <span className="event-chip">Activity</span> : null}
          <strong>{title}</strong>
        </div>
        <span>{formatClock(message.timestamp)}</span>
      </header>
      {detailToRender ? <pre>{detailToRender}</pre> : null}

      {showExpandToggle ? (
        <button type="button" className="event-expand-btn" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      ) : null}

      {message.type === 'error' && message.metadata?.details ? <pre>{message.metadata.details}</pre> : null}

      {showDecisionButtons ? (
        <div className="decision-actions">
          <button type="button" className="accent-btn" onClick={() => onAskDecision(message, 'allow')}>
            Allow
          </button>
          <button type="button" className="danger-btn" onClick={() => onAskDecision(message, 'deny')}>
            Deny
          </button>
        </div>
      ) : null}

      {message.type === 'ask' && decision ? <p className="decision-result">Decision: {decision}</p> : null}
    </article>
  )
}
