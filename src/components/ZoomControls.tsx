import { motion } from 'framer-motion';
import { Plus, Minus, RotateCcw } from 'lucide-react';

interface ZoomControlsProps {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ZoomControls({ 
  zoom, 
  minZoom, 
  maxZoom, 
  onZoomIn, 
  onZoomOut, 
  onReset 
}: ZoomControlsProps) {
  const isInfiniteMax = !Number.isFinite(maxZoom);
  const zoomPercent = isInfiniteMax
    ? Math.min(100, Math.max(0, Math.round((Math.log(zoom / minZoom) / Math.log(2)) * 12)))
    : Math.round(((zoom - minZoom) / (maxZoom - minZoom)) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="flex flex-col gap-1"
    >
      {/* Zoom in */}
      <button
        onClick={onZoomIn}
        disabled={Number.isFinite(maxZoom) && zoom >= maxZoom}
        className="hud-panel w-10 h-10 flex items-center justify-center text-white/80 hover:text-white hover:bg-secondary/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Zoom In"
      >
        <Plus className="w-4 h-4" />
      </button>
      
      {/* Zoom level indicator */}
      <div className="hud-panel px-2 py-3 flex flex-col items-center gap-2">
        <div className="w-1 h-20 bg-secondary/50 rounded-full overflow-hidden relative">
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-accent/60"
            initial={{ height: 0 }}
            animate={{ height: `${zoomPercent}%` }}
            transition={{ type: 'spring', damping: 20 }}
          />
        </div>
        <span className="font-mono text-[10px] text-white/80">
          {zoomPercent}%
        </span>
      </div>
      
      {/* Zoom out */}
      <button
        onClick={onZoomOut}
        disabled={zoom <= minZoom}
        className="hud-panel w-10 h-10 flex items-center justify-center text-white/80 hover:text-white hover:bg-secondary/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Zoom Out"
      >
        <Minus className="w-4 h-4" />
      </button>
      
      {/* Reset */}
      <button
        onClick={onReset}
        className="hud-panel w-10 h-10 flex items-center justify-center text-white/80 hover:text-white hover:bg-secondary/50 transition-colors mt-1"
        title="Reset View"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
