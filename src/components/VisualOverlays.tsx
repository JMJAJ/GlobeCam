import { motion } from 'framer-motion';

export function ScanLinesOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 0.5 }}
      className="absolute inset-0 pointer-events-none scan-lines z-10"
    />
  );
}

export function GridOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.35 }}
      transition={{ duration: 1.5 }}
      className="absolute inset-0 pointer-events-none z-[5]"
    >
      <div className="absolute inset-0 grid-overlay" />
      <div className="absolute inset-0 radial-grid" style={{ opacity: 0.12 }} />
    </motion.div>
  );
}

export function VignetteOverlay() {
  return (
    <div 
      className="absolute inset-0 pointer-events-none z-40"
      style={{
        background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(0,0,0,0.6) 100%)',
      }}
    />
  );
}

export function CornerDecorations() {
  const corners = [
    { position: 'top-0 left-0', transform: 'rotate(0deg)' },
    { position: 'top-0 right-0', transform: 'rotate(90deg)' },
    { position: 'bottom-0 right-0', transform: 'rotate(180deg)' },
    { position: 'bottom-0 left-0', transform: 'rotate(270deg)' },
  ];

  return (
    <>
      {corners.map((corner, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
          className={`absolute ${corner.position} w-20 h-20 pointer-events-none z-10`}
          style={{ transform: corner.transform }}
        >
          <svg viewBox="0 0 80 80" className="w-full h-full">
            <path
              d="M0 20 L0 0 L20 0"
              fill="none"
              stroke="rgba(255,248,220,0.2)"
              strokeWidth="1"
            />
            <path
              d="M0 30 L0 0 L30 0"
              fill="none"
              stroke="rgba(255,248,220,0.1)"
              strokeWidth="1"
            />
          </svg>
        </motion.div>
      ))}
    </>
  );
}

export function TechLines() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {/* Horizontal lines */}
      {[20, 40, 60, 80].map((top) => (
        <motion.div
          key={`h-${top}`}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.05 }}
          transition={{ duration: 1.5, delay: 0.3 + top * 0.01 }}
          className="absolute left-0 right-0 h-px bg-foreground origin-left"
          style={{ top: `${top}%` }}
        />
      ))}
      
      {/* Vertical lines */}
      {[25, 50, 75].map((left) => (
        <motion.div
          key={`v-${left}`}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 0.03 }}
          transition={{ duration: 1.5, delay: 0.5 + left * 0.01 }}
          className="absolute top-0 bottom-0 w-px bg-foreground origin-top"
          style={{ left: `${left}%` }}
        />
      ))}
    </div>
  );
}
