import type { ChatMessage } from '../types'
import { isEmptyMessageContent } from '../session-store'

export function shouldRenderMessage(messages: ChatMessage[], index: number): boolean {
  const message = messages[index]
  if (!message) return false

  if (message.type === 'tokens_count') return false

  // Keep reasoning only if it is the latest visible message.
  if (message.type === 'reasoning' && !isLatest(messages, index)) {
    return false
  }

  if ((message.role === 'assistant' || message.role === 'user' || message.role === 'system') && message.type === 'text') {
    if (isEmptyMessageContent(message) && !message.streaming) {
      return false
    }
  }

  // Suppress empty decorative cards.
  if (message.type !== 'command' && message.type !== 'ask') {
    if (isEmptyMessageContent(message) && !message.streaming) {
      return false
    }
  }

  return true
}

export function getRenderableMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((_message, index) => shouldRenderMessage(messages, index))
}

function isLatest(messages: ChatMessage[], index: number): boolean {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].type === 'tokens_count') continue
    return i === index
  }
  return false
}
