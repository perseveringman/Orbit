import type {
  DayNote,
  PrivacyLevel,
  IsoDateString,
} from '@orbit/domain';
import { classifyPrivacy, deriveAgentAccess } from './privacy-classifier.js';

// ── Service interface ──────────────────────────────────────

export interface DayNoteService {
  readonly create: (dayKey: IsoDateString, markdown: string, privacyLevel?: PrivacyLevel) => DayNote;
  readonly getByDay: (dayKey: IsoDateString) => DayNote | null;
  readonly update: (existing: DayNote, newMarkdown: string) => DayNote;
  readonly listRange: (start: IsoDateString, end: IsoDateString) => readonly DayNote[];
  readonly search: (query: string) => readonly DayNote[];
}

// ── Helpers ────────────────────────────────────────────────

let _counter = 0;

function generateId(): string {
  const ts = Date.now().toString(36);
  _counter += 1;
  return `dnote_${ts}_${_counter.toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Factories ──────────────────────────────────────────────

export function createDayNote(
  dayKey: IsoDateString,
  markdown: string,
  privacyLevel?: PrivacyLevel,
): DayNote {
  const privacy = privacyLevel ?? classifyPrivacy(markdown);
  const now = nowIso();

  return {
    objectType: 'day_note',
    id: generateId(),
    dayKey,
    noteKind: 'journal',
    markdown,
    filePath: null,
    privacyLevel: privacy,
    agentAccess: deriveAgentAccess(privacy),
    reflectsOnUids: null,
    recordingMode: 'normal',
    createdAt: now,
    updatedAt: now,
  };
}

export function updateDayNote(
  existing: DayNote,
  newMarkdown: string,
): DayNote {
  const privacy = classifyPrivacy(newMarkdown);
  return {
    ...existing,
    markdown: newMarkdown,
    privacyLevel: privacy,
    agentAccess: deriveAgentAccess(privacy),
    updatedAt: nowIso(),
  };
}
