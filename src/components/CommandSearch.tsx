import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, MapPin, Grid, List, Filter,
  ChevronRight, Circle, Activity, Globe, LayoutGrid
} from 'lucide-react';
import { CameraData } from '@/types/camera';
import { cn } from '@/lib/utils';

interface CommandSearchProps {
  cameras: CameraData[];
  isOpen: boolean;
  onClose: () => void;
  onSelectCamera: (camera: CameraData) => void;
  onSelectRegion?: (region: string) => void;
}

export function CommandSearch({
  cameras,
  isOpen,
  onClose,
  onSelectCamera,
}: CommandSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedContinent, setSelectedContinent] = useState<string | null>('All Cameras');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedContinent('All Cameras');
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Derive stats and filters
  const { filteredCameras, continents } = useMemo(() => {
    const uniqueContinents = new Set(cameras.map(c => c.continent).filter(Boolean));
    const stats: Record<string, number> = { 'All Cameras': cameras.length };

    cameras.forEach(cam => {
      if (cam.continent) {
        stats[cam.continent] = (stats[cam.continent] || 0) + 1;
      }
    });

    const sortedContinents = Array.from(uniqueContinents).sort();

    let filtered = cameras;

    // Filter by Continent
    if (selectedContinent && selectedContinent !== 'All Cameras') {
      filtered = filtered.filter(cam => cam.continent === selectedContinent);
    }

    // Filter by Search
    const lowerQuery = query.toLowerCase().trim();
    if (lowerQuery) {
      const tokens = lowerQuery.split(/\s+/).filter(Boolean);
      filtered = filtered.filter(cam => {
        const text = [
          cam.city,
          cam.country,
          cam.region,
          cam.manufacturer,
          cam.id
        ].filter(Boolean).join(' ').toLowerCase();
        return tokens.every(token => text.includes(token));
      });
    }

    return { filteredCameras: filtered, continents: sortedContinents, stats };
  }, [cameras, query, selectedContinent]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* BACKDROP */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* WINDOW CONTAINER */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-[1600px] h-full max-h-[90vh] bg-[#0a0a0a]/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
            >
              {/* HEADER SECTION */}
              <div className="flex-none px-4 py-4 sm:px-6 sm:py-5 border-b border-white/10 bg-black/20">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 mb-4 sm:mb-6">
                  <div>
                    <h1 className="text-2xl sm:text-4xl font-light tracking-tight text-white mb-1 sm:mb-2">
                      Browse <span className="font-semibold text-white">Cameras</span>
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-[11px] sm:text-sm font-mono text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        {cameras.length.toLocaleString()} Cameras Online
                      </span>
                      <span>•</span>
                      <span>1 Viewer (just you bro)</span>
                      <span>•</span>
                      <span>Live Feed Access</span>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-muted-foreground" />
                  </button>
                </div>

                {/* SEARCH BAR & TOOLBAR */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-secondary/30 border border-white/10 rounded-lg text-sm font-mono text-muted-foreground hover:text-white cursor-pointer transition-colors">
                    <Filter className="w-4 h-4" />
                    <span>Filters</span>
                  </div>

                  <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-white transition-colors" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search cameras around the world..."
                      className="w-full bg-secondary/20 border border-white/10 rounded-lg py-3 pl-11 pr-4 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 focus:bg-secondary/30 transition-all"
                      autoFocus
                    />
                  </div>

                  <div className="self-end sm:self-auto flex items-center gap-1 bg-secondary/20 p-1 rounded-lg border border-white/5">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        "p-2 rounded-md transition-all",
                        viewMode === 'grid' ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white"
                      )}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={cn(
                        "p-2 rounded-md transition-all",
                        viewMode === 'list' ? "bg-white/10 text-white shadow-sm" : "text-muted-foreground hover:text-white"
                      )}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* MAIN CONTENT AREA */}
              <div className="flex-1 flex overflow-hidden">
                {/* SIDEBAR FILTERS */}
                <div className="w-64 flex-none border-r border-border/40 overflow-y-auto p-4 hidden md:block">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3 px-2">
                        Regions
                      </h3>
                      <div className="space-y-1">
                        <SidebarItem
                          label="All Cameras"
                          count={cameras.length}
                          isActive={selectedContinent === 'All Cameras'}
                          onClick={() => setSelectedContinent('All Cameras')}
                          icon={<Globe className="w-3.5 h-3.5" />}
                        />
                        {continents.map(continent => (
                          <SidebarItem
                            key={continent}
                            label={continent}
                            count={cameras.filter(c => c.continent === continent).length}
                            isActive={selectedContinent === continent}
                            onClick={() => setSelectedContinent(continent)}
                            icon={<Activity className="w-3.5 h-3.5" />}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RESULTS GRID */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-light text-white">
                      {selectedContinent} <span className="text-muted-foreground text-sm ml-2">{filteredCameras.length} results</span>
                    </h2>
                  </div>

                  {filteredCameras.length > 0 ? (
                    <div className={cn(
                      "grid gap-4 md:gap-6",
                      viewMode === 'grid'
                        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                        : "grid-cols-1"
                    )}>
                      {filteredCameras.slice(0, 100).map((camera) => (
                        <CameraCard
                          key={camera.id}
                          camera={camera}
                          viewMode={viewMode}
                          onClick={() => {
                            onSelectCamera(camera);
                            onClose();
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                      <Search className="w-12 h-12 mb-4 opacity-20" />
                      <p>No cameras found matching your criteria</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// Helper Components

function SidebarItem({ label, count, isActive, onClick, icon }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all group",
        isActive
          ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] border border-white/5"
          : "text-muted-foreground hover:text-white hover:bg-white/5"
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn("opacity-70 group-hover:opacity-100", isActive && "text-accent opacity-100")}>
          {icon}
        </span>
        <span className="font-medium tracking-wide">{label}</span>
      </div>
      <span className="text-[10px] font-mono bg-black/20 px-1.5 py-0.5 rounded text-muted-foreground group-hover:text-white">
        {count}
      </span>
    </button>
  );
}

function CameraCard({ camera, onClick, viewMode }: { camera: CameraData, onClick: () => void, viewMode: 'grid' | 'list' }) {
  const [imageError, setImageError] = useState(false);

  if (viewMode === 'list') {
    return (
      <motion.div
        layoutId={camera.id}
        whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.03)' }}
        onClick={onClick}
        className="group flex gap-4 p-3 rounded-lg border border-white/5 bg-secondary/10 hover:border-white/20 cursor-pointer transition-colors"
      >
        <div className="w-32 aspect-video rounded-md overflow-hidden bg-black/50 flex-none relative">
          <img
            src={imageError ? `https://placehold.co/400x225/1a1a1a/666?text=Signal+Lost` : camera.image_url}
            alt={camera.city}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            onError={() => setImageError(true)}
            loading="lazy"
          />
          <div className="absolute top-1 right-1 bg-red-500/80 backdrop-blur-sm text-[8px] font-bold px-1.5 py-0.5 rounded text-white flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> LIVE
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <h3 className="text-white font-medium truncate mb-1">{camera.city}, {camera.country}</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {camera.region}</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>{camera.manufacturer}</span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layoutId={camera.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={onClick}
      className="group relative bg-secondary/10 border border-white/5 rounded-xl overflow-hidden hover:border-accent/30 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] cursor-pointer transition-all duration-300"
    >
      {/* THUMBNAIL */}
      <div className="aspect-video relative overflow-hidden bg-black/40">
        <img
          src={imageError ? `https://placehold.co/600x340/1a1a1a/666?text=No+Signal` : camera.image_url}
          alt={camera.city}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
          onError={() => setImageError(true)}
          loading="lazy"
        />

        {/* OVERLAYS */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80" />

        {/* BADGES */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          <div className="bg-red-500/90 backdrop-blur-sm shadow-sm text-[9px] font-bold tracking-wider px-2 py-1 rounded-sm text-white flex items-center gap-1.5 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live
          </div>

          <div className="bg-black/60 backdrop-blur-md px-1.5 py-1 rounded text-[10px] font-mono text-white/80 border border-white/10">
            JPG
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-4 relative">
        <h3 className="text-white font-medium text-sm truncate pr-2 group-hover:text-accent transition-colors">
          {camera.city}, {camera.country}
        </h3>

        <div className="mt-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono truncate">
            <MapPin className="w-3 h-3 flex-none" />
            <span className="truncate">{camera.region || camera.continent}</span>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-mono pt-2 border-t border-white/5 mt-2">
            <Activity className="w-3 h-3 flex-none" />
            <span className="truncate">ID: {camera.id} • {camera.manufacturer}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
