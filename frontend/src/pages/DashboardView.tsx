import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

export const DashboardView: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);

  if (!user) return null;

  return (
    <div className="space-y-6">

    </div>
  );
};
