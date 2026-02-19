import React from 'react'
import { LoaderCircle } from 'lucide-react'

interface SettingsPanelProps {
  gatewayInput: string
  accessTokenInput: string
  connectionStatus: 'connecting' | 'connected' | 'disconnected'
  actionPending: boolean
  connectionError: string
  onGatewayInputChange: (value: string) => void
  onAccessTokenInputChange: (value: string) => void
  onConnect: () => void
  onDisconnect: () => void
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  gatewayInput,
  accessTokenInput,
  connectionStatus,
  actionPending,
  connectionError,
  onGatewayInputChange,
  onAccessTokenInputChange,
  onConnect,
  onDisconnect
}) => {
  const connected = connectionStatus === 'connected'
  const connecting = connectionStatus === 'connecting' || actionPending

  return (
    <section className="panel-scroll settings-panel">
      <div className="settings-list-flat">
        <section className="settings-item-flat">
          <header className="settings-head-flat">
            <h3>Gateway</h3>
            <span className={`conn-status-label-flat ${connectionStatus}`}>{connectionStatus}</span>
          </header>
          <p className="settings-hint-flat">WebSocket endpoint for this mobile client.</p>
          <div className="settings-input-row">
            <input
              value={gatewayInput}
              onChange={(event) => onGatewayInputChange(event.target.value)}
              placeholder="ws://192.168.1.8:17888"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="settings-input-row">
            <input
              type="password"
              value={accessTokenInput}
              onChange={(event) => onAccessTokenInputChange(event.target.value)}
              placeholder="Access token (optional for localhost)"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="settings-actions-flat">
            {connected ? (
              <button type="button" className="danger-btn-flat" onClick={onDisconnect}>
                Disconnect
              </button>
            ) : (
              <button type="button" className="accent-btn-flat" onClick={onConnect} disabled={connecting}>
                {connecting ? (
                  <>
                    <LoaderCircle size={14} className="spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </button>
            )}
          </div>
          {connectionError ? <p className="settings-error-flat">{connectionError}</p> : null}
        </section>
      </div>
    </section>
  )
}
