import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface RegionFiltersProps {
  regions: { name: string; count: number }[];
  selectedRegions: string[];
  onRegionToggle: (region: string) => void;
  className?: string;
}

export function RegionFilters({ 
  regions, 
  selectedRegions, 
  onRegionToggle,
  className 
}: RegionFiltersProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn('hud-panel corner-accents', className)}
    >
      <div className="border-b border-panel-border px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/80">
          Regions
        </span>
      </div>
      <div className="p-3 space-y-1 max-h-[200px] overflow-y-auto">
        {regions.map((region, index) => (
          <motion.button
            key={region.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.5 + index * 0.05 }}
            onClick={() => onRegionToggle(region.name)}
            className={cn(
              'w-full flex items-center justify-between px-2 py-1.5 rounded-sm transition-colors',
              selectedRegions.includes(region.name)
                ? 'bg-accent/20 text-accent'
                : 'text-white hover:text-accent hover:bg-secondary/30'
            )}
          >
            <span className="font-mono text-xs truncate">{region.name}</span>
            <span className="font-mono text-[10px] opacity-60">
              {region.count.toLocaleString()}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
