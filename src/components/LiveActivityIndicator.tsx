import { motion } from 'framer-motion';
import { Activity, Signal, Zap } from 'lucide-react';

interface LiveActivityIndicatorProps {
  online: number;
  total: number;
  dataRate?: string;
}

export function LiveActivityIndicator({ online, total}: LiveActivityIndicatorProps) {
  const uptimePercent = ((online / total) * 100).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="hud-panel corner-accents"
    >
      <div className="p-4 space-y-4">
        {/* Live indicator */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-75" />
          </div>
          <span className="font-mono text-xs uppercase tracking-wider text-white">
            {online.toLocaleString()} Cameras Online
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-white/80">
              <Signal className="w-3 h-3" />
              <span className="font-mono text-[10px] uppercase">Uptime</span>
            </div>
            <span className="font-mono text-lg text-accent text-glow">{uptimePercent}%</span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-white/80">
              <Activity className="w-3 h-3" />
              <span className="font-mono text-[10px] uppercase">Online</span>
            </div>
            <span className="font-mono text-lg text-white">{online.toLocaleString()}</span>
          </div>
        </div>

        {/* Activity bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono text-white/80 uppercase">
            <span>Network Activity</span>
            <span>Now</span>
          </div>
          <div className="h-6 bg-secondary/30 rounded-sm overflow-hidden flex items-end gap-px px-1">
            {Array.from({ length: 30 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ 
                  height: `${20 + Math.random() * 80}%`,
                }}
                transition={{ 
                  duration: 0.5, 
                  delay: i * 0.02,
                  repeat: Infinity,
                  repeatType: 'reverse',
                  repeatDelay: Math.random() * 2
                }}
                className="flex-1 bg-accent/40 rounded-t-sm"
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
