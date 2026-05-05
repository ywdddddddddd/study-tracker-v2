import * as React from 'react';
import { cn } from '../../lib/utils';

export function StatCard({ title, value, subtitle, icon, className }: { title: string; value: string | number; subtitle?: string; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card p-4 text-card-foreground shadow-sm', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

export function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}
