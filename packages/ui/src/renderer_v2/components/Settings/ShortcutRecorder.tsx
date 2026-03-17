import React from 'react'
import {
  captureCommandDraftShortcut,
  formatCommandDraftShortcut,
  resolveCommandDraftShortcut
} from '../../lib/commandDraftShortcut'

export function ShortcutRecorder(props: {
  value: string
  disabledLabel: string
  listeningLabel: string
  onChange: (value: string) => void
}): React.ReactElement {
  const [isListening, setIsListening] = React.useState(false)

  React.useEffect(() => {
    if (!isListening) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const nextValue = captureCommandDraftShortcut(event)
      if (nextValue === null) {
        return
      }
      props.onChange(resolveCommandDraftShortcut(nextValue))
      setIsListening(false)
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.settings-shortcut-button')) {
        return
      }
      setIsListening(false)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('mousedown', handleMouseDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('mousedown', handleMouseDown, true)
    }
  }, [isListening, props])

  return (
    <div className="settings-shortcut-control">
      <button
        type="button"
        className={`settings-inline-input settings-shortcut-button${isListening ? ' is-listening' : ''}`}
        onClick={() => setIsListening((current) => !current)}
      >
        {isListening
          ? props.listeningLabel
          : formatCommandDraftShortcut(props.value, props.disabledLabel)}
      </button>
    </div>
  )
}
