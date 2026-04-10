export interface CardProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly accentColor?: string;
  readonly objectType?: string;
  readonly interactive?: boolean;
}

export interface CardDescriptor {
  readonly kind: 'card';
  readonly className: string;
  readonly props: CardProps;
  readonly ariaAttributes: Record<string, string>;
}

export function createCardDescriptor(props: CardProps): CardDescriptor {
  const classes = ['orbit-card'];
  if (props.interactive) classes.push('orbit-card--interactive');
  if (props.objectType) classes.push(`orbit-card--${props.objectType}`);

  const ariaAttributes: Record<string, string> = {};
  if (props.interactive) ariaAttributes['role'] = 'button';
  if (props.title) ariaAttributes['aria-label'] = props.title;

  return {
    kind: 'card',
    className: classes.join(' '),
    props,
    ariaAttributes,
  };
}
