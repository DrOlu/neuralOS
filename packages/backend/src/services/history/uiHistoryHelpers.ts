import type { ChatMessage, UIChatSession } from "../../types/ui-chat";
import type { UISessionSummaryRecord } from "./historyTypes";

export const buildAutoSessionTitle = (content: string): string => {
  const normalized = String(content || "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || "New Chat";
};

export function cloneUiSession(session: UIChatSession): UIChatSession {
  return JSON.parse(JSON.stringify(session)) as UIChatSession;
}

export function restoreLegacyAutoTitleIfTruncated(
  session: UIChatSession,
): void {
  const firstUserText = session.messages.find(
    (message) => message.role === "user",
  )?.content;
  if (!firstUserText) return;

  const fullAutoTitle = buildAutoSessionTitle(firstUserText);
  const currentTitle = String(session.title || "").trim();
  if (!currentTitle || currentTitle === "New Chat") {
    session.title = fullAutoTitle;
    return;
  }

  if (currentTitle.endsWith("...")) {
    const prefix = currentTitle.slice(0, -3);
    if (prefix && fullAutoTitle.startsWith(prefix)) {
      session.title = fullAutoTitle;
    }
  }
}

export function sanitizeUiSession(session: UIChatSession): UIChatSession {
  const sanitized = cloneUiSession(session);
  sanitized.messages = sanitized.messages.filter(
    (message) => message.type !== "ask",
  );
  sanitized.messages.forEach((message) => {
    if (message.type !== "command" || !message.streaming) {
      return;
    }
    message.streaming = false;
    if (message.metadata && message.metadata.exitCode === undefined) {
      message.metadata.exitCode = -1;
      message.metadata.output = `${message.metadata.output || ""}\n[Session closed before command finished]`;
    }
  });
  restoreLegacyAutoTitleIfTruncated(sanitized);
  return sanitized;
}

export function getLastVisiblePreview(messages: ChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.type === "tokens_count") continue;
    const imagePreview =
      Array.isArray(message.metadata?.inputImages) &&
      message.metadata.inputImages.length > 0
        ? message.metadata.inputImages
            .map((item) => item.fileName || item.attachmentId || "image")
            .join(", ")
        : "";
    const preview = String(
      message.content || message.metadata?.output || imagePreview || "",
    );
    if (preview) {
      return preview;
    }
    return "";
  }
  return "";
}

export function buildUiSessionSummary(
  session: UIChatSession,
): UISessionSummaryRecord {
  return {
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt,
    messagesCount: session.messages.length,
    lastMessagePreview: getLastVisiblePreview(session.messages),
  };
}
