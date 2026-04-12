import type { IsoDateTimeString } from '@orbit/domain';

// ── Types ──────────────────────────────────────────────────

export type SupportLinkKind =
  | 'reading_material'
  | 'research_reference'
  | 'writing_output'
  | 'discussion_thread';

export interface SupportLink {
  readonly taskOrProjectId: string;
  readonly materialObjectType: string;
  readonly materialObjectId: string;
  readonly kind: SupportLinkKind;
  readonly addedAt: IsoDateTimeString;
  readonly relevanceNote: string | null;
}

export interface SupportLinkSummary {
  readonly reading_material: number;
  readonly research_reference: number;
  readonly writing_output: number;
  readonly discussion_thread: number;
}

// ── Functions ──────────────────────────────────────────────

export function createSupportLink(
  taskOrProjectId: string,
  materialType: string,
  materialId: string,
  kind: SupportLinkKind,
  note?: string,
): SupportLink {
  const now = new Date().toISOString() as IsoDateTimeString;
  return {
    taskOrProjectId,
    materialObjectType: materialType,
    materialObjectId: materialId,
    kind,
    addedAt: now,
    relevanceNote: note ?? null,
  };
}

export function getSupportLinks(
  links: readonly SupportLink[],
  taskOrProjectId: string,
): readonly SupportLink[] {
  return links.filter((l) => l.taskOrProjectId === taskOrProjectId);
}

export function getTasksForMaterial(
  links: readonly SupportLink[],
  materialId: string,
): readonly SupportLink[] {
  return links.filter((l) => l.materialObjectId === materialId);
}

export function summarizeSupportLinks(
  links: readonly SupportLink[],
): SupportLinkSummary {
  const summary: Record<SupportLinkKind, number> = {
    reading_material: 0,
    research_reference: 0,
    writing_output: 0,
    discussion_thread: 0,
  };

  for (const link of links) {
    summary[link.kind]++;
  }

  return summary;
}
