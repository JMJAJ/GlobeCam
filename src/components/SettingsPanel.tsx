import { AnimatePresence, motion } from 'framer-motion';
import { Sliders, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  isOpen: boolean;
  autoRotateEnabled: boolean;
  autoRotateSpeed: number;
  onClose: () => void;
  onAutoRotateEnabledChange: (enabled: boolean) => void;
  onAutoRotateSpeedChange: (speed: number) => void;
}

export function SettingsPanel({
  isOpen,
  autoRotateEnabled,
  autoRotateSpeed,
  onClose,
  onAutoRotateEnabledChange,
  onAutoRotateSpeedChange,
}: SettingsPanelProps) {
  const speedLabel = `${autoRotateSpeed.toFixed(2)}°/s`;

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
              <div className="hud-panel hud-panel-glow corner-accents p-5">
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
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
