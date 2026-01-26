import { AnimatePresence, motion } from 'framer-motion';
import { Sliders, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  isOpen: boolean;
  autoRotateEnabled: boolean;
  autoRotateSpeed: number;
  maxVisibleNodes: number;
  maxVisibleNodesMax: number;
  mapVariant: 'outline' | 'openstreetmap';
  showOsmTiles: boolean;
  markerSize: number;
  showClusterLabels: boolean;
  glowIntensity: number;
  onClose: () => void;
  onAutoRotateEnabledChange: (enabled: boolean) => void;
  onAutoRotateSpeedChange: (speed: number) => void;
  onMaxVisibleNodesChange: (maxNodes: number) => void;
  onMapVariantChange: (variant: 'outline' | 'openstreetmap') => void;
  onShowOsmTilesChange: (show: boolean) => void;
  onMarkerSizeChange: (size: number) => void;
  onShowClusterLabelsChange: (show: boolean) => void;
  onGlowIntensityChange: (intensity: number) => void;
}

export function SettingsPanel({
  isOpen,
  autoRotateEnabled,
  autoRotateSpeed,
  maxVisibleNodes,
  maxVisibleNodesMax,
  mapVariant,
  showOsmTiles,
  markerSize,
  showClusterLabels,
  glowIntensity,
  onClose,
  onAutoRotateEnabledChange,
  onAutoRotateSpeedChange,
  onMaxVisibleNodesChange,
  onMapVariantChange,
  onShowOsmTilesChange,
  onMarkerSizeChange,
  onShowClusterLabelsChange,
  onGlowIntensityChange,
}: SettingsPanelProps) {
  const speedLabel = `${autoRotateSpeed.toFixed(2)}°/s`;
  const nodesLabel = `${Math.round(maxVisibleNodes).toLocaleString()} nodes`;
  const markerSizeLabel = `${markerSize.toFixed(2)}x`;
  const glowLabel = `${glowIntensity.toFixed(2)}x`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-auto w-full max-w-md"
            >
              <div className="hud-panel hud-panel-glow corner-accents p-5 max-h-[85vh] overflow-y-auto sm:max-h-none">
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-muted-foreground" />
                    <span className="font-mono text-xs uppercase tracking-wider text-foreground">
                      Settings
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    aria-label="Close settings"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-4 space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Auto-rotation
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Rotate the globe automatically when idle.
                      </p>
                    </div>
                    <Switch
                      checked={autoRotateEnabled}
                      onCheckedChange={onAutoRotateEnabledChange}
                    />
                  </div>

                  <div className={cn("space-y-3", !autoRotateEnabled && "opacity-50")}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Speed
                      </span>
                      <span className="font-mono text-xs text-foreground">
                        {speedLabel}
                      </span>
                    </div>
                    <Slider
                      value={[autoRotateSpeed]}
                      min={0.05}
                      max={10}
                      step={0.05}
                      onValueChange={(value) => onAutoRotateSpeedChange(value[0])}
                      disabled={!autoRotateEnabled}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Max nodes
                      </span>
                      <span className="font-mono text-xs text-foreground">
                        {nodesLabel}
                      </span>
                    </div>
                    <Slider
                      value={[maxVisibleNodes]}
                      min={100}
                      max={Math.max(100, maxVisibleNodesMax, maxVisibleNodes)}
                      step={50}
                      onValueChange={(value) => onMaxVisibleNodesChange(value[0])}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Map style
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-sm border border-border/40 bg-secondary/10 p-1">
                      <button
                        type="button"
                        onClick={() => onMapVariantChange('outline')}
                        className={cn(
                          "px-3 py-1 rounded-sm font-mono text-[10px] uppercase tracking-wider transition-colors",
                          mapVariant === 'outline'
                            ? "bg-secondary/60 text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Outline
                      </button>
                      <button
                        type="button"
                        onClick={() => onMapVariantChange('openstreetmap')}
                        className={cn(
                          "px-3 py-1 rounded-sm font-mono text-[10px] uppercase tracking-wider transition-colors",
                          mapVariant === 'openstreetmap'
                            ? "bg-secondary/60 text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        OSM
                      </button>
                    </div>
                  </div>

                  <div className={cn("flex items-start justify-between gap-4", mapVariant !== 'openstreetmap' && "opacity-50")}>
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        OSM tiles
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Toggle OpenStreetMap tiles on/off.
                      </p>
                    </div>
                    <Switch
                      checked={showOsmTiles}
                      onCheckedChange={onShowOsmTilesChange}
                      disabled={mapVariant !== 'openstreetmap'}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Marker size
                      </span>
                      <span className="font-mono text-xs text-foreground">
                        {markerSizeLabel}
                      </span>
                    </div>
                    <Slider
                      value={[markerSize]}
                      min={0.6}
                      max={2.5}
                      step={0.05}
                      onValueChange={(value) => onMarkerSizeChange(value[0])}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Glow intensity
                      </span>
                      <span className="font-mono text-xs text-foreground">
                        {glowLabel}
                      </span>
                    </div>
                    <Slider
                      value={[glowIntensity]}
                      min={0}
                      max={2.5}
                      step={0.05}
                      onValueChange={(value) => onGlowIntensityChange(value[0])}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Cluster labels
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Show counts inside cluster markers.
                      </p>
                    </div>
                    <Switch
                      checked={showClusterLabels}
                      onCheckedChange={onShowClusterLabelsChange}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
