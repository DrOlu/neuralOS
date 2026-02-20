import type { ChatMessage } from "./types";
import { normalizeDisplayText, trimOuterBlankLines } from "./session-store";
import type { MobileTranslations } from "./i18n/types";

export function formatClock(timestamp: number): string {
  if (!timestamp) return "--:--";
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatRelativeTime(
  timestamp: number,
  t: MobileTranslations["format"],
): string {
  if (!timestamp) return t.justNow;
  const delta = Date.now() - timestamp;
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;

  if (delta < minute) return t.justNow;
  if (delta < hour) return t.minutesAgo(Math.floor(delta / minute));
  if (delta < day) return t.hoursAgo(Math.floor(delta / hour));
  return t.daysAgo(Math.floor(delta / day));
}

export function messageTypeTitle(
  message: ChatMessage,
  t: MobileTranslations["format"],
): string {
  switch (message.type) {
    case "command":
      return t.commandRun;
    case "tool_call":
      return message.metadata?.toolName || t.toolCall;
    case "file_edit":
      return message.metadata?.action === "created"
        ? t.fileCreated
        : t.fileEdited;
    case "sub_tool":
      return message.metadata?.subToolTitle || t.subTool;
    case "reasoning":
      return message.metadata?.subToolTitle || t.reasoning;
    case "alert":
      return t.alert;
    case "error":
      return t.error;
    case "ask":
      return t.permissionRequired;
    default:
      return t.message;
  }
}

export function messageDetail(
  message: ChatMessage,
  t: MobileTranslations["format"],
): string {
  if (message.type === "command") {
    const output = trimOuterBlankLines(
      normalizeDisplayText(message.metadata?.output || ""),
    );
    const command = trimOuterBlankLines(
      normalizeDisplayText(message.content || message.metadata?.command || ""),
    );
    if (output) return `${command}\n\n${output}`;
    return command;
  }

  if (message.type === "file_edit") {
    const path = message.metadata?.filePath || t.unknownFile;
    const diff = trimOuterBlankLines(
      normalizeDisplayText(message.metadata?.diff || ""),
    );
    const summary = message.content
      ? trimOuterBlankLines(normalizeDisplayText(message.content))
      : "";
    const head = `${path}${summary ? `\n${summary}` : ""}`;
    if (!diff) return head;
    return `${head}\n\n${diff}`;
  }

  if (message.type === "ask") {
    return trimOuterBlankLines(
      normalizeDisplayText(message.metadata?.command || message.content || ""),
    );
  }

  const base = message.metadata?.output || message.content || "";
  return trimOuterBlankLines(normalizeDisplayText(base));
}

export function clipMultilineWithLocale(
  text: string,
  maxLines: number,
  t: MobileTranslations["format"],
  maxChars = 420,
): string {
  const normalized = String(text || "");
  if (!normalized) return "";

  const lines = normalized.split("\n");
  if (lines.length > maxLines) {
    return `${lines.slice(0, maxLines).join("\n")}\n${t.moreLines(lines.length - maxLines)}`;
  }

  if (normalized.length > maxChars) {
    return `${normalized.slice(0, maxChars).trimEnd()}\n${t.moreChars(normalized.length - maxChars)}`;
  }

  return normalized;
}
