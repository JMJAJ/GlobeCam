import { AnimatePresence, motion } from 'framer-motion';
import { Sliders, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  isOpen: boolean;
  autoRotateEnabled: boolean;
  autoRotateSpeed: number;
  showOsmTiles: boolean;
  markerSize: number;
  cloudsEnabled: boolean;
  cloudsOpacity: number;
  showCountryBorders: boolean;
  showNavigationControls: boolean;
  onClose: () => void;
  onAutoRotateEnabledChange: (enabled: boolean) => void;
  onAutoRotateSpeedChange: (speed: number) => void;
  onShowOsmTilesChange: (show: boolean) => void;
  onMarkerSizeChange: (size: number) => void;
  onCloudsEnabledChange: (enabled: boolean) => void;
  onCloudsOpacityChange: (opacity: number) => void;
  onShowCountryBordersChange: (show: boolean) => void;
  onShowNavigationControlsChange: (show: boolean) => void;
}

export function SettingsPanel({
  isOpen,
  autoRotateEnabled,
  autoRotateSpeed,
  showOsmTiles,
  markerSize,
  cloudsEnabled,
  cloudsOpacity,
  showCountryBorders,
  showNavigationControls,
  onClose,
  onAutoRotateEnabledChange,
  onAutoRotateSpeedChange,
  onShowOsmTilesChange,
  onMarkerSizeChange,
  onCloudsEnabledChange,
  onCloudsOpacityChange,
  onShowCountryBordersChange,
  onShowNavigationControlsChange,
}: SettingsPanelProps) {
  const speedLabel = `${autoRotateSpeed.toFixed(2)}°/s`;
  const markerSizeLabel = `${markerSize.toFixed(2)}x`;
  const cloudsLabel = `${Math.round(cloudsOpacity * 100)}%`;

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

                  <div className="flex items-start justify-between gap-4">
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
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Country borders
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Show country borders overlay on the globe.
                      </p>
                    </div>
                    <Switch
                      checked={showCountryBorders}
                      onCheckedChange={onShowCountryBordersChange}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Heading & tilt controls
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Show compass and tilt controls.
                      </p>
                    </div>
                    <Switch
                      checked={showNavigationControls}
                      onCheckedChange={onShowNavigationControlsChange}
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

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Clouds
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Live cloud coverage overlay.
                      </p>
                    </div>
                    <Switch
                      checked={cloudsEnabled}
                      onCheckedChange={onCloudsEnabledChange}
                    />
                  </div>

                  <div className={cn("space-y-3", !cloudsEnabled && "opacity-50")}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Clouds opacity
                      </span>
                      <span className="font-mono text-xs text-foreground">
                        {cloudsLabel}
                      </span>
                    </div>
                    <Slider
                      value={[cloudsOpacity]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={(value) => onCloudsOpacityChange(value[0])}
                      disabled={!cloudsEnabled}
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
