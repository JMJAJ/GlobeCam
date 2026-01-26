import { motion } from 'framer-motion';

export function RadarOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Radial grid rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[1, 2, 3].map((ring) => (
          <motion.div
            key={ring}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: ring * 0.2 }}
            className="absolute rounded-full border border-border/30"
            style={{
              width: `${ring * 30}%`,
              height: `${ring * 30}%`,
            }}
          />
        ))}
      </div>

      {/* Sweep line */}
      <motion.div
        className="absolute top-1/2 left-1/2 origin-center"
        style={{ width: '50%', height: 2 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      >
        <div 
          className="w-full h-full"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,248,220,0.3) 100%)',
          }}
        />
      </motion.div>

      {/* Center dot */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-2 h-2 rounded-full bg-accent/50" />
        <div className="absolute inset-0 w-2 h-2 rounded-full bg-accent animate-ping opacity-50" />
      </div>
    </div>
  );
}
