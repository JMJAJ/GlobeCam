import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ParallaxProvider } from '@/components/ParallaxProvider';
import { GlobeVisualization } from '@/components/GlobeVisualization';
import { Header } from '@/components/Header';
import { StatsDisplay } from '@/components/StatsDisplay';
import { LiveActivityIndicator } from '@/components/LiveActivityIndicator';
import { RegionFilters } from '@/components/RegionFilters';
import { CommandSearch } from '@/components/CommandSearch';
import { CameraDetailModal } from '@/components/CameraDetailModal';
import { QuickFilters } from '@/components/QuickFilters';
import { MiniMap } from '@/components/MiniMap';
import {
  ScanLinesOverlay,
  GridOverlay,
  VignetteOverlay,
  CornerDecorations,
  TechLines
} from '@/components/VisualOverlays';
import cameraDataRaw from '@/data/camera_data.json';
import { CameraData } from '@/types/camera';
import { Search } from 'lucide-react';

// Helper function to determine continent from country
function getContinent(country: string): string {
  const continentMap: Record<string, string> = {
    // North America
    'United States': 'North America',
    'Canada': 'North America',
    'Mexico': 'North America',
    'Guatemala': 'North America',
    'Honduras': 'North America',
    'El Salvador': 'North America',
    'Nicaragua': 'North America',
    'Costa Rica': 'North America',
    'Panama': 'North America',
    'Belize': 'North America',
    'Cuba': 'North America',
    'Jamaica': 'North America',
    'Haiti': 'North America',
    'Dominican Republic': 'North America',
    'Bahamas': 'North America',
    'Trinidad and Tobago': 'North America',
    'Barbados': 'North America',
    'Grenada': 'North America',
    'Saint Lucia': 'North America',
    'Saint Vincent and the Grenadines': 'North America',
    'Antigua and Barbuda': 'North America',
    'Dominica': 'North America',
    'Saint Kitts and Nevis': 'North America',

    // South America
    'Brazil': 'South America',
    'Argentina': 'South America',
    'Chile': 'South America',
    'Colombia': 'South America',
    'Peru': 'South America',
    'Venezuela': 'South America',
    'Ecuador': 'South America',
    'Bolivia': 'South America',
    'Paraguay': 'South America',
    'Uruguay': 'South America',
    'Guyana': 'South America',
    'Suriname': 'South America',
    'French Guiana': 'South America',

    // Europe
    'United Kingdom': 'Europe',
    'Germany': 'Europe',
    'France': 'Europe',
    'Italy': 'Europe',
    'Spain': 'Europe',
    'Netherlands': 'Europe',
    'Belgium': 'Europe',
    'Switzerland': 'Europe',
    'Austria': 'Europe',
    'Poland': 'Europe',
    'Romania': 'Europe',
    'Czech Republic': 'Europe',
    'Hungary': 'Europe',
    'Sweden': 'Europe',
    'Norway': 'Europe',
    'Denmark': 'Europe',
    'Finland': 'Europe',
    'Russia': 'Europe',
    'Ukraine': 'Europe',
    'Portugal': 'Europe',
    'Greece': 'Europe',
    'Ireland': 'Europe',
    'Iceland': 'Europe',
    'Croatia': 'Europe',
    'Serbia': 'Europe',
    'Bulgaria': 'Europe',
    'Slovakia': 'Europe',
    'Slovenia': 'Europe',
    'Lithuania': 'Europe',
    'Latvia': 'Europe',
    'Estonia': 'Europe',
    'Bosnia and Herzegovina': 'Europe',
    'Albania': 'Europe',
    'North Macedonia': 'Europe',
    'Montenegro': 'Europe',
    'Luxembourg': 'Europe',
    'Malta': 'Europe',
    'Cyprus': 'Europe',
    'Belarus': 'Europe',
    'Moldova': 'Europe',
    'Monaco': 'Europe',
    'Liechtenstein': 'Europe',
    'San Marino': 'Europe',
    'Vatican City': 'Europe',
    'Andorra': 'Europe',
    'Kosovo': 'Europe',

    // Asia
    'China': 'Asia',
    'Japan': 'Asia',
    'India': 'Asia',
    'South Korea': 'Asia',
    'Indonesia': 'Asia',
    'Thailand': 'Asia',
    'Vietnam': 'Asia',
    'Malaysia': 'Asia',
    'Singapore': 'Asia',
    'Philippines': 'Asia',
    'Taiwan': 'Asia',
    'Pakistan': 'Asia',
    'Bangladesh': 'Asia',
    'Myanmar': 'Asia',
    'Cambodia': 'Asia',
    'Laos': 'Asia',
    'Nepal': 'Asia',
    'Sri Lanka': 'Asia',
    'Afghanistan': 'Asia',
    'Kazakhstan': 'Asia',
    'Uzbekistan': 'Asia',
    'Turkmenistan': 'Asia',
    'Kyrgyzstan': 'Asia',
    'Tajikistan': 'Asia',
    'Mongolia': 'Asia',
    'North Korea': 'Asia',
    'Brunei': 'Asia',
    'Bhutan': 'Asia',
    'Maldives': 'Asia',
    'Timor-Leste': 'Asia',
    'Hong Kong': 'Asia',
    'Macau': 'Asia',

    // Middle East
    'Saudi Arabia': 'Asia',
    'United Arab Emirates': 'Asia',
    'Israel': 'Asia',
    'Jordan': 'Asia',
    'Lebanon': 'Asia',
    'Syria': 'Asia',
    'Iraq': 'Asia',
    'Iran': 'Asia',
    'Turkey': 'Asia',
    'Yemen': 'Asia',
    'Oman': 'Asia',
    'Kuwait': 'Asia',
    'Qatar': 'Asia',
    'Bahrain': 'Asia',
    'Palestine': 'Asia',
    'Armenia': 'Asia',
    'Azerbaijan': 'Asia',
    'Georgia': 'Asia',

    // Africa
    'South Africa': 'Africa',
    'Egypt': 'Africa',
    'Nigeria': 'Africa',
    'Kenya': 'Africa',
    'Ethiopia': 'Africa',
    'Ghana': 'Africa',
    'Tanzania': 'Africa',
    'Uganda': 'Africa',
    'Algeria': 'Africa',
    'Morocco': 'Africa',
    'Angola': 'Africa',
    'Mozambique': 'Africa',
    'Madagascar': 'Africa',
    'Cameroon': 'Africa',
    'Ivory Coast': 'Africa',
    'Niger': 'Africa',
    'Burkina Faso': 'Africa',
    'Mali': 'Africa',
    'Malawi': 'Africa',
    'Zambia': 'Africa',
    'Somalia': 'Africa',
    'Senegal': 'Africa',
    'Chad': 'Africa',
    'Zimbabwe': 'Africa',
    'Guinea': 'Africa',
    'Rwanda': 'Africa',
    'Benin': 'Africa',
    'Tunisia': 'Africa',
    'Burundi': 'Africa',
    'South Sudan': 'Africa',
    'Togo': 'Africa',
    'Sierra Leone': 'Africa',
    'Libya': 'Africa',
    'Liberia': 'Africa',
    'Mauritania': 'Africa',
    'Eritrea': 'Africa',
    'Gambia': 'Africa',
    'Botswana': 'Africa',
    'Namibia': 'Africa',
    'Gabon': 'Africa',
    'Lesotho': 'Africa',
    'Guinea-Bissau': 'Africa',
    'Equatorial Guinea': 'Africa',
    'Mauritius': 'Africa',
    'Eswatini': 'Africa',
    'Djibouti': 'Africa',
    'Comoros': 'Africa',
    'Cape Verde': 'Africa',
    'Sao Tome and Principe': 'Africa',
    'Seychelles': 'Africa',
    'Sudan': 'Africa',
    'Congo': 'Africa',
    'Democratic Republic of the Congo': 'Africa',
    'Central African Republic': 'Africa',

    // Oceania
    'Australia': 'Oceania',
    'New Zealand': 'Oceania',
    'Papua New Guinea': 'Oceania',
    'Fiji': 'Oceania',
    'Solomon Islands': 'Oceania',
    'Vanuatu': 'Oceania',
    'Samoa': 'Oceania',
    'Kiribati': 'Oceania',
    'Micronesia': 'Oceania',
    'Tonga': 'Oceania',
    'Palau': 'Oceania',
    'Marshall Islands': 'Oceania',
    'Nauru': 'Oceania',
    'Tuvalu': 'Oceania',
  };
  return continentMap[country] || 'Other';
}

// Get camera statistics
function getCameraStats(cameras: CameraData[]) {
  const byContinent: Record<string, number> = {};
  const byCountry: Record<string, number> = {};

  cameras.forEach(cam => {
    byContinent[cam.continent] = (byContinent[cam.continent] || 0) + 1;
    byCountry[cam.country] = (byCountry[cam.country] || 0) + 1;
  });

  return {
    total: cameras.length,
    byContinent,
    byCountry,
    online: Math.floor(cameras.length * 0.94),
  };
}

export default function Index() {
  // Load and process cameras from JSON
  const allCameras = useMemo(() => {
    return cameraDataRaw.map((cam: any, index: number) => ({
      id: `cam-${String(index).padStart(5, '0')}`,
      latitude: cam.latitude,
      longitude: cam.longitude,
      continent: getContinent(cam.country),
      country: cam.country,
      city: cam.city,
      region: cam.region,
      manufacturer: cam.manufacturer,
      image_url: cam.image_url,
      page_url: cam.page_url
    })) as CameraData[];
  }, []);

  const stats = useMemo(() => getCameraStats(allCameras), [allCameras]);

  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<CameraData | null>(null);
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>([]);
  const [currentRotation, setCurrentRotation] = useState<[number, number]>([0, 0]);
  const [currentProgress, setCurrentProgress] = useState(100);
  const [fps, setFps] = useState(60);
  const [isConnected, setIsConnected] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Get unique manufacturers
  const manufacturers = useMemo(() => {
    const uniqueMfr = new Set(allCameras.map(cam => cam.manufacturer).filter(m => m && m !== 'N/A'));
    return Array.from(uniqueMfr).sort();
  }, [allCameras]);

  // Filter cameras by selected regions and manufacturers
  const filteredCameras = useMemo(() => {
    let filtered = allCameras;

    if (selectedRegions.length > 0) {
      filtered = filtered.filter(cam => selectedRegions.includes(cam.continent));
    }

    if (selectedManufacturers.length > 0) {
      filtered = filtered.filter(cam => selectedManufacturers.includes(cam.manufacturer));
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery.length > 0) {
      filtered = filtered.filter(cam => {
        const haystack = [
          cam.id,
          cam.city,
          cam.country,
          cam.region,
          cam.continent,
          cam.manufacturer,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    }

    return filtered;
  }, [allCameras, selectedRegions, selectedManufacturers, searchQuery]);

  // Get regions for filter
  const regions = useMemo(() => {
    return Object.entries(stats.byContinent)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [stats]);

  const handleRegionToggle = useCallback((region: string) => {
    setSelectedRegions(prev =>
      prev.includes(region)
        ? prev.filter(r => r !== region)
        : [...prev, region]
    );
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleCameraSelect = useCallback((camera: CameraData | null) => {
    setSelectedCamera(camera);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedCamera(null);
  }, []);

  const handleManufacturerToggle = useCallback((manufacturer: string) => {
    setSelectedManufacturers(prev =>
      prev.includes(manufacturer)
        ? prev.filter(m => m !== manufacturer)
        : [...prev, manufacturer]
    );
  }, []);



  const handleSearchOpen = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const handleSearchClose = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const handleSearchRegion = useCallback((region: string) => {
    setSearchQuery(region);
  }, []);

  return (
    <ParallaxProvider>
      <div className="relative w-screen h-screen bg-background overflow-hidden">
        {/* Background layers */}
        <GridOverlay />
        <TechLines />

        {/* Header */}
        <Header />

        {/* Main globe container */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full h-full"
          >
            <GlobeVisualization
              cameras={filteredCameras}
              onCameraSelect={handleCameraSelect}
              onRotationChange={setCurrentRotation}
              onProgressChange={setCurrentProgress}
            />
          </motion.div>
        </div>

        {/* HUD Panels */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-y-24 left-6 right-6 flex justify-between gap-6">
            <div className="pointer-events-auto w-[260px] max-w-[35vw] flex flex-col gap-4 max-h-[calc(100vh-140px)] overflow-y-auto">
              <StatsDisplay
                totalCameras={stats.total}
                visibleCameras={filteredCameras.length}
                continents={Object.keys(stats.byContinent).length}
                countries={Object.keys(stats.byCountry).length}
              />
              <RegionFilters
                regions={regions}
                selectedRegions={selectedRegions}
                onRegionToggle={handleRegionToggle}
              />
              <QuickFilters
                manufacturers={manufacturers}
                selectedManufacturers={selectedManufacturers}
                onManufacturerToggle={handleManufacturerToggle}
              />
            </div>

            <div className="pointer-events-auto w-[260px] max-w-[35vw] flex flex-col gap-4 max-h-[calc(100vh-140px)] overflow-y-auto">
              <LiveActivityIndicator
                online={stats.online}
                total={stats.total}
              />
              <button
                type="button"
                onClick={handleSearchOpen}
                className="hud-panel corner-accents flex items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              >
                <Search className="w-4 h-4" />
                Browse Cameras
              </button>
              <div className="mt-auto">
                <MiniMap rotation={currentRotation} />
              </div>
            </div>
          </div>
        </div>

        <CommandSearch
          cameras={allCameras}
          isOpen={isSearchOpen}
          onClose={handleSearchClose}
          onSelectCamera={(camera) => {
            handleCameraSelect(camera);
            handleSearch('');
          }}
          onSelectRegion={handleSearchRegion}
        />

        {/* Overlays */}
        <CornerDecorations />
        <ScanLinesOverlay />
        <VignetteOverlay />

        {/* Footer status bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="absolute bottom-0 left-0 right-0 z-20"
        >
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/30 bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-6">
              <span className="font-mono text-[10px] text-white uppercase tracking-wider">
                Lon: {currentRotation[0].toFixed(2)}° | Lat: {currentRotation[1].toFixed(2)}°
              </span>
              <span className="font-mono text-[10px] text-white uppercase tracking-wider">
                View: {currentProgress === 100 ? 'Flat Map' : currentProgress === 0 ? 'Globe' : 'Transitioning'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-[10px] text-white uppercase tracking-wider">
                Cameras: {filteredCameras.length.toLocaleString()} / {stats.total.toLocaleString()}
              </span>
              <span className={`font-mono text-[10px] uppercase tracking-wider ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                ● {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Camera Detail Modal */}
        <CameraDetailModal
          camera={selectedCamera}
          onClose={handleCloseModal}
        />
      </div>
    </ParallaxProvider>
  );
}
