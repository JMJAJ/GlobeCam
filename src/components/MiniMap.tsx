import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface MiniMapProps {
  rotation: [number, number];
  className?: string;
}

export function MiniMap({ rotation, className }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 120;
    const height = 80;
    canvas.width = width;
    canvas.height = height;

    // Clear
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);

    // Draw simplified world outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // Draw center crosshair indicating current view
    const centerX = width / 2;
    const centerY = height / 2;
    
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 5, centerY);
    ctx.lineTo(centerX + 5, centerY);
    ctx.moveTo(centerX, centerY - 5);
    ctx.lineTo(centerX, centerY + 5);
    ctx.stroke();

    // Draw coordinates
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '8px monospace';
    ctx.fillText(`${rotation[0].toFixed(1)}°`, 5, height - 5);
    ctx.fillText(`${rotation[1].toFixed(1)}°`, width - 30, height - 5);

  }, [rotation]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.8 }}
      className={className}
    >
      <div className="hud-panel p-2">
        <div className="mb-1">
          <span className="font-mono text-[9px] uppercase tracking-wider text-white/80">
            Navigator
          </span>
        </div>
        <canvas 
          ref={canvasRef}
          className="w-full h-auto border border-border/30 rounded-sm"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    </motion.div>
  );
}
