import type {
  Directive,
  DirectiveScope,
  Vision,
  IsoDateTimeString,
} from '@orbit/domain';

// ── Types ──────────────────────────────────────────────────

export interface CreateDirectiveInput {
  readonly id: string;
  readonly title: string;
  readonly body: string | null;
  readonly scope: DirectiveScope | null;
  readonly ownerUserId: string;
}

export interface DirectiveSuggestion {
  readonly proposedTitle: string;
  readonly proposedBody: string;
  readonly reasoning: string;
  readonly confidence: number;
  readonly scope: DirectiveScope | null;
  readonly visionId: string;
}

export interface SuggestDirectiveContext {
  readonly recentActivity?: string;
  readonly currentDirectives?: readonly Directive[];
}

// ── Factory functions ──────────────────────────────────────

export function createDirectiveFromVision(
  vision: Vision,
  input: CreateDirectiveInput,
): Directive {
  const now = new Date().toISOString() as IsoDateTimeString;

  return {
    objectType: 'directive',
    id: input.id,
    title: input.title,
    body: input.body,
    status: 'draft',
    scope: input.scope,
    visionId: vision.id,
    decisionMode: 'user_written',
    ownerUserId: input.ownerUserId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export function suggestDirective(
  vision: Vision,
  _context: SuggestDirectiveContext,
): DirectiveSuggestion {
  return {
    proposedTitle: `Directive for "${vision.title}"`,
    proposedBody: `Align daily actions with the ${vision.scope} vision: "${vision.title}".`,
    reasoning: `Based on the active vision "${vision.title}", a directive can help translate high-level aspirations into actionable guidance.`,
    confidence: 0.7,
    scope: 'quarter',
    visionId: vision.id,
  };
}

// ── Service interface ──────────────────────────────────────

export interface DirectiveService {
  readonly create: (directive: Directive) => Promise<Directive>;
  readonly update: (id: string, patch: Partial<Pick<Directive, 'title' | 'body' | 'scope' | 'status'>>) => Promise<Directive>;
  readonly activate: (id: string) => Promise<Directive>;
  readonly pause: (id: string) => Promise<Directive>;
  readonly archive: (id: string) => Promise<Directive>;
  readonly listByVision: (visionId: string) => Promise<readonly Directive[]>;
  readonly listActive: (ownerUserId: string) => Promise<readonly Directive[]>;
}
