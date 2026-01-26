import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HUDPanelProps {
  children: ReactNode;
  className?: string;
  title?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center-left' | 'center-right';
  delay?: number;
}

const positionClasses: Record<string, string> = {
  'top-left': 'top-6 left-6',
  'top-right': 'top-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'bottom-right': 'bottom-6 right-6',
  'center-left': 'top-1/2 left-6 -translate-y-1/2',
  'center-right': 'top-1/2 right-6 -translate-y-1/2',
};

export function HUDPanel({ 
  children, 
  className, 
  title, 
  position = 'top-left',
  delay = 0 
}: HUDPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'absolute z-20',
        positionClasses[position],
        className
      )}
    >
      <div className="hud-panel hud-panel-glow corner-accents rounded-sm">
        {title && (
          <div className="border-b border-panel-border px-4 py-2">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {title}
            </span>
          </div>
        )}
        <div className="p-4">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

interface StatItemProps {
  label: string;
  value: string | number;
  suffix?: string;
  highlight?: boolean;
}

export function StatItem({ label, value, suffix, highlight }: StatItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className={cn(
          "font-mono text-2xl font-medium",
          highlight ? "text-accent text-glow" : "text-foreground"
        )}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {suffix && (
          <span className="font-mono text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'warning';
  label: string;
  count?: number;
}

export function StatusIndicator({ status, label, count }: StatusIndicatorProps) {
  const statusColors = {
    online: 'bg-green-500/80',
    offline: 'bg-red-500/80',
    warning: 'bg-yellow-500/80',
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={cn("w-2 h-2 rounded-full", statusColors[status])} />
        <div className={cn(
          "absolute inset-0 w-2 h-2 rounded-full animate-ping",
          statusColors[status],
          "opacity-75"
        )} />
      </div>
      <span className="font-mono text-xs text-muted-foreground">{label}</span>
      {count !== undefined && (
        <span className="font-mono text-xs text-foreground">{count.toLocaleString()}</span>
      )}
    </div>
  );
}
