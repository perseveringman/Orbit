import type { Vision, VisionReminderMode, IsoDateTimeString } from '@orbit/domain';

// ── Types ──────────────────────────────────────────────────

export type ReminderTrigger = 'before_choice' | 'on_create' | 'on_review' | 'on_help';

export interface ReminderContext {
  readonly trigger: ReminderTrigger;
  readonly currentActivity?: string;
  readonly timestamp: IsoDateTimeString;
}

export interface ReminderRule {
  readonly trigger: ReminderTrigger;
  readonly allowedModes: readonly VisionReminderMode[];
  readonly description: string;
}

export interface ShouldRemindResult {
  readonly shouldRemind: boolean;
  readonly reason: string;
}

export interface ReminderMessage {
  readonly trigger: ReminderTrigger;
  readonly title: string;
  readonly body: string;
  readonly tone: 'gentle';
}

// ── Rules ──────────────────────────────────────────────────

const REMINDER_RULES: readonly ReminderRule[] = [
  {
    trigger: 'before_choice',
    allowedModes: ['review_only', 'decision_points'],
    description: 'Remind when user is about to make a decision.',
  },
  {
    trigger: 'on_create',
    allowedModes: ['review_only', 'decision_points'],
    description: 'Remind when creating a new project or task.',
  },
  {
    trigger: 'on_review',
    allowedModes: ['review_only', 'decision_points', 'on_request'],
    description: 'Remind during daily or weekly review.',
  },
  {
    trigger: 'on_help',
    allowedModes: ['review_only', 'decision_points', 'on_request'],
    description: 'Remind when user explicitly asks for guidance.',
  },
] as const;

// ── Functions ──────────────────────────────────────────────

export function shouldRemind(
  trigger: ReminderTrigger,
  vision: Vision,
  _context: ReminderContext,
): ShouldRemindResult {
  if (vision.status !== 'active') {
    return { shouldRemind: false, reason: 'Vision is not active.' };
  }

  if (vision.reminderMode === 'silent') {
    return { shouldRemind: false, reason: 'Reminder mode is silent.' };
  }

  const rule = REMINDER_RULES.find((r) => r.trigger === trigger);
  if (!rule) {
    return { shouldRemind: false, reason: `No rule defined for trigger "${trigger}".` };
  }

  if (!rule.allowedModes.includes(vision.reminderMode)) {
    return {
      shouldRemind: false,
      reason: `Trigger "${trigger}" is not active under "${vision.reminderMode}" mode.`,
    };
  }

  return { shouldRemind: true, reason: rule.description };
}

export function generateReminder(
  trigger: ReminderTrigger,
  vision: Vision,
  _context: ReminderContext,
): ReminderMessage {
  const messages: Record<ReminderTrigger, (v: Vision) => { readonly title: string; readonly body: string }> = {
    before_choice: (v) => ({
      title: 'A gentle nudge before you decide',
      body: `Your vision "${v.title}" might be relevant here. Take a moment to consider how this choice aligns with your ${v.scope} aspirations.`,
    }),
    on_create: (v) => ({
      title: 'Starting something new',
      body: `As you create this, remember your vision "${v.title}". Does this new endeavor serve your ${v.scope} direction?`,
    }),
    on_review: (v) => ({
      title: 'Review checkpoint',
      body: `During this review, consider how recent progress aligns with your vision "${v.title}" for your ${v.scope}.`,
    }),
    on_help: (v) => ({
      title: 'Guidance from your vision',
      body: `Your vision "${v.title}" can help guide this moment. Here's what you wrote about your ${v.scope} aspirations — let it inform your next step.`,
    }),
  };

  const { title, body } = messages[trigger](vision);
  return { trigger, title, body, tone: 'gentle' };
}

export { REMINDER_RULES };
