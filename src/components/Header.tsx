import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';

interface HeaderProps {
  rightSlot?: React.ReactNode;
}

export function Header({ rightSlot }: HeaderProps) {
  const startedAt = (() => {
    const v = (import.meta as any).env?.VITE_BUILD_TIME as string | undefined;
    if (v) return v;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.${pad(d.getHours())}.${pad(d.getMinutes())}`;
  })();

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-0 left-0 right-0 z-30 p-3 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Logo / Title */}
        <div className="flex items-center gap-2 sm:gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2, type: 'spring' }}
            className="relative"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-accent/50 flex items-center justify-center">
              <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
            </div>
            <div className="absolute inset-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-accent/20 animate-ping" />
          </motion.div>
          
          <div>
            <h1 className="font-mono text-base sm:text-lg font-medium text-white tracking-wider uppercase">
              Global Vision
            </h1>
            <p className="font-mono text-[9px] sm:text-[10px] text-white/80 uppercase tracking-widest">
              Surveillance Network v{startedAt}
            </p>
          </div>
        </div>

        {/* Status indicators */}
        <div className="hidden sm:flex flex-wrap items-center gap-3 sm:gap-6">
          {rightSlot}
        </div>
      </div>
    </motion.header>
  );
}
