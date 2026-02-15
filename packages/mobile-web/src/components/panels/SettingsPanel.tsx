import React from 'react'
import type { GatewayProfileSummary } from '../../types'

interface SettingsPanelProps {
  gatewayInput: string
  connectionStatus: 'connecting' | 'connected' | 'disconnected'
  actionPending: boolean
  connectionError: string
  profiles: GatewayProfileSummary[]
  activeProfileId: string
  onGatewayInputChange: (value: string) => void
  onConnect: () => void
  onDisconnect: () => void
  onUpdateProfile: (profileId: string) => void
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  gatewayInput,
  connectionStatus,
  actionPending,
  connectionError,
  profiles,
  activeProfileId,
  onGatewayInputChange,
  onConnect,
  onDisconnect,
  onUpdateProfile
}) => {
  const connected = connectionStatus === 'connected'

  return (
    <section className="panel-scroll settings-panel">
      <section className="settings-section">
        <h3>Gateway</h3>
        <p className="section-hint">WebSocket endpoint for this mobile client.</p>
        <input
          value={gatewayInput}
          onChange={(event) => onGatewayInputChange(event.target.value)}
          placeholder="ws://192.168.1.8:17888"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="settings-row-actions">
          {connected ? (
            <button type="button" className="danger-btn" onClick={onDisconnect}>
              Disconnect
            </button>
          ) : (
            <button type="button" className="accent-btn" onClick={onConnect} disabled={actionPending}>
              {actionPending ? 'Connecting...' : 'Connect'}
            </button>
          )}
          <span className={`conn-label ${connectionStatus}`}>{connectionStatus}</span>
        </div>
        {connectionError ? <p className="settings-error">{connectionError}</p> : null}
      </section>

      {profiles.length > 0 ? (
        <section className="settings-section">
          <h3>Model Profile</h3>
          <select value={activeProfileId} onChange={(event) => onUpdateProfile(event.target.value)}>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </section>
      ) : null}
    </section>
  )
}
