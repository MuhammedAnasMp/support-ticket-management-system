import { useSelector } from 'react-redux';
import type { RootState } from '../store';

export const usePermission = () => {
  const { user, permissions } = useSelector((state: RootState) => state.auth);

  const hasPermission = (perm?: string): boolean => {
    if (!perm) return true;
    if (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'administrator') return true;
    const normalized = perm.toLowerCase();
    return permissions.some(
      (p) => p.toLowerCase() === normalized || p.toLowerCase().endsWith('.' + normalized)
    );
  };

  return { hasPermission };
};
