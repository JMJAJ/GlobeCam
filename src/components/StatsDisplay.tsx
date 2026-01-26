import { motion } from 'framer-motion';
import { Globe, Camera, Map, Layers } from 'lucide-react';

interface StatsDisplayProps {
  totalCameras: number;
  visibleCameras: number;
  continents: number;
  countries: number;
}

export function StatsDisplay({ 
  totalCameras, 
  visibleCameras, 
  continents, 
  countries 
}: StatsDisplayProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="hud-panel hud-panel-glow corner-accents"
    >
      <div className="p-4">
        {/* Main count */}
        <div className="flex items-baseline gap-2 mb-4">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="font-mono text-3xl sm:text-4xl font-medium text-white text-glow"
          >
            {totalCameras.toLocaleString()}
          </motion.span>
          <span className="font-mono text-xs uppercase tracking-wider text-white">
            cameras
          </span>
        </div>

        {/* Sub stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox 
            icon={<Camera className="w-3.5 h-3.5" />}
            label="Visible"
            value={visibleCameras}
            delay={0.4}
          />
          <StatBox 
            icon={<Globe className="w-3.5 h-3.5" />}
            label="Continents"
            value={continents}
            delay={0.5}
          />
          <StatBox 
            icon={<Map className="w-3.5 h-3.5" />}
            label="Countries"
            value={countries}
            delay={0.6}
          />
          <StatBox 
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Clusters"
            value={Math.ceil(visibleCameras / 10)}
            delay={0.7}
          />
        </div>
      </div>
    </motion.div>
  );
}

interface StatBoxProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  delay: number;
}

function StatBox({ icon, label, value, delay }: StatBoxProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="flex items-center gap-2 p-2 bg-secondary/20 rounded-sm"
    >
      <div className="text-white">{icon}</div>
      <div className="flex flex-col">
        <span className="font-mono text-sm text-white">{value.toLocaleString()}</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-white/80">{label}</span>
      </div>
    </motion.div>
  );
}
