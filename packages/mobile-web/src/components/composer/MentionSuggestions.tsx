import React from "react";
import { useMobileI18n } from "../../i18n/provider";
import type { MentionOption } from "../../lib/mentions";

interface MentionSuggestionsProps {
  options: MentionOption[];
  onPick: (option: MentionOption) => void;
}

export const MentionSuggestions: React.FC<MentionSuggestionsProps> = ({
  options,
  onPick,
}) => {
  const { t } = useMobileI18n();

  if (options.length === 0) return null;

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
            <span className={`mention-kind-pill ${option.kind}`}>
              {option.kind === "skill"
                ? t.composer.mentionSkill
                : t.composer.mentionTerminal}
            </span>
            {option.label}
          </span>
          <span className="mention-suggestion-desc">{option.description}</span>
        </button>
      ))}
    </div>
  );
};
