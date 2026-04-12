import type { IsoDateTimeString } from '@orbit/domain';

// ── Step definitions ───────────────────────────────────────

export type OnboardingStepId =
  | 'positioning_intro'
  | 'vision_writing'
  | 'agent_refinement'
  | 'confirmation'
  | 'reminder_posture'
  | 'landing_handoff';

const STEP_ORDER: readonly OnboardingStepId[] = [
  'positioning_intro',
  'vision_writing',
  'agent_refinement',
  'confirmation',
  'reminder_posture',
  'landing_handoff',
] as const;

const STEP_META: Record<OnboardingStepId, { readonly title: string; readonly description: string }> = {
  positioning_intro: {
    title: 'Welcome & Positioning',
    description: 'Introduce the vision concept and why it matters for personal alignment.',
  },
  vision_writing: {
    title: 'Write Your Vision',
    description: 'Draft a free-form vision statement capturing your aspirations.',
  },
  agent_refinement: {
    title: 'Agent Refinement',
    description: 'Let the agent suggest structure and refinements to your draft.',
  },
  confirmation: {
    title: 'Confirm Your Vision',
    description: 'Review the refined vision and confirm it as your guiding document.',
  },
  reminder_posture: {
    title: 'Set Reminder Posture',
    description: 'Choose how and when the agent should gently remind you of your vision.',
  },
  landing_handoff: {
    title: 'Landing & Handoff',
    description: 'Complete onboarding and transition into daily use.',
  },
};

// ── Interfaces ─────────────────────────────────────────────

export interface OnboardingStep<T = unknown> {
  readonly id: OnboardingStepId;
  readonly title: string;
  readonly description: string;
  readonly isComplete: boolean;
  readonly data: T;
}

export interface OnboardingSession {
  readonly currentStepId: OnboardingStepId;
  readonly steps: readonly OnboardingStep[];
  readonly startedAt: IsoDateTimeString;
  readonly completedAt: IsoDateTimeString | null;
}

// ── Functions ──────────────────────────────────────────────

export function createOnboardingSession(): OnboardingSession {
  const now = new Date().toISOString() as IsoDateTimeString;
  const steps: OnboardingStep[] = STEP_ORDER.map((id) => ({
    id,
    title: STEP_META[id].title,
    description: STEP_META[id].description,
    isComplete: false,
    data: null,
  }));

  return {
    currentStepId: STEP_ORDER[0],
    steps,
    startedAt: now,
    completedAt: null,
  };
}

export function canAdvance(session: OnboardingSession): boolean {
  const currentStep = session.steps.find((s) => s.id === session.currentStepId);
  return currentStep?.isComplete === true;
}

export function advanceStep<T = unknown>(
  session: OnboardingSession,
  stepData: T,
): OnboardingSession {
  const currentIndex = STEP_ORDER.indexOf(session.currentStepId);
  if (currentIndex === -1) return session;

  const updatedSteps = session.steps.map((step) =>
    step.id === session.currentStepId
      ? { ...step, isComplete: true, data: stepData }
      : step,
  );

  const isLastStep = currentIndex >= STEP_ORDER.length - 1;
  const nextStepId = isLastStep ? session.currentStepId : STEP_ORDER[currentIndex + 1];

  return {
    ...session,
    currentStepId: nextStepId,
    steps: updatedSteps,
    completedAt: null,
  };
}

export function completeOnboarding(session: OnboardingSession): OnboardingSession {
  const allComplete = session.steps.every((s) => s.isComplete);
  if (!allComplete) return session;

  const now = new Date().toISOString() as IsoDateTimeString;
  return { ...session, completedAt: now };
}
