export type ModalSize = 'sm' | 'md' | 'lg' | 'fullscreen';
export type ModalRole = 'dialog' | 'alertdialog';

export interface ModalProps {
  readonly title: string;
  readonly open?: boolean;
  readonly size?: ModalSize;
  readonly dismissible?: boolean;
  readonly role?: ModalRole;
}

export interface ModalDescriptor {
  readonly kind: 'modal';
  readonly className: string;
  readonly props: ModalProps;
  readonly ariaAttributes: Record<string, string>;
}

export function createModalDescriptor(props: ModalProps): ModalDescriptor {
  const size = props.size ?? 'md';
  const role = props.role ?? 'dialog';

  const classes = ['orbit-modal', `orbit-modal--${size}`];
  if (props.open) classes.push('orbit-modal--open');

  const ariaAttributes: Record<string, string> = {
    'role': role,
    'aria-modal': 'true',
    'aria-label': props.title,
  };
  if (!props.open) ariaAttributes['aria-hidden'] = 'true';

  return {
    kind: 'modal',
    className: classes.join(' '),
    props,
    ariaAttributes,
  };
}
