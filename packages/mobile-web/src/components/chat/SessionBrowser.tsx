import React from "react";
import { Plus, Search, MessageSquare, Trash2 } from "lucide-react";
import { formatRelativeTime } from "../../format";
import { useMobileI18n } from "../../i18n/provider";

const DELETE_REVEAL_PX = 82;
const SWIPE_OPEN_THRESHOLD_PX = DELETE_REVEAL_PX * 0.5;
const SWIPE_DIRECTION_BUFFER_PX = 8;

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
  onDeleteSession: (sessionId: string) => void;
}

export const SessionBrowser: React.FC<SessionBrowserProps> = ({
  activeSessionId,
  items,
  searchQuery,
  onSearchChange,
  onCreateSession,
  onOpenSession,
  onDeleteSession,
}) => {
  const { t } = useMobileI18n();
  const [openDeleteId, setOpenDeleteId] = React.useState<string | null>(null);
  const [dragState, setDragState] = React.useState<{
    sessionId: string;
    offset: number;
  } | null>(null);
  const touchDragRef = React.useRef<{
    sessionId: string;
    x: number;
    y: number;
    axis: "pending" | "horizontal" | "vertical";
    baseOffset: number;
    offset: number;
  } | null>(null);
  const suppressNextOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (!openDeleteId) return;
    if (!items.some((item) => item.id === openDeleteId)) {
      setOpenDeleteId(null);
    }
  }, [items, openDeleteId]);

  const handleTouchStart = React.useCallback(
    (sessionId: string, event: React.TouchEvent<HTMLButtonElement>) => {
      const touch = event.touches[0];
      if (!touch) return;
      const baseOffset = openDeleteId === sessionId ? -DELETE_REVEAL_PX : 0;
      if (openDeleteId && openDeleteId !== sessionId) {
        setOpenDeleteId(null);
      }
      touchDragRef.current = {
        sessionId,
        x: touch.clientX,
        y: touch.clientY,
        axis: "pending",
        baseOffset,
        offset: baseOffset,
      };
      setDragState({ sessionId, offset: baseOffset });
    },
    [openDeleteId],
  );

  const handleTouchMove = React.useCallback(
    (sessionId: string, event: React.TouchEvent<HTMLButtonElement>) => {
      const drag = touchDragRef.current;
      if (!drag || drag.sessionId !== sessionId) return;
      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - drag.x;
      const deltaY = touch.clientY - drag.y;
      if (drag.axis === "pending") {
        if (
          Math.abs(deltaX) < SWIPE_DIRECTION_BUFFER_PX &&
          Math.abs(deltaY) < SWIPE_DIRECTION_BUFFER_PX
        ) {
          return;
        }
        drag.axis =
          Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      }

      if (drag.axis !== "horizontal") return;
      const nextOffset = Math.max(
        -DELETE_REVEAL_PX,
        Math.min(0, drag.baseOffset + deltaX),
      );
      drag.offset = nextOffset;
      setDragState({ sessionId, offset: nextOffset });
      event.preventDefault();
    },
    [],
  );

  const handleTouchEnd = React.useCallback(
    (sessionId: string) => {
      const drag = touchDragRef.current;
      touchDragRef.current = null;
      setDragState(null);
      if (!drag || drag.sessionId !== sessionId) return;

      if (drag.axis === "horizontal") {
        suppressNextOpenRef.current = true;
        const shouldOpen = Math.abs(drag.offset) >= SWIPE_OPEN_THRESHOLD_PX;
        setOpenDeleteId(shouldOpen ? sessionId : null);
      }
    },
    [],
  );

  const handleTouchCancel = React.useCallback(() => {
    touchDragRef.current = null;
    setDragState(null);
  }, []);

  const handleOpenSession = React.useCallback(
    (sessionId: string) => {
      if (suppressNextOpenRef.current) {
        suppressNextOpenRef.current = false;
        return;
      }
      if (openDeleteId && openDeleteId !== sessionId) {
        setOpenDeleteId(null);
        return;
      }
      if (openDeleteId === sessionId) {
        setOpenDeleteId(null);
        return;
      }
      onOpenSession(sessionId);
    },
    [onOpenSession, openDeleteId],
  );

  const handleDeleteSession = React.useCallback(
    (sessionId: string) => {
      onDeleteSession(sessionId);
    },
    [onDeleteSession],
  );

  const handleDeleteRailPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, sessionId: string) => {
      event.preventDefault();
      event.stopPropagation();
      handleDeleteSession(sessionId);
    },
    [handleDeleteSession],
  );

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
            const isDragging = dragState?.sessionId === item.id;
            const offset =
              dragState?.sessionId === item.id
                ? dragState.offset
                : openDeleteId === item.id
                  ? -DELETE_REVEAL_PX
                  : 0;
            const isDeleteVisible = offset < -0.5;
            const deleteLabel = t.sessionBrowser.deleteChat(item.title);
            return (
              <article
                key={item.id}
                className={`session-chat-item ${isActive ? "active" : ""} ${isDeleteVisible ? "delete-visible" : ""}`}
              >
                <button
                  type="button"
                  className="session-chat-delete-rail"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onPointerUp={(event) =>
                    handleDeleteRailPointerUp(event, item.id)
                  }
                  onClick={(event) => {
                    // Keyboard accessibility fallback.
                    if (event.detail !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    handleDeleteSession(item.id);
                  }}
                  aria-label={deleteLabel}
                  title={deleteLabel}
                >
                  <Trash2 size={18} />
                </button>
                <button
                  type="button"
                  className={`session-chat-open ${isDragging ? "dragging" : ""}`}
                  style={{ transform: `translateX(${offset}px)` }}
                  onClick={() => handleOpenSession(item.id)}
                  onTouchStart={(event) => handleTouchStart(item.id, event)}
                  onTouchMove={(event) => handleTouchMove(item.id, event)}
                  onTouchEnd={() => handleTouchEnd(item.id)}
                  onTouchCancel={handleTouchCancel}
                  aria-label={item.title}
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
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
