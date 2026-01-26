import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, MapPin, Building2, Radio, Calendar } from 'lucide-react';
import { CameraData } from '@/types/camera';

interface CameraDetailModalProps {
  camera: CameraData | null;
  onClose: () => void;
}

export function CameraDetailModal({ camera, onClose }: CameraDetailModalProps) {
  if (!camera) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
        
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-lg mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="hud-panel hud-panel-glow corner-accents overflow-hidden">
            {/* Header */}
            <div className="relative border-b border-panel-border">
              {/* Camera preview image */}
              <div className="relative h-48 overflow-hidden">
                <img
                  src={camera.image_url}
                  alt={camera.city}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect fill="%23111" width="400" height="200"/><text fill="%23444" x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="monospace">No Signal</text></svg>';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                
                {/* Live indicator */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <div className="relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-500 animate-ping opacity-75" />
                  </div>
                  <span className="font-mono text-xs uppercase tracking-wider text-foreground bg-background/50 px-2 py-0.5 rounded-sm backdrop-blur-sm">
                    Live Feed
                  </span>
                </div>
                
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-sm bg-background/50 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Title */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h2 className="font-mono text-lg font-medium text-foreground text-glow">
                  {camera.city}
                </h2>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                  Camera ID: {camera.id || 'CAM-UNKNOWN'}
                </p>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Location info */}
              <div className="grid grid-cols-2 gap-4">
                <InfoItem 
                  icon={<MapPin className="w-3.5 h-3.5" />}
                  label="Region"
                  value={camera.region}
                />
                <InfoItem 
                  icon={<Building2 className="w-3.5 h-3.5" />}
                  label="Country"
                  value={camera.country}
                />
                <InfoItem 
                  icon={<Radio className="w-3.5 h-3.5" />}
                  label="Manufacturer"
                  value={camera.manufacturer}
                />
                <InfoItem 
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  label="Continent"
                  value={camera.continent}
                />
              </div>
              
              {/* Coordinates */}
              <div className="p-3 bg-secondary/30 rounded-sm border border-border/50">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                  Coordinates
                </span>
                <div className="flex gap-4">
                  <span className="font-mono text-sm text-foreground">
                    Lat: {camera.latitude.toFixed(6)}°
                  </span>
                  <span className="font-mono text-sm text-foreground">
                    Lon: {camera.longitude.toFixed(6)}°
                  </span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3">
                <a
                  href={camera.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 hud-panel corner-accents flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Source
                </a>
                <button
                  onClick={onClose}
                  className="flex-1 hud-panel flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
          {label}
        </span>
        <span className="font-mono text-sm text-foreground truncate block">
          {value}
        </span>
      </div>
    </div>
  );
}
