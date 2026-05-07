import * as React from 'react';
import { cn } from '../../lib/utils';

export function StatCard({ title, value, subtitle, icon, className }: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  icon?: React.ReactNode;
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 sm:p-5 text-card-foreground shadow-sm transition-shadow hover:shadow card-hover', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight stat-value">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>}
        </div>
        {icon && <span className="text-lg shrink-0 mt-0.5">{icon}</span>}
      </div>
    </div>
  );
}

export function Section({ title, children, className, description }: { title: string; children: React.ReactNode; className?: string; description?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}