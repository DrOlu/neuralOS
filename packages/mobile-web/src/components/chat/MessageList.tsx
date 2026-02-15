import React from 'react'
import type { ChatMessage } from '../../types'
import { MessageItem } from './MessageItem'

interface MessageListProps {
  messages: ChatMessage[]
  onAskDecision: (message: ChatMessage, decision: 'allow' | 'deny') => void
  listRef: React.RefObject<HTMLDivElement>
}

export const MessageList: React.FC<MessageListProps> = ({ messages, onAskDecision, listRef }) => {
  return (
    <main className="message-list" ref={listRef}>
      {messages.length === 0 ? (
        <div className="empty-state">
          <p>No messages yet.</p>
          <p>Send a prompt to track this session progress.</p>
        </div>
      ) : (
        messages.map((message) => (
          <MessageItem key={message.id} message={message} onAskDecision={onAskDecision} />
        ))
      )}
    </main>
  )
}
