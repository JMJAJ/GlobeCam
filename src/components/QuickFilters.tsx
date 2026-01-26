import { motion } from 'framer-motion';
import { Filter, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface QuickFiltersProps {
  manufacturers: string[];
  selectedManufacturers: string[];
  onManufacturerToggle: (manufacturer: string) => void;
  className?: string;
}

export function QuickFilters({ 
  manufacturers, 
  selectedManufacturers, 
  onManufacturerToggle,
  className 
}: QuickFiltersProps) {
  const visibleManufacturers = manufacturers;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.6 }}
      className={cn('hud-panel corner-accents', className)}
    >
      <div className="border-b border-panel-border px-4 py-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/80 flex items-center gap-2">
          <Filter className="w-3 h-3" />
          Quick Filters
        </span>
        {selectedManufacturers.length > 0 && (
          <button
            onClick={() => selectedManufacturers.forEach(m => onManufacturerToggle(m))}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

        <div className="p-3 space-y-1.5 max-h-[200px] overflow-y-auto">
          {visibleManufacturers.map((manufacturer, index) => (
          <motion.button
            key={manufacturer}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.7 + index * 0.05 }}
            onClick={() => onManufacturerToggle(manufacturer)}
            className={cn(
              'w-full px-3 py-1.5 rounded-sm transition-all text-left font-mono text-xs',
              selectedManufacturers.includes(manufacturer)
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'text-white/80 hover:text-white hover:bg-secondary/30'
            )}
          >
            {manufacturer}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
