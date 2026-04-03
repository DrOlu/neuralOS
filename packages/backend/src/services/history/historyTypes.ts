import type { ChatMessage, UIChatSession } from "../../types/ui-chat";

export interface StoredChatMessageRecord {
  id: string;
  type: string;
  data: any;
}

export interface StoredChatSessionRecord {
  id: string;
  title: string;
  messages: StoredChatMessageRecord[];
  lastCheckpointOffset: number;
  lastProfileMaxTokens?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChatSessionSummaryRecord {
  id: string;
  title: string;
  updatedAt: number;
  createdAt: number;
  messagesCount: number;
  lastCheckpointOffset: number;
  lastProfileMaxTokens?: number;
}

export interface UISessionSummaryRecord {
  id: string;
  title: string;
  updatedAt: number;
  messagesCount: number;
  lastMessagePreview: string;
}

export interface UISessionRecord extends UIChatSession {
  messages: ChatMessage[];
}
