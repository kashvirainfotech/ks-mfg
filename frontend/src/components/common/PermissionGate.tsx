import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import type { PermissionAction } from '../../types/auth.types';

export interface PermissionGateProps {
  screen: string;
  action?: PermissionAction;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Declarative RBAC guard component that renders children only when the active
 * user's role for the selected Company/Branch grants the requested screen/action permission.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  screen,
  action = 'VIEW',
  fallback = null,
  children,
}) => {
  const hasPermission = useAuthStore((s) => s.hasPermission);

  if (!hasPermission(screen, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
