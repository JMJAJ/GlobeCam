import { motion } from 'framer-motion';
import { Flame, Grid3x3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeatmapToggleProps {
  enabled: boolean;
  onToggle: () => void;
  className?: string;
}

export function HeatmapToggle({ enabled, onToggle, className }: HeatmapToggleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className={cn('hud-panel corner-accents', className)}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">
            Visualization
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggle}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-sm transition-all font-mono text-xs',
              !enabled
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'text-white/80 hover:text-white hover:bg-secondary/30'
            )}
          >
            <Grid3x3 className="w-3.5 h-3.5" />
            Markers
          </button>
          <button
            onClick={onToggle}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-sm transition-all font-mono text-xs',
              enabled
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'text-white/80 hover:text-white hover:bg-secondary/30'
            )}
          >
            <Flame className="w-3.5 h-3.5" />
            Heatmap
          </button>
        </div>
      </div>
    </motion.div>
  );
}
