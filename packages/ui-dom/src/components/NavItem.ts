export interface NavItemProps {
  readonly label: string;
  readonly icon?: string;
  readonly active?: boolean;
  readonly badge?: number;
  readonly href?: string;
}

export interface NavItemDescriptor {
  readonly kind: 'nav-item';
  readonly className: string;
  readonly props: NavItemProps;
  readonly ariaAttributes: Record<string, string>;
}

export function createNavItemDescriptor(props: NavItemProps): NavItemDescriptor {
  const classes = ['orbit-sidebar-nav-item'];
  if (props.active) classes.push('orbit-sidebar-nav-item--active');

  const ariaAttributes: Record<string, string> = {};
  if (props.active) ariaAttributes['aria-current'] = 'page';
  if (props.label) ariaAttributes['aria-label'] = props.label;
  if (props.badge !== undefined && props.badge > 0) {
    ariaAttributes['aria-label'] = `${props.label} (${props.badge})`;
  }

  return {
    kind: 'nav-item',
    className: classes.join(' '),
    props,
    ariaAttributes,
  };
}
