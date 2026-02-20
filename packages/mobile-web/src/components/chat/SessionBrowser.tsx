import React from "react";
import { Plus, Search, MessageSquare } from "lucide-react";
import { formatRelativeTime } from "../../format";
import { useMobileI18n } from "../../i18n/provider";

export interface SessionBrowserItem {
  id: string;
  title: string;
  updatedAt: number;
  preview: string;
  messagesCount: number;
  isRunning: boolean;
}

interface SessionBrowserProps {
  activeSessionId: string | null;
  items: SessionBrowserItem[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onCreateSession: () => void;
  onOpenSession: (sessionId: string) => void;
}

export const SessionBrowser: React.FC<SessionBrowserProps> = ({
  activeSessionId,
  items,
  searchQuery,
  onSearchChange,
  onCreateSession,
  onOpenSession,
}) => {
  const { t } = useMobileI18n();

  return (
    <section className="session-browser">
      <div className="session-browser-top">
        <label className="session-search">
          <Search size={14} />
          <input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t.sessionBrowser.searchPlaceholder}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <button
          type="button"
          className="session-create-btn"
          aria-label={t.sessionBrowser.createChat}
          title={t.sessionBrowser.createChat}
          onClick={onCreateSession}
        >
          <Plus size={15} />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="panel-empty">{t.sessionBrowser.empty}</p>
      ) : (
        <div className="session-browser-list">
          {items.map((item) => {
            const isActive = item.id === activeSessionId;
            return (
              <button
                key={item.id}
                type="button"
                className={`session-chat-item ${isActive ? "active" : ""}`}
                onClick={() => onOpenSession(item.id)}
              >
                <div className="session-chat-icon">
                  <MessageSquare size={18} />
                  <div
                    className={`session-status-indicator ${item.isRunning ? "running" : "idle"}`}
                  />
                </div>
                <div className="session-chat-main">
                  <div className="session-chat-head">
                    <h3 className="session-chat-title">{item.title}</h3>
                    <span className="session-chat-time">
                      {formatRelativeTime(item.updatedAt, t.format)}
                    </span>
                  </div>
                  <p className="session-chat-preview">
                    {item.preview || t.sessionBrowser.noUpdates}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
