import type { RelationSuggestion } from './relation-suggestion.js';

// ── Activation policy ──

export interface LinkActivationPolicy {
  readonly autoActivateThreshold: number;
  readonly autoActivateRelations: readonly string[];
  readonly requireUserConfirmRelations: readonly string[];
}

export const DEFAULT_ACTIVATION_POLICY: LinkActivationPolicy = {
  autoActivateThreshold: 0.85,
  autoActivateRelations: ['about', 'tagged_with', 'relates_to'],
  requireUserConfirmRelations: ['supports', 'informs', 'context_for', 'blocks', 'depends_on', 'decides'],
};

export function shouldAutoActivate(
  suggestion: RelationSuggestion,
  policy: LinkActivationPolicy,
): boolean {
  return (
    suggestion.confidence >= policy.autoActivateThreshold &&
    policy.autoActivateRelations.includes(suggestion.relationType) &&
    !policy.requireUserConfirmRelations.includes(suggestion.relationType)
  );
}

// ── Activation decision ──

export interface ActivationDecision {
  readonly action: 'auto_activate' | 'propose' | 'discard';
  readonly reason: string;
}

export function decideActivation(
  suggestion: RelationSuggestion,
  policy: LinkActivationPolicy,
  minConfidenceToPropose: number,
): ActivationDecision {
  if (shouldAutoActivate(suggestion, policy)) {
    return {
      action: 'auto_activate',
      reason: `confidence ${suggestion.confidence} >= ${policy.autoActivateThreshold} and relation '${suggestion.relationType}' is auto-activatable`,
    };
  }

  if (suggestion.confidence >= minConfidenceToPropose) {
    return {
      action: 'propose',
      reason: `confidence ${suggestion.confidence} >= propose threshold ${minConfidenceToPropose} but does not meet auto-activate criteria`,
    };
  }

  return {
    action: 'discard',
    reason: `confidence ${suggestion.confidence} < propose threshold ${minConfidenceToPropose}`,
  };
}
