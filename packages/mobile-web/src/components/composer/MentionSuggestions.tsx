import React from 'react'
import type { MentionOption } from '../../lib/mentions'

interface MentionSuggestionsProps {
  options: MentionOption[]
  onPick: (option: MentionOption) => void
}

export const MentionSuggestions: React.FC<MentionSuggestionsProps> = ({ options, onPick }) => {
  if (options.length === 0) return null

  return (
    <div className="mention-suggestions-mobile">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className="mention-suggestion-item"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(option)}
        >
          <span className="mention-suggestion-label">
            <span className={`mention-kind-pill ${option.kind}`}>{option.kind === 'skill' ? 'SKILL' : 'TERMINAL'}</span>
            {option.label}
          </span>
          <span className="mention-suggestion-desc">{option.description}</span>
        </button>
      ))}
    </div>
  )
}
