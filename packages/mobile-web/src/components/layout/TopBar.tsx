import React from "react";
import { ChevronLeft, Layers3 } from "lucide-react";
import { useMobileI18n } from "../../i18n/provider";

interface TopBarProps {
  title: string;
  sessionId?: string;
  connectionStatus: "connecting" | "connected" | "disconnected";
  onOpenSessions: () => void;
  onBack?: () => void;
  showSessionMeta?: boolean;
  showSessionAction?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  sessionId,
  connectionStatus,
  onOpenSessions,
  onBack,
  showSessionMeta,
  showSessionAction,
}) => {
  const { t } = useMobileI18n();

  return (
    <header className="top-bar-modern">
      <div className="top-bar-left">
        {onBack && (
          <button
            type="button"
            className="top-back-btn"
            onClick={onBack}
            aria-label={t.topBar.backToSessions}
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="title-block-modern">
          <p className="app-kicker">{t.appName}</p>
          <h1>{title}</h1>
          {showSessionMeta ? (
            <div className="title-meta-row">
              <span className={`conn-dot ${connectionStatus}`}></span>
              <span className="title-meta-text">
                {sessionId
                  ? t.topBar.sessionLabel(sessionId)
                  : t.topBar.noActiveSession}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {showSessionAction ? (
        <div className="top-actions">
          <button
            type="button"
            onClick={onOpenSessions}
            aria-label={t.topBar.sessions}
            title={t.topBar.sessions}
          >
            <Layers3 size={16} />
          </button>
        </div>
      ) : null}
    </header>
  );
};
