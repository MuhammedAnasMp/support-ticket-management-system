import React from 'react';

interface StatCardProps {
    title: string;
    value: string | number;
    subtext?: string;
    icon?: React.ReactNode;
    badgeColor?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
    loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    subtext,
    icon,
    badgeColor = 'neutral',
    loading = false
}) => {
    const badgeStyleMap = {
        primary: 'bg-primary-container/10 text-primary border-primary-container/20',
        success: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        warning: 'bg-tertiary-container/10 text-tertiary border-tertiary-container/20',
        error: 'bg-error-container text-on-error-container border-error-container',
        neutral: 'bg-surface-container-high text-on-surface-variant border-outline-variant',
    };

    if (loading) {
        return (
            <div className="p-4 rounded border border-outline-variant bg-surface-container animate-pulse flex flex-col justify-between h-24">
                <div className="h-3 bg-outline-variant rounded w-1/2" />
                <div className="h-6 bg-surface-container-high rounded w-3/4" />
                <div className="h-2 bg-outline-variant rounded w-1/3" />
            </div>
        );
    }

    return (
        <div className="p-4 rounded border border-outline-variant bg-surface-container flex flex-col justify-between transition-all hover:border-outline shadow-2xs">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-on-surface-variant truncate">{title}</span>
                {icon && (
                    <div className="w-7 h-7 rounded flex items-center justify-center bg-surface-container-low text-primary shrink-0">
                        {icon}
                    </div>
                )}
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-semibold tracking-tight text-on-surface">{value}</span>
                {subtext && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${badgeStyleMap[badgeColor]}`}>
                        {subtext}
                    </span>
                )}
            </div>
        </div>
    );
};
