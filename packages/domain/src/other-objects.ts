import type { IsoDateTimeString } from './common.js';

// ── Tag ────────────────────────────────────────────────────

export interface Tag {
  readonly objectType: 'tag';
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly description: string | null;
  readonly ownerUserId: string;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}

// ── AiChat ─────────────────────────────────────────────────

export type AiChatRole = 'user' | 'assistant' | 'system';

export interface AiChatMessage {
  readonly role: AiChatRole;
  readonly content: string;
  readonly createdAt: IsoDateTimeString;
}

export interface AiChat {
  readonly objectType: 'ai_chat';
  readonly id: string;
  readonly title: string | null;
  readonly anchorObjectUid: string | null;
  readonly sessionId: string | null;
  readonly messages: readonly AiChatMessage[];
  readonly model: string | null;
  readonly ownerUserId: string;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly deletedAt?: IsoDateTimeString | null;
}
