import React from 'react'
import { RefreshCw } from 'lucide-react'
import type { SkillSummary } from '../../types'

interface SkillsPanelProps {
  skills: SkillSummary[]
  connectionStatus: 'connecting' | 'connected' | 'disconnected'
  onReload: () => void
  onSetSkillEnabled: (name: string, enabled: boolean) => Promise<void>
}

interface SkillGroup {
  key: string
  label: string
  order: number
  items: SkillSummary[]
}

function resolveSkillGroup(scanRoot: string | undefined): { key: string; label: string; order: number } {
  const root = String(scanRoot || '')
  const lower = root.toLowerCase()

  if (lower.includes('/.codex/') || lower.includes('\\.codex\\')) {
    return { key: 'codex', label: 'Codex Skills', order: 2 }
  }
  if (lower.includes('/.agents/') || lower.includes('\\.agents\\')) {
    return { key: 'agents', label: '.agent/skill', order: 3 }
  }
  if (lower.includes('/.claude/') || lower.includes('\\.claude\\')) {
    return { key: 'claude', label: 'Claude Skills', order: 4 }
  }
  if (lower.includes('gyshell') || (lower.endsWith('/skills') && !lower.includes('/.')) || lower.endsWith('\\skills')) {
    return { key: 'custom', label: 'GYSHELL CUSTOM', order: 1 }
  }
  return {
    key: root || 'other',
    label: root || 'Other',
    order: 99
  }
}

export const SkillsPanel: React.FC<SkillsPanelProps> = ({ skills, connectionStatus, onReload, onSetSkillEnabled }) => {
  const [reloading, setReloading] = React.useState(false)
  const canMutate = connectionStatus === 'connected'

  const groupedSkills = React.useMemo(() => {
    const groups: Record<string, SkillGroup> = {}
    for (const skill of skills) {
      const { key, label, order } = resolveSkillGroup(skill.scanRoot)
      if (!groups[key]) {
        groups[key] = { key, label, order, items: [] }
      }
      groups[key].items.push(skill)
    }
    return Object.values(groups).sort((a, b) => a.order - b.order)
  }, [skills])

  const enabledCount = skills.filter((skill) => skill.enabled !== false).length

  const toggleOne = React.useCallback(
    async (name: string, enabled: boolean) => {
      if (!canMutate) return
      await onSetSkillEnabled(name, enabled)
    },
    [onSetSkillEnabled, canMutate]
  )

  const handleReload = React.useCallback(async () => {
    setReloading(true)
    try {
      await onReload()
    } finally {
      setReloading(false)
    }
  }, [onReload])

  return (
    <section className="panel-scroll skills-panel">
      <div className="panel-toolbar">
        <p className="panel-toolbar-meta">
          {enabledCount}/{skills.length} enabled
        </p>
        <div className="panel-toolbar-actions">
          <button
            type="button"
            className="panel-icon-btn"
            disabled={!canMutate || reloading}
            onClick={handleReload}
            aria-label="Reload skills"
            title="Reload skills"
          >
            <RefreshCw size={16} className={reloading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {skills.length === 0 ? (
        <p className="panel-empty">No skills found.</p>
      ) : (
        <div className="skill-sources">
          {groupedSkills.map((group) => {
            return (
              <section key={group.key} className="skill-source-group">
                <header className="skill-source-head">
                  <h3>{group.label}</h3>
                </header>

                <div className="skill-list">
                  {group.items.map((skill) => {
                    const isEnabled = skill.enabled !== false
                    return (
                      <article key={skill.name} className="skill-item">
                        <div className="skill-item-body">
                          <h3>{skill.name}</h3>
                          <p>{skill.description || 'No description provided.'}</p>
                        </div>
                        <button
                          type="button"
                          className={`skill-toggle ${isEnabled ? 'enabled' : ''}`}
                          disabled={!canMutate}
                          onClick={() => void toggleOne(skill.name, !isEnabled)}
                        >
                          {isEnabled ? 'ON' : 'OFF'}
                        </button>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
