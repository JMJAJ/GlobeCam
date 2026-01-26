import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchPanelProps {
  onSearch?: (query: string) => void;
  className?: string;
}

export function SearchPanel({ onSearch, className }: SearchPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(query);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn('relative', className)}
    >
      <div className="hud-panel corner-accents">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <motion.div
            animate={{ width: isExpanded ? 200 : 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cameras..."
              className="w-full bg-transparent border-none outline-none font-mono text-xs text-foreground placeholder:text-muted-foreground"
              onFocus={() => setIsExpanded(true)}
            />
          </motion.div>
          {!isExpanded && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              Search
            </button>
          )}
          {isExpanded && query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setIsExpanded(false);
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </form>
      </div>
    </motion.div>
  );
}