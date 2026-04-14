import { type ReactElement } from 'react';
import { Button, Chip, Dropdown } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import {
  VALID_TRANSITIONS,
  STATUS_LABELS,
  STATUS_DESCRIPTIONS,
  STATUS_COLORS,
  type TaskStatus,
} from './mock-data';

interface StatusTransitionDropdownProps {
  currentStatus: TaskStatus;
  onTransition: (newStatus: TaskStatus) => void;
}

export function StatusTransitionDropdown({
  currentStatus,
  onTransition,
}: StatusTransitionDropdownProps): ReactElement {
  const validNext = VALID_TRANSITIONS[currentStatus];

  const handleTransition = (newStatus: TaskStatus) => {
    onTransition(newStatus);
  };

  if (validNext.length === 0) {
    return (
      <Chip variant="soft" color={STATUS_COLORS[currentStatus]}>
        {STATUS_LABELS[currentStatus]}
      </Chip>
    );
  }

  return (
    <Dropdown>
      <Dropdown.Trigger>
        <Button variant="ghost" size="sm">
          <Chip variant="soft" color={STATUS_COLORS[currentStatus]}>
            {STATUS_LABELS[currentStatus]}
          </Chip>
          <ChevronDown size={14} />
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Popover>
        <Dropdown.Menu
          onAction={(key) => handleTransition(key as TaskStatus)}
        >
          {validNext.map((s) => (
            <Dropdown.Item key={s} id={s} textValue={STATUS_LABELS[s]}>
              <div className="flex items-center gap-2">
                <Chip variant="soft" color={STATUS_COLORS[s]} size="sm">
                  {STATUS_LABELS[s]}
                </Chip>
                <span className="text-xs text-muted">
                  {STATUS_DESCRIPTIONS[s]}
                </span>
              </div>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
