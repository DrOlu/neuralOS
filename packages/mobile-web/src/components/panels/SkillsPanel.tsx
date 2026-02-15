import React from 'react'
import type { SkillSummary } from '../../types'

interface SkillsPanelProps {
  skills: SkillSummary[]
  onSetSkillEnabled: (name: string, enabled: boolean) => void
}

export const SkillsPanel: React.FC<SkillsPanelProps> = ({ skills, onSetSkillEnabled }) => {
  const enabledCount = skills.filter((skill) => skill.enabled !== false).length

  return (
    <section className="panel-scroll skills-panel">
      <header className="panel-head">
        <h2>Skills</h2>
        <p>
          {enabledCount}/{skills.length} enabled
        </p>
      </header>

      {skills.length === 0 ? (
        <p className="panel-empty">No skills available from gateway.</p>
      ) : (
        <div className="skill-list">
          {skills.map((skill) => {
            const enabled = skill.enabled !== false
            return (
              <article key={skill.name} className="skill-item">
                <div className="skill-item-body">
                  <h3>@{skill.name}</h3>
                  <p>{skill.description || 'No description'}</p>
                </div>
                <button
                  type="button"
                  className={`skill-toggle ${enabled ? 'enabled' : ''}`}
                  onClick={() => onSetSkillEnabled(skill.name, !enabled)}
                  aria-label={`${enabled ? 'Disable' : 'Enable'} ${skill.name}`}
                >
                  {enabled ? 'On' : 'Off'}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
