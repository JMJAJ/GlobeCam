import { motion } from 'framer-motion';
import { Eye, Shield } from 'lucide-react';

interface HeaderProps {
  rightSlot?: React.ReactNode;
  onLogoClick?: () => void;
  isOSINTMode?: boolean;
}

export function Header({ rightSlot, onLogoClick, isOSINTMode = false }: HeaderProps) {
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
        {/* Logo / Title - Now Clickable for OSINT */}
        <button
          type="button"
          onClick={onLogoClick}
          className="flex items-center gap-2 sm:gap-3 group cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          title={isOSINTMode ? "Exit OSINT Overview" : "Open OSINT Overview"}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2, type: 'spring' }}
            className="relative"
          >
            <motion.div
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center transition-all duration-300 ${isOSINTMode
                  ? 'border-emerald-400/70 bg-emerald-400/10'
                  : 'border-accent/50 group-hover:border-accent group-hover:bg-accent/10'
                }`}
              animate={isOSINTMode ? {
                boxShadow: ['0 0 0px rgba(52, 211, 153, 0)', '0 0 20px rgba(52, 211, 153, 0.3)', '0 0 0px rgba(52, 211, 153, 0)']
              } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {isOSINTMode ? (
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              ) : (
                <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-accent group-hover:text-accent transition-colors" />
              )}
            </motion.div>
            {!isOSINTMode && (
              <div className="absolute inset-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-accent/20 animate-ping" />
            )}
            {isOSINTMode && (
              <motion.div
                className="absolute inset-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-emerald-400/50"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </motion.div>

          <div className="text-left">
            <h1 className={`font-mono text-base sm:text-lg font-medium tracking-wider uppercase transition-colors duration-300 ${isOSINTMode ? 'text-emerald-400' : 'text-white group-hover:text-accent'
              }`}>
              {isOSINTMode ? 'OSINT Mode' : 'Global Vision'}
            </h1>
            <p className="font-mono text-[9px] sm:text-[10px] text-white/80 uppercase tracking-widest">
              {isOSINTMode ? 'Intelligence Dashboard Active' : `Surveillance Network v${startedAt}`}
            </p>
          </div>
        </button>

        {/* Status indicators */}
        <div className="hidden sm:flex flex-wrap items-center gap-3 sm:gap-6">
          {rightSlot}
        </div>
      </div>
    </motion.header>
  );
}
