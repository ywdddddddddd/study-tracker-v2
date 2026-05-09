import { cn } from '../../lib/utils';

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface SaveIndicatorProps {
  status: SaveStatus;
  onSave?: () => void;
  onRetry?: () => void;
  className?: string;
}

const STATUS_CONFIG: Record<SaveStatus, { label: string; className: string; dot: string }> = {
  idle: { label: '', className: 'text-muted-foreground', dot: '' },
  dirty: { label: '未保存', className: 'text-amber-600', dot: 'bg-amber-500' },
  saving: { label: '保存中...', className: 'text-blue-600', dot: 'bg-blue-500 animate-pulse' },
  saved: { label: '已保存', className: 'text-emerald-600', dot: 'bg-emerald-500' },
  error: { label: '保存失败', className: 'text-red-600', dot: 'bg-red-500' },
};

export default function SaveIndicator({ status, onSave, onRetry, className }: SaveIndicatorProps) {
  if (status === 'idle') return null;

  const config = STATUS_CONFIG[status];

  return (
    <button
      onClick={status === 'dirty' ? onSave : status === 'error' ? onRetry : undefined}
      className={cn(
        'flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-all',
        status === 'error' && 'cursor-pointer hover:bg-red-50',
        status === 'dirty' && 'cursor-pointer hover:bg-amber-50',
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      <span className={config.className}>{config.label}</span>
    </button>
  );
}
