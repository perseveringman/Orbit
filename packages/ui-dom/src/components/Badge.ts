export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  readonly label: string;
  readonly variant?: BadgeVariant;
  readonly size?: BadgeSize;
}

export interface BadgeDescriptor {
  readonly kind: 'badge';
  readonly className: string;
  readonly props: BadgeProps;
  readonly ariaAttributes: Record<string, string>;
}

export function createBadgeDescriptor(props: BadgeProps): BadgeDescriptor {
  const variant = props.variant ?? 'default';
  const size = props.size ?? 'md';

  const classes = ['orbit-badge', `orbit-badge--${variant}`, `orbit-badge--${size}`];

  const ariaAttributes: Record<string, string> = {
    'aria-label': props.label,
  };

  return {
    kind: 'badge',
    className: classes.join(' '),
    props,
    ariaAttributes,
  };
}
