import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ParallaxProvider } from '@/components/ParallaxProvider';
import { CesiumGlobe, type CesiumGlobeRef } from '@/components/CesiumGlobe';
import { Header } from '@/components/Header';
import { StatsDisplay } from '@/components/StatsDisplay';
import { LiveActivityIndicator } from '@/components/LiveActivityIndicator';
import { QuickFilters } from '@/components/QuickFilters';
import { RegionFilters } from '@/components/RegionFilters';
import { CommandSearch } from '@/components/CommandSearch';
import { CameraDetailModal } from '@/components/CameraDetailModal';
import { SettingsPanel } from '@/components/SettingsPanel';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  ScanLinesOverlay,
  GridOverlay,
  VignetteOverlay,
  CornerDecorations,
  TechLines
} from '@/components/VisualOverlays';
import { CameraData } from '@/types/camera';
import { Layers, Search, Sliders, X, Star, Compass } from 'lucide-react';

const FAVORITES_STORAGE_KEY = 'globecam:favorites';
const RECENTS_STORAGE_KEY = 'globecam:recents';
const SETTINGS_STORAGE_KEY = 'globecam:settings';

async function fetchCameraData(): Promise<any[]> {
  const isDev = import.meta.env.DEV;
  const res = await fetch('/camera_data.min.v2.json', {
    cache: isDev ? 'no-store' : 'force-cache',
    headers: {
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to load camera data (${res.status})`);
  }
  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error('Camera data JSON is not an array');
  }
  return json;
}

function readStringArrayStorage(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) return parsed;
    return [];
  } catch {
    return [];
  }

}

function readSettingsStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeSettingsStorage<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function writeStringArrayStorage(key: string, value: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function parseCsvParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => decodeURIComponent(v.trim()))
    .filter(Boolean);
}

function serializeCsvParam(values: string[]): string {
  return values.map((v) => encodeURIComponent(v)).join(',');
}

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

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function computeCameraId(cam: any, index: number): string {
  const page = typeof cam?.page_url === 'string' ? cam.page_url : '';
  const image = typeof cam?.image_url === 'string' ? cam.image_url : '';
  const key = `${page}|${image}`;
  if (key !== '|') return `cam-${fnv1a32(key)}`;
  return `cam-${String(index).padStart(5, '0')}`;
}

function computeNetworkKey(cam: any): string | null {
  const page = typeof cam?.page_url === 'string' ? cam.page_url : '';
  const image = typeof cam?.image_url === 'string' ? cam.image_url : '';
  const source = typeof cam?.source === 'string' ? cam.source : '';

  const url = page || image;
  if (!url) return null;

  const src = (source || 'unknown').toLowerCase();

  const normalized = (v: string) => v.replace(/\/+$/, '');

  // Try to extract a per-camera identifier from known providers.
  // The returned key is *canonical* (based on URL host), so duplicates across sources can match.
  // This intentionally avoids grouping by hostname alone.
  const extractCanonicalKey = (u: URL): string | null => {
    const host = u.hostname.toLowerCase();

    // worldcam.eu: .../<id>-<slug>
    // Example: https://worldcam.eu/webcams/.../35075-athens-i65-hwy72
    if (host.endsWith('worldcam.eu')) {
      const m = u.pathname.match(/\/(\d{3,})-[^/]+$/);
      if (m?.[1]) return `worldcam:${m[1]}`;
      return `worldcam:${host}${normalized(u.pathname)}`;
    }

    // insecam / worldcam.pl: numeric ID often present in path or filename
    if (host.endsWith('worldcam.pl') || host.endsWith('insecam.org')) {
      const m = u.pathname.match(/\/(\d{3,})(?:\.[a-zA-Z]+)?$/);
      if (m?.[1]) return `insecam:${m[1]}`;
      return `insecam:${host}${normalized(u.pathname)}`;
    }

    // worldviewstream.com: slug-based pages are typically per-camera.
    if (host.endsWith('worldviewstream.com')) {
      const slug = u.pathname.split('/').filter(Boolean).pop();
      if (slug) return `worldviewstream:${slug}`;
      return `worldviewstream:${host}${normalized(u.pathname)}`;
    }

    return null;
  };

  // Fallback: use full host+path (stricter than host-only), stripped of query/hash.
  const hostPathKey = (u: URL) => `${u.hostname.toLowerCase()}${normalized(u.pathname)}`;

  try {
    const u = new URL(url);
    const canonical = extractCanonicalKey(u);
    if (canonical) return canonical;

    // Unknown providers: namespace by source to avoid accidental cross-provider collisions.
    return `${src}:${hostPathKey(u)}`;
  } catch {
    // If URL parsing fails, fallback to a normalized raw string.
    return `${src}:${normalized(url)}`;
  }
}

export default function Index() {
  const globeRef = useRef<CesiumGlobeRef | null>(null);
  const [navState, setNavState] = useState<{ headingDegrees: number; pitchDegrees: number } | null>(null);
  const [cameraDataRaw, setCameraDataRaw] = useState<any[] | null>(null);
  const [cameraDataError, setCameraDataError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    fetchCameraData()
      .then((data) => {
        if (abort.signal.aborted) return;
        setCameraDataRaw(data);
      })
      .catch((err) => {
        if (abort.signal.aborted) return;
        setCameraDataError(err instanceof Error ? err.message : 'Failed to load camera data');
      });
    return () => {
      abort.abort();
    };
  }, []);

  // Load and process cameras from JSON
  const allCameras = useMemo(() => {
    if (!cameraDataRaw) return [] as CameraData[];
    return (cameraDataRaw as any[]).map((cam: any, index: number) => ({
      id: computeCameraId(cam, index),
      latitude: cam.latitude,
      longitude: cam.longitude,
      continent: getContinent(cam.country),
      country: cam.country,
      city: cam.city,
      region: cam.region,
      manufacturer: cam.manufacturer,
      image_url: cam.image_url,
      page_url: cam.page_url
      ,
      source: typeof cam?.source === 'string' ? cam.source : undefined,
      network_key: computeNetworkKey(cam) ?? undefined,
      access_level: typeof cam?.source === 'string' && cam.source.toLowerCase() === 'insecam' ? 'restricted' : 'public'
    })) as CameraData[];
  }, [cameraDataRaw]);

  const initialQueryParams = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search);
  }, []);

  const initialSelectedRegions = useMemo(() => {
    return parseCsvParam(initialQueryParams?.get('regions') ?? null);
  }, [initialQueryParams]);

  const initialSelectedManufacturers = useMemo(() => {
    return parseCsvParam(initialQueryParams?.get('mfr') ?? null);
  }, [initialQueryParams]);

  const initialSearchQuery = useMemo(() => {
    return initialQueryParams?.get('q') ?? '';
  }, [initialQueryParams]);

  const initialSelectedCameraId = useMemo(() => {
    return initialQueryParams?.get('cam') ?? null;
  }, [initialQueryParams]);

  const stats = useMemo(() => getCameraStats(allCameras), [allCameras]);
  const maxVisibleNodesMax = Math.max(500, Math.min(5000, allCameras.length));

  const persistedSettings = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return readSettingsStorage<any>(SETTINGS_STORAGE_KEY, null);
  }, []);

  const [selectedRegions, setSelectedRegions] = useState<string[]>(initialSelectedRegions);
  const [selectedCamera, setSelectedCamera] = useState<CameraData | null>(() => {
    if (!initialSelectedCameraId) return null;
    return allCameras.find((c) => c.id === initialSelectedCameraId) ?? null;
  });
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>(initialSelectedManufacturers);
  const [currentRotation, setCurrentRotation] = useState<[number, number]>([0, 0]);
  const [currentProgress, setCurrentProgress] = useState(100);
  const [fps, setFps] = useState(60);
  const [isConnected, setIsConnected] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHudOpen, setIsHudOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(() => persistedSettings?.autoRotateEnabled ?? true);
  const [autoRotateSpeed, setAutoRotateSpeed] = useState(() => persistedSettings?.autoRotateSpeed ?? 1.25);
  const [maxVisibleNodes, setMaxVisibleNodes] = useState(() => {
    const raw = persistedSettings?.maxVisibleNodes;
    const fallback = Math.min(1200, maxVisibleNodesMax);
    return typeof raw === 'number' ? Math.max(0, Math.min(maxVisibleNodesMax, raw)) : fallback;
  });
  const [mapVariant, setMapVariant] = useState<'outline' | 'openstreetmap'>(() => persistedSettings?.mapVariant ?? 'outline');
  const [showOsmTiles, setShowOsmTiles] = useState(() => persistedSettings?.showOsmTiles ?? true);
  const [markerSize, setMarkerSize] = useState(() => persistedSettings?.markerSize ?? 1);
  const [showClusterLabels, setShowClusterLabels] = useState(() => persistedSettings?.showClusterLabels ?? true);
  const [glowIntensity, setGlowIntensity] = useState(() => persistedSettings?.glowIntensity ?? 1);
  const [cloudsEnabled, setCloudsEnabled] = useState(() => persistedSettings?.cloudsEnabled ?? true);
  const [cloudsOpacity, setCloudsOpacity] = useState(() => {
    const raw = persistedSettings?.cloudsOpacity;
    return typeof raw === 'number' ? Math.max(0, Math.min(1, raw)) : 0.55;
  });
  const [showCountryBorders, setShowCountryBorders] = useState(() => persistedSettings?.showCountryBorders ?? false);
  const [showNavigationControls, setShowNavigationControls] = useState(() => persistedSettings?.showNavigationControls ?? false);
  const [viewMode, setViewMode] = useState<'globe' | 'map'>(() => persistedSettings?.viewMode ?? 'globe');
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  useEffect(() => {
    if (!showNavigationControls) {
      setNavState(null);
      return;
    }

    let raf = 0;
    const tick = () => {
      const next = globeRef.current?.getNavigationState() ?? null;
      setNavState(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [showNavigationControls]);

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    return readStringArrayStorage(FAVORITES_STORAGE_KEY);
  });

  const [recentIds, setRecentIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    return readStringArrayStorage(RECENTS_STORAGE_KEY);
  });

  const isSelectedFavorite = useMemo(() => {
    if (!selectedCamera?.id) return false;
    return favoriteIds.includes(selectedCamera.id);
  }, [favoriteIds, selectedCamera?.id]);

  const toggleFavoriteSelected = useCallback(() => {
    const id = selectedCamera?.id;
    if (!id) return;
    setFavoriteIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      writeStringArrayStorage(FAVORITES_STORAGE_KEY, next);
      return next;
    });
  }, [selectedCamera?.id]);

  // Sync selected camera + filters to URL for shareable links.
  // We do this in a minimal way (replaceState) to avoid full page reloads.
  const syncUrl = useCallback(
    (next: {
      camId: string | null;
      q: string;
      regions: string[];
      mfr: string[];
    }) => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);

      if (next.camId) params.set('cam', next.camId);
      else params.delete('cam');

      if (next.q.trim()) params.set('q', next.q.trim());
      else params.delete('q');

      if (next.regions.length > 0) params.set('regions', serializeCsvParam(next.regions));
      else params.delete('regions');

      if (next.mfr.length > 0) params.set('mfr', serializeCsvParam(next.mfr));
      else params.delete('mfr');

      const qs = params.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', url);
    },
    []
  );

  // Get unique manufacturers
  const manufacturers = useMemo(() => {
    const uniqueMfr = new Set(allCameras.map(cam => cam.manufacturer).filter(m => m && m !== 'N/A'));
    return Array.from(uniqueMfr).sort();
  }, [allCameras]);

  // Filter cameras by selected regions and manufacturers
  const filteredCameras = useMemo(() => {
    let filtered = allCameras;

    if (favoritesOnly) {
      const favSet = new Set(favoriteIds);
      filtered = filtered.filter((cam) => !!cam.id && favSet.has(cam.id));
    }

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
  }, [allCameras, favoriteIds, favoritesOnly, selectedRegions, selectedManufacturers, searchQuery]);

  const handleCopyShareLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // ignore
    }
  }, []);

  // Get regions for filter
  const regions = useMemo(() => {
    return Object.entries(stats.byContinent)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [stats]);

  const handleRegionToggle = useCallback((region: string) => {
    setSelectedRegions((prev) => {
      const next = prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region];
      syncUrl({
        camId: selectedCamera?.id ?? null,
        q: searchQuery,
        regions: next,
        mfr: selectedManufacturers,
      });
      return next;
    });
  }, [searchQuery, selectedCamera?.id, selectedManufacturers, syncUrl]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    syncUrl({
      camId: selectedCamera?.id ?? null,
      q: query,
      regions: selectedRegions,
      mfr: selectedManufacturers,
    });
  }, [selectedCamera?.id, selectedManufacturers, selectedRegions, syncUrl]);

  const handleCameraSelect = useCallback((camera: CameraData | null) => {
    setSelectedCamera(camera);
    const id = camera?.id ?? null;
    if (id) {
      setRecentIds((prev) => {
        const next = [id, ...prev.filter((x) => x !== id)].slice(0, 20);
        writeStringArrayStorage(RECENTS_STORAGE_KEY, next);
        return next;
      });
    }
    syncUrl({
      camId: id,
      q: searchQuery,
      regions: selectedRegions,
      mfr: selectedManufacturers,
    });
  }, [searchQuery, selectedManufacturers, selectedRegions, syncUrl]);

  const handleCloseModal = useCallback(() => {
    setSelectedCamera(null);
    syncUrl({
      camId: null,
      q: searchQuery,
      regions: selectedRegions,
      mfr: selectedManufacturers,
    });
  }, [searchQuery, selectedManufacturers, selectedRegions, syncUrl]);

  const handleManufacturerToggleWithUrl = useCallback((manufacturer: string) => {
    setSelectedManufacturers((prev) => {
      const next = prev.includes(manufacturer) ? prev.filter((m) => m !== manufacturer) : [...prev, manufacturer];
      syncUrl({
        camId: selectedCamera?.id ?? null,
        q: searchQuery,
        regions: selectedRegions,
        mfr: next,
      });
      return next;
    });
  }, [searchQuery, selectedCamera?.id, selectedRegions, syncUrl]);



  const handleSearchOpen = useCallback(() => {
    setIsHudOpen(false);
    setIsSearchOpen(true);
  }, []);

  const handleSearchClose = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const handleSettingsOpen = useCallback(() => {
    setIsHudOpen(false);
    setIsSettingsOpen(true);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleSearchRegion = useCallback((region: string) => {
    setSearchQuery(region);
    syncUrl({
      camId: selectedCamera?.id ?? null,
      q: region,
      regions: selectedRegions,
      mfr: selectedManufacturers,
    });
  }, [selectedCamera?.id, selectedManufacturers, selectedRegions, syncUrl]);

  // Convenience shortcuts (when a camera is selected):
  // - Ctrl/Cmd+Shift+C copies the current URL (share link)
  // - F toggles favorite
  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent) => {
      if (!selectedCamera?.id) return;

      const isCopyShare = (e.key === 'C' || e.key === 'c') && (e.ctrlKey || e.metaKey) && e.shiftKey;
      if (isCopyShare) {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(window.location.href);
        } catch {
          // ignore
        }
        return;
      }

      if ((e.key === 'F' || e.key === 'f') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleFavoriteSelected();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCamera?.id, toggleFavoriteSelected]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    writeSettingsStorage(SETTINGS_STORAGE_KEY, {
      autoRotateEnabled,
      autoRotateSpeed,
      maxVisibleNodes,
      mapVariant,
      showOsmTiles,
      markerSize,
      showClusterLabels,
      glowIntensity,
      cloudsEnabled,
      cloudsOpacity,
      showCountryBorders,
      showNavigationControls,
      viewMode,
    });
  }, [
    autoRotateEnabled,
    autoRotateSpeed,
    maxVisibleNodes,
    mapVariant,
    showOsmTiles,
    markerSize,
    showClusterLabels,
    glowIntensity,
    cloudsEnabled,
    cloudsOpacity,
    showCountryBorders,
    showNavigationControls,
    viewMode,
  ]);

  if (cameraDataError) {
    return (
      <ParallaxProvider>
        <div className="relative w-screen h-screen bg-background overflow-hidden">
          <GridOverlay />
          <TechLines />
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
            <div className="hud-panel corner-accents max-w-[520px]">
              <div className="border-b border-panel-border px-4 py-3">
                <div className="font-mono text-xs uppercase tracking-widest text-white/80">
                  Data Load Error
                </div>
              </div>
              <div className="p-4">
                <div className="font-mono text-xs text-white/70 break-words">{cameraDataError}</div>
              </div>
            </div>
          </div>
        </div>
      </ParallaxProvider>
    );
  }

  return (
    <ParallaxProvider>
      <div className="relative w-screen h-screen bg-background overflow-hidden">
        <GridOverlay />
        <TechLines />

        {/* Header */}
        <Header
          rightSlot={
            <div className="absolute right-6 top-6 flex flex-col items-end gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSearchOpen}
                  className="hud-panel corner-accents flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  Browse
                </button>
                <button
                  type="button"
                  onClick={handleSettingsOpen}
                  className="hud-panel corner-accents flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <Sliders className="w-4 h-4" />
                  Settings
                </button>
              </div>

              <div className="hidden md:block w-[320px]">
                <LiveActivityIndicator online={stats.online} total={stats.total} />
              </div>
            </div>
          }
        />

        {/* Main globe container */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full h-full"
          >
            <CesiumGlobe
              ref={globeRef}
              cameras={filteredCameras}
              onCameraSelect={handleCameraSelect}
              selectedCameraId={selectedCamera?.id ?? null}
              autoRotateEnabled={autoRotateEnabled}
              autoRotateSpeed={autoRotateSpeed}
              markerSize={markerSize}
              cloudsEnabled={cloudsEnabled}
              cloudsOpacity={cloudsOpacity}
              showCountryBorders={showCountryBorders}
              showNavigationControls={showNavigationControls}
              viewMode={viewMode}
              onReadyChange={setIsSceneReady}
            />
          </motion.div>
        </div>

        {!isSceneReady && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-2 border-white/15" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
              </div>
              <div className="text-center">
                <div className="font-mono text-xs uppercase tracking-wider text-white/90">
                  Loading...
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-white/50">
                  Initializing globe
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HUD Panels */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="pointer-events-auto hidden md:block absolute top-24 left-6 bottom-28 z-20 w-[320px]">
            <div className="space-y-3 h-full overflow-y-auto">
                <div className="hud-panel corner-accents">
                  <div className="border-b border-panel-border px-4 py-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-white/80 flex items-center gap-2">
                      <Star className="w-3 h-3" />
                      Favorites
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-white/60">
                      {favoriteIds.length.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3">
                    <button
                      type="button"
                      onClick={() => setFavoritesOnly((v) => !v)}
                      className={`w-full hud-panel corner-accents flex items-center justify-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${favoritesOnly ? 'text-foreground hover:bg-secondary/50' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
                    >
                      <Star className={`w-4 h-4 ${favoritesOnly ? 'text-yellow-400' : ''}`} />
                      Favorites Only
                    </button>
                  </div>
                </div>

                <RegionFilters
                  regions={regions}
                  selectedRegions={selectedRegions}
                  onRegionToggle={handleRegionToggle}
                />

                <QuickFilters
                  manufacturers={manufacturers}
                  selectedManufacturers={selectedManufacturers}
                  onManufacturerToggle={handleManufacturerToggleWithUrl}
                />
            </div>
          </div>

          <div className="pointer-events-auto md:hidden absolute left-3 right-3 top-20 z-30">
            <Drawer open={isHudOpen} onOpenChange={setIsHudOpen}>
              <div className="grid grid-cols-3 gap-2">
                <DrawerTrigger asChild>
                  <button
                    type="button"
                    className="hud-panel corner-accents h-12 flex flex-col items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    aria-label="Open panels"
                  >
                    <Layers className="w-4 h-4" />
                    Panels
                  </button>
                </DrawerTrigger>

                <button
                  type="button"
                  onClick={handleSearchOpen}
                  className="hud-panel corner-accents h-12 flex flex-col items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  aria-label="Browse cameras"
                >
                  <Search className="w-4 h-4" />
                  Search
                </button>

                <button
                  type="button"
                  onClick={handleSettingsOpen}
                  className="hud-panel corner-accents h-12 flex flex-col items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  aria-label="Open settings"
                >
                  <Sliders className="w-4 h-4" />
                  Settings
                </button>
              </div>

              <DrawerContent className="border-border/40 bg-background/80 backdrop-blur">
                <DrawerHeader className="p-4 pb-2 text-left">
                  <div className="flex items-center justify-between">
                    <DrawerTitle className="font-mono text-xs uppercase tracking-wider text-white/80">
                      Panels
                    </DrawerTitle>
                    <DrawerClose asChild>
                      <button
                        type="button"
                        className="p-2 rounded-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                        aria-label="Close panels"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </DrawerClose>
                  </div>
                </DrawerHeader>

                <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[70vh] overflow-y-auto space-y-3">
                  <LiveActivityIndicator
                    online={stats.online}
                    total={stats.total}
                  />

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
                    onManufacturerToggle={handleManufacturerToggleWithUrl}
                  />
                </div>
              </DrawerContent>
            </Drawer>
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

        <SettingsPanel
          isOpen={isSettingsOpen}
          autoRotateEnabled={autoRotateEnabled}
          autoRotateSpeed={autoRotateSpeed}
          showOsmTiles={showOsmTiles}
          markerSize={markerSize}
          cloudsEnabled={cloudsEnabled}
          cloudsOpacity={cloudsOpacity}
          showCountryBorders={showCountryBorders}
          showNavigationControls={showNavigationControls}
          onClose={handleSettingsClose}
          onAutoRotateEnabledChange={setAutoRotateEnabled}
          onAutoRotateSpeedChange={setAutoRotateSpeed}
          onShowOsmTilesChange={setShowOsmTiles}
          onMarkerSizeChange={setMarkerSize}
          onCloudsEnabledChange={setCloudsEnabled}
          onCloudsOpacityChange={setCloudsOpacity}
          onShowCountryBordersChange={setShowCountryBorders}
          onShowNavigationControlsChange={setShowNavigationControls}
        />

        {/* Overlays */}
        <CornerDecorations />
        <ScanLinesOverlay />
        <VignetteOverlay />

        {isSceneReady && (
          <div className="hidden sm:block absolute right-6 bottom-16 z-30">
            <button
              type="button"
              onClick={() => setViewMode((prev) => (prev === 'map' ? 'globe' : 'map'))}
              className="hud-panel corner-accents flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              aria-label="Toggle map view"
            >
              {viewMode === 'map' ? 'Globe' : 'Map'}
            </button>
          </div>
        )}

        {isSceneReady && showNavigationControls && navState && viewMode === 'globe' && (() => {
          const heading = ((navState.headingDegrees % 360) + 360) % 360;
          return (
            <div className="hidden sm:block absolute right-6 bottom-28 z-50">
              <button
                type="button"
                onClick={() => {
                  globeRef.current?.tiltToTopDown();
                  globeRef.current?.resetHeading();
                }}
                className="hud-panel corner-accents w-12 h-12 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                aria-label="Reset heading and tilt"
                title="Reset heading and tilt"
              >
                <span
                  className="inline-flex"
                  style={{ transform: `rotate(${-heading}deg)` }}
                >
                  <Compass className="w-5 h-5" />
                </span>
              </button>
            </div>
          );
        })()}

        {/* Footer status bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="absolute bottom-0 left-0 right-0 z-20"
        >
          <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 border-t border-border/30 bg-background/50 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
              <span className="font-mono text-[10px] text-white uppercase tracking-wider">
                Lon: {currentRotation[0].toFixed(2)}° | Lat: {currentRotation[1].toFixed(2)}°
              </span>
              <span className="font-mono text-[10px] text-white uppercase tracking-wider">
                View: {viewMode === 'map' ? 'Flat Map' : 'Globe'}
              </span>
            </div>

            <div className="hidden sm:block flex-1 text-center">
              <span className="font-mono text-[10px] text-accent uppercase tracking-wider">
                {now.toLocaleTimeString(undefined, { hour12: false })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
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
          allCameras={allCameras}
          onClose={handleCloseModal}
          onSelectCamera={(cam) => handleCameraSelect(cam)}
          onToggleFavorite={toggleFavoriteSelected}
          isFavorite={isSelectedFavorite}
          onCopyShareLink={handleCopyShareLink}
        />
      </div>
    </ParallaxProvider>
  );
}
