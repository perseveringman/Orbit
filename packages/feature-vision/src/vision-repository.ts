import type {
  Vision,
  VisionVersion,
  VisionScope,
  VisionReminderMode,
  VisionAuthoredBy,
  IsoDateTimeString,
} from '@orbit/domain';

// ── Input types ────────────────────────────────────────────

export interface CreateVisionInput {
  readonly id: string;
  readonly title: string;
  readonly scope: VisionScope;
  readonly reminderMode: VisionReminderMode;
  readonly ownerUserId: string;
  readonly sourceFileId?: string | null;
}

export interface CreateVisionVersionInput {
  readonly id: string;
  readonly visionId: string;
  readonly versionNo: number;
  readonly sourceFileId: string;
  readonly bodyMarkdown: string;
  readonly summaryForAgent: string;
  readonly changeNote?: string | null;
  readonly authoredBy: VisionAuthoredBy;
}

// ── Slug generation ────────────────────────────────────────

export function generateSlug(title: string, existingSlugs: readonly string[] = []): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!existingSlugs.includes(base)) return base;

  let counter = 2;
  while (existingSlugs.includes(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

// ── Factory functions ──────────────────────────────────────

export function createVision(input: CreateVisionInput, existingSlugs: readonly string[] = []): Vision {
  const now = new Date().toISOString() as IsoDateTimeString;
  const slug = generateSlug(input.title, existingSlugs);

  return {
    objectType: 'vision',
    id: input.id,
    slug,
    title: input.title,
    currentVersionId: '',
    status: 'active',
    reminderMode: input.reminderMode,
    scope: input.scope,
    ownerUserId: input.ownerUserId,
    sourceFileId: input.sourceFileId ?? null,
    createdAt: now,
    updatedAt: now,
    lastReaffirmedAt: null,
    deletedAt: null,
  };
}

export function createVisionVersion(input: CreateVisionVersionInput): VisionVersion {
  const now = new Date().toISOString() as IsoDateTimeString;

  return {
    id: input.id,
    visionId: input.visionId,
    versionNo: input.versionNo,
    sourceFileId: input.sourceFileId,
    bodyMarkdown: input.bodyMarkdown,
    summaryForAgent: input.summaryForAgent,
    changeNote: input.changeNote ?? null,
    authoredBy: input.authoredBy,
    createdAt: now,
  };
}

// ── Repository interfaces ──────────────────────────────────

export interface VisionRepository {
  readonly create: (vision: Vision) => Promise<Vision>;
  readonly getById: (id: string) => Promise<Vision | null>;
  readonly getBySlug: (slug: string) => Promise<Vision | null>;
  readonly update: (id: string, patch: Partial<Pick<Vision, 'title' | 'status' | 'reminderMode' | 'scope' | 'currentVersionId'>>) => Promise<Vision>;
  readonly archive: (id: string) => Promise<Vision>;
  readonly list: (ownerUserId: string) => Promise<readonly Vision[]>;
}

export interface VisionVersionRepository {
  readonly create: (version: VisionVersion) => Promise<VisionVersion>;
  readonly getByVisionId: (visionId: string) => Promise<readonly VisionVersion[]>;
  readonly getLatest: (visionId: string) => Promise<VisionVersion | null>;
  readonly getByVersionNo: (visionId: string, versionNo: number) => Promise<VisionVersion | null>;
}
