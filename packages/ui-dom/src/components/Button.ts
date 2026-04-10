export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  readonly label: string;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly icon?: string;
}

export interface ButtonDescriptor {
  readonly kind: 'button';
  readonly className: string;
  readonly props: ButtonProps;
  readonly ariaAttributes: Record<string, string>;
}

export function createButtonDescriptor(props: ButtonProps): ButtonDescriptor {
  const variant = props.variant ?? 'primary';
  const size = props.size ?? 'md';

  const classes = ['orbit-button', `orbit-button--${variant}`, `orbit-button--${size}`];
  if (props.disabled) classes.push('orbit-button--disabled');
  if (props.loading) classes.push('orbit-button--loading');

  const ariaAttributes: Record<string, string> = {};
  if (props.disabled) ariaAttributes['aria-disabled'] = 'true';
  if (props.loading) ariaAttributes['aria-busy'] = 'true';
  if (props.label) ariaAttributes['aria-label'] = props.label;

  return {
    kind: 'button',
    className: classes.join(' '),
    props,
    ariaAttributes,
  };
}
