export interface DomSlot<TProps extends Record<string, unknown>> {
  kind: 'dom-slot';
  name: string;
  props: TProps;
}

export function createDomSlot<TProps extends Record<string, unknown>>(name: string, props: TProps): DomSlot<TProps> {
  return {
    kind: 'dom-slot',
    name,
    props
  };
}
