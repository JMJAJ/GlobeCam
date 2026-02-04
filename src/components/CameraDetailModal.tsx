import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, MapPin, Building2, Radio, Calendar, Star, Link as LinkIcon, Network, Shield, Copy } from 'lucide-react';
import { CameraData } from '@/types/camera';

interface CameraDetailModalProps {
  camera: CameraData | null;
  allCameras?: CameraData[];
  onClose: () => void;
  onSelectCamera?: (camera: CameraData) => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  onCopyShareLink?: () => void;
  onDidCopy?: (label: string) => void;
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export function CameraDetailModal({ camera, allCameras, onClose, onSelectCamera, onToggleFavorite, isFavorite, onCopyShareLink, onDidCopy }: CameraDetailModalProps) {
  if (!camera) return null;

  const relatedCameras = (() => {
    if (!allCameras || !camera.network_key) return [] as CameraData[];
    return allCameras
      .filter((c) => c.id !== camera.id && c.network_key === camera.network_key)
      .slice(0, 6);
  })();

  const locationRelatedCameras = (() => {
    if (!allCameras) return [] as CameraData[];

    const round3 = (n: number) => Math.round(n * 1000) / 1000;
    const latKey = round3(camera.latitude);
    const lonKey = round3(camera.longitude);

    return allCameras
      .filter((c) => c.id !== camera.id)
      .filter((c) => c.country === camera.country)
      .filter((c) => round3(c.latitude) === latKey && round3(c.longitude) === lonKey)
      .slice(0, 6);
  })();

  const relatedSection = relatedCameras.length > 0
    ? { title: 'Same network', items: relatedCameras, showDistance: false }
    : locationRelatedCameras.length > 0
      ? { title: 'Same location', items: locationRelatedCameras, showDistance: true }
      : null;

  const canShowNetwork = !!camera.network_key;
  const canShowSource = typeof camera.source === 'string' && camera.source.trim().length > 0;
  const accessLabel = camera.access_level === 'restricted' ? 'Restricted' : 'Public';

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
                {canShowSource && (
                  <InfoItem
                    icon={<Radio className="w-3.5 h-3.5" />}
                    label="Source"
                    value={camera.source as string}
                  />
                )}
                {canShowNetwork && (
                  <InfoItem
                    icon={<Network className="w-3.5 h-3.5" />}
                    label="Network"
                    value={camera.network_key as string}
                  />
                )}
                <InfoItem
                  icon={<Shield className="w-3.5 h-3.5" />}
                  label="Access"
                  value={accessLabel}
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

              {/* Links */}
              <div className="p-3 bg-secondary/30 rounded-sm border border-border/50 space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Links
                </span>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-muted-foreground truncate">Preview</span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(camera.image_url);
                          onDidCopy?.('Preview URL');
                        } catch {
                          // ignore
                        }
                      }}
                      className="shrink-0 hud-panel corner-accents flex items-center gap-2 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-muted-foreground truncate">Source</span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(camera.page_url);
                          onDidCopy?.('Source URL');
                        } catch {
                          // ignore
                        }
                      }}
                      className="shrink-0 hud-panel corner-accents flex items-center gap-2 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              {/* Related cameras */}
              {relatedSection && (
                <div className="p-3 bg-secondary/30 rounded-sm border border-border/50">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {relatedSection.title}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {relatedSection.items.length.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {relatedSection.items.map((c) => {
                      const dist = relatedSection.showDistance
                        ? haversineKm(
                            { lat: camera.latitude, lon: camera.longitude },
                            { lat: c.latitude, lon: c.longitude }
                          )
                        : null;

                      return (
                        <button
                          key={c.id ?? `${c.page_url}|${c.image_url}`}
                          type="button"
                          onClick={() => {
                            if (!onSelectCamera) return;
                            onSelectCamera(c);
                          }}
                          className="w-full text-left hud-panel corner-accents px-3 py-2 font-mono text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                          disabled={!onSelectCamera}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate">{c.city}</span>
                            <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                              {dist !== null ? `${dist.toFixed(1)} km` : (c.source ?? 'unknown')}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-3">
                {onCopyShareLink && (
                  <button
                    type="button"
                    onClick={onCopyShareLink}
                    className="flex-1 hud-panel corner-accents flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    Share
                  </button>
                )}
                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={onToggleFavorite}
                    className="flex-1 hud-panel corner-accents flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <Star className={`w-3.5 h-3.5 ${isFavorite ? 'text-yellow-400' : ''}`} />
                    {isFavorite ? 'Unstar' : 'Star'}
                  </button>
                )}
                <a
                  href={camera.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 hud-panel corner-accents flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Source
                </a>
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
