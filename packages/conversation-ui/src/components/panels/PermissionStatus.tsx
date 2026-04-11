// ---------------------------------------------------------------------------
// PermissionStatus – Current permission modes (allowed / requires approval)
// ---------------------------------------------------------------------------

import React from 'react';

import type { PermissionMode } from './SessionSidePanel.js';

export interface PermissionStatusProps {
  readonly permissions: PermissionMode[];
}

function PermissionIcon({ allowed, requiresApproval }: Pick<PermissionMode, 'allowed' | 'requiresApproval'>) {
  if (allowed && !requiresApproval) {
    return <span className="text-success text-sm" aria-label="已允许">✓</span>;
  }
  if (requiresApproval) {
    return <span className="text-warning text-sm" aria-label="需审批">🛡</span>;
  }
  return <span className="text-danger text-sm" aria-label="已禁止">✗</span>;
}

function PermissionLabel({ allowed, requiresApproval }: Pick<PermissionMode, 'allowed' | 'requiresApproval'>) {
  if (allowed && !requiresApproval) return <span className="text-success text-xs">已允许</span>;
  if (requiresApproval) return <span className="text-warning text-xs">需审批</span>;
  return <span className="text-danger text-xs">已禁止</span>;
}

export const PermissionStatus = React.memo(function PermissionStatus({
  permissions,
}: PermissionStatusProps) {
  if (permissions.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">
          权限状态
        </h3>
        <p className="text-xs text-muted">暂无权限配置</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">
        权限状态
      </h3>

      <ul className="flex flex-col gap-1.5">
        {permissions.map((perm) => (
          <li key={perm.name} className="flex items-center gap-2 text-sm">
            <PermissionIcon allowed={perm.allowed} requiresApproval={perm.requiresApproval} />
            <span className="text-foreground">{perm.name}</span>
            <span className="ml-auto">
              <PermissionLabel allowed={perm.allowed} requiresApproval={perm.requiresApproval} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});
