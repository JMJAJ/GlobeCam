import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import { motion, AnimatePresence } from "framer-motion";
import { CameraData, CameraCluster, GeoFeature } from "@/types/camera";
import { clusterCamerasToMax, buildGridClusters } from "@/utils/clustering";
import { ZoomControls } from "./ZoomControls";

interface GlobeVisualizationProps {
  cameras: CameraData[];
  onCameraSelect?: (camera: CameraData | null) => void;
  onClusterSelect?: (cluster: CameraCluster | null) => void;
  onRotationChange?: (rotation: [number, number]) => void;
  onProgressChange?: (progress: number) => void;
  autoRotateEnabled?: boolean;
  autoRotateSpeed?: number;
  maxVisibleNodes?: number;
  mapVariant?: 'outline' | 'openstreetmap';
  onMapVariantChange?: (variant: 'outline' | 'openstreetmap') => void;
  showOsmTiles?: boolean;
  markerSize?: number;
  showClusterLabels?: boolean;
  glowIntensity?: number;
  showDayNight?: boolean;
  showSun?: boolean;
  showCloudLayer?: boolean;
  showWeatherLayer?: boolean;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = Number.POSITIVE_INFINITY;
const ZOOM_FACTOR = 1.15;
const TILE_CACHE_MAX = 512;
const OVERLAY_TILE_CACHE_MAX = 256;
const GIBS_BASE_URL = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const GIBS_WMS_BASE = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
const GIBS_WMS_WIDTH = 2048;
const GIBS_WMS_HEIGHT = 1024;
const GIBS_TILE_MATRIX = "GoogleMapsCompatible_Level6";
const CLOUD_LAYER = "MODIS_Terra_Cloud_Top_Temp_Day";
const WEATHER_LAYER = "IMERG_Precipitation_Rate";

function formatGibsDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayOfYear(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((now - start) / 86400000);
}

function getSunPosition(date: Date) {
  const dayOfYear = getDayOfYear(date);
  const declination = 23.44 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let longitude = 180 - utcHours * 15;
  longitude = ((longitude + 180) % 360 + 360) % 360 - 180;
  return { longitude, latitude: declination };
}

function inferTextureUsesAlpha(imageData: ImageData) {
  const { data, width, height } = imageData;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 64));
  let minAlpha = 255;
  let maxAlpha = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4 + 3;
      const alpha = data[idx];
      if (alpha < minAlpha) minAlpha = alpha;
      if (alpha > maxAlpha) maxAlpha = alpha;
      if (maxAlpha - minAlpha > 32) return true;
    }
  }
  return false;
}

function interpolateProjection(raw0: any, raw1: any) {
  const mutate: any = d3.geoProjectionMutator((t: number) => (x: number, y: number) => {
    const [x0, y0] = raw0(x, y);
    const [x1, y1] = raw1(x, y);
    return [x0 + t * (x1 - x0), y0 + t * (y1 - y0)];
  });
  let t = 0;
  return Object.assign((mutate as any)(t), {
    alpha(_: number) {
      return arguments.length ? (mutate as any)((t = +_)) : t;
    },
  });
}

export function GlobeVisualization({
  cameras,
  onCameraSelect,
  onClusterSelect,
  onRotationChange,
  onProgressChange,
  autoRotateEnabled = false,
  autoRotateSpeed = 1.25,
  maxVisibleNodes = Number.POSITIVE_INFINITY,
  mapVariant: mapVariantProp = 'outline',
  onMapVariantChange,
  showOsmTiles = true,
  markerSize = 1,
  showClusterLabels = true,
  glowIntensity = 1,
  showDayNight = true,
  showSun = true,
  showCloudLayer = true,
  showWeatherLayer = false,
}: GlobeVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isAnimating, setIsAnimating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [worldData, setWorldData] = useState<GeoFeature[]>([]);
  const [rotation, setRotation] = useState<[number, number]>([0, 0]);
  const [zoom, setZoom] = useState(1);
  const [mapVariant, setMapVariant] = useState<'outline' | 'openstreetmap'>(mapVariantProp);
  const [isDragging, setIsDragging] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredCluster, setHoveredCluster] = useState<CameraCluster | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [sunTimestamp, setSunTimestamp] = useState(() => Date.now());
  const [overlayRefresh, setOverlayRefresh] = useState(0);
  const [overlayDebug, setOverlayDebug] = useState<string | null>(null);

  // Cache for OSM tiles
  const tileCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const overlayTileCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [mapOffset, setMapOffset] = useState<[number, number]>([0, 0]);
  const resizeRafRef = useRef<number | null>(null);
  const viewAnimationRef = useRef<number | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const zoomingTimeoutRef = useRef<number | null>(null);
  const autoRotateRafRef = useRef<number | null>(null);
  const autoRotateLastTimeRef = useRef<number | null>(null);
  const overlayRasterRef = useRef<HTMLCanvasElement | null>(null);
  const overlayTextureRasterRef = useRef<HTMLCanvasElement | null>(null);
  const cloudTextureRef = useRef<HTMLImageElement | null>(null);
  const cloudTextureDataRef = useRef<ImageData | null>(null);
  const weatherTextureRef = useRef<HTMLImageElement | null>(null);
  const weatherTextureDataRef = useRef<ImageData | null>(null);
  const cloudTextureUsesAlphaRef = useRef(true);
  const weatherTextureUsesAlphaRef = useRef(true);
  const cloudTextureDateRef = useRef<string | null>(null);
  const weatherTextureDateRef = useRef<string | null>(null);
  const dragPendingMouseRef = useRef<[number, number] | null>(null);
  const lastMouseRef = useRef<[number, number]>([0, 0]);
  const lastPinchDistanceRef = useRef<number | null>(null);
  const lastPinchCenterRef = useRef<[number, number] | null>(null);
  const isDraggingRef = useRef(false);
  const dragDistanceRef = useRef(0);
  const DRAG_THRESHOLD = 5;
  const hoverRafRef = useRef<number | null>(null);
  const hoverPendingMouseRef = useRef<[number, number] | null>(null);
  const hoveredClusterRef = useRef<CameraCluster | null>(null);

  const sunPosition = useMemo(() => getSunPosition(new Date(sunTimestamp)), [sunTimestamp]);
  const gibsDate = useMemo(
    () => formatGibsDate(new Date(sunTimestamp - 12 * 60 * 60 * 1000)),
    [sunTimestamp]
  );

  useEffect(() => {
    setMapVariant(mapVariantProp);
  }, [mapVariantProp]);

  useEffect(() => {
    if (overlayDebug) {
      console.info(`[GIBS overlay] ${overlayDebug}`);
    }
  }, [overlayDebug]);

  // Create projection helper
  const createProjection = useCallback((width: number, height: number) => {
    const t = progress / 100;
    const alpha = Math.pow(t, 0.6);
    const baseScale = d3.scaleLinear().domain([0, 1]).range([
      Math.min(width, height) * 0.4,
      Math.min(width, height) * 0.25
    ]);

    // When fully in map mode (progress = 100), use pure equirectangular with offset panning
    const isFullMapMode = progress >= 100;

    if (isFullMapMode) {
      // Full flat map mode options
      if (mapVariant === 'openstreetmap') {
        // Mercator for OSM
        const projection = d3.geoMercator()
          .scale(Math.min(width, height) * 0.25 * zoom)
          .translate([width / 2 + mapOffset[0], height / 2 + mapOffset[1]])
          .rotate([0, 0])
          .precision(0.1);
        return projection;
      }

      // Default / Outline (Equirectangular)
      const projection = d3.geoEquirectangular()
        .scale(Math.min(width, height) * 0.25 * zoom)
        .translate([width / 2 + mapOffset[0], height / 2 + mapOffset[1]])
        .rotate([0, 0])
        .precision(0.1);
      return projection;
    }

    // Globe or transitioning mode - use interpolated projection
    const targetRaw = mapVariant === 'openstreetmap' ? d3.geoMercatorRaw : d3.geoEquirectangularRaw;
    const projection = interpolateProjection(d3.geoOrthographicRaw, targetRaw)
      .scale(baseScale(alpha) * zoom)
      .translate([width / 2, height / 2])
      .rotate([rotation[0], rotation[1]])
      .precision(0.1);

    projection.alpha(alpha);
    return projection;
  }, [progress, rotation, zoom, mapOffset, mapVariant]);

  const createProjectionInvert = useCallback((width: number, height: number) => {
    const projection = createProjection(width, height) as d3.GeoProjection;
    if (typeof projection.invert === "function") {
      return projection.invert.bind(projection);
    }

    const t = progress / 100;
    const alpha = Math.pow(t, 0.6);
    const baseScale = d3.scaleLinear().domain([0, 1]).range([
      Math.min(width, height) * 0.4,
      Math.min(width, height) * 0.25
    ]);

    const fallback = d3.geoEquirectangular()
      .scale(baseScale(alpha) * zoom)
      .translate([width / 2, height / 2])
      .rotate([rotation[0], rotation[1]])
      .precision(0.1);

    return fallback.invert.bind(fallback);
  }, [createProjection, progress, rotation, zoom]);

  const projection = useMemo(() => {
    if (!dimensions.width || !dimensions.height) return null;
    return createProjection(dimensions.width, dimensions.height);
  }, [createProjection, dimensions.width, dimensions.height]);

  const projectionInvert = useMemo(() => {
    if (!dimensions.width || !dimensions.height) return null;
    return createProjectionInvert(dimensions.width, dimensions.height);
  }, [createProjectionInvert, dimensions.width, dimensions.height]);

  // Quantize zoom to prevent constant reclustering on small zoom changes
  const stableZoom = useMemo(() => {
    // Round zoom to nearest 0.25 for stable clustering
    return Math.round(zoom * 4) / 4;
  }, [zoom]);

  // Rotation center for visibility checks (uses current rotation for smooth rendering)
  const rotationCenter = useMemo<[number, number]>(() => [-rotation[0], -rotation[1]], [rotation]);

  // Calculate clusters for the whole world based on zoom level (independent of viewport)
  // This ensures clusters don't move/jitter when panning the map
  const worldClusters = useMemo(() => {
    if (!Number.isFinite(maxVisibleNodes) || maxVisibleNodes <= 0) {
      // Grid size in degrees. larger = fewer clusters.
      // At zoom 1 -> 30 deg. At zoom 4 -> ~7 deg.
      const cellSize = 30 / Math.max(0.5, stableZoom);
      return buildGridClusters(cameras, cellSize);
    }

    const maxNodes = Math.max(1, Math.round(maxVisibleNodes));
    return clusterCamerasToMax(cameras, { maxClusters: maxNodes, zoom: stableZoom });
  }, [cameras, stableZoom, maxVisibleNodes]);

  const visibleClusters = useMemo(() => {
    if (!projection) return [] as Array<{ cluster: CameraCluster; x: number; y: number }>;

    // Check visibility for each cluster
    const padding = 50;
    const isGlobeView = progress < 50;
    const result: Array<{ cluster: CameraCluster; x: number; y: number }> = [];

    // Optimized visible cluster calculation with spatial pre-check
    const centerLon = -rotation[0];
    const centerLat = -rotation[1];
    // Approximate view bounds in degrees (generous padding)
    const viewLonSpan = 180 / zoom + 20;
    const viewLatSpan = 90 / zoom + 20;

    for (const cluster of worldClusters) {
      // Fast pre-check: Latitude (no wrapping issues)
      if (Math.abs(cluster.latitude - centerLat) > viewLatSpan) continue;

      // Fast pre-check: Longitude (handle wrapping)
      let lonDiff = Math.abs(cluster.longitude - centerLon);
      if (lonDiff > 180) lonDiff = 360 - lonDiff;
      if (lonDiff > viewLonSpan) continue;

      const coords = projection([cluster.longitude, cluster.latitude]);
      if (!coords || isNaN(coords[0]) || isNaN(coords[1])) continue;

      if (isGlobeView) {
        const geoDistance = d3.geoDistance(
          [cluster.longitude, cluster.latitude],
          rotationCenter
        );
        if (geoDistance > Math.PI / 2 + 0.1) continue;
      }

      const [x, y] = coords;
      if (x < -padding || y < -padding || x > dimensions.width + padding || y > dimensions.height + padding) continue;

      result.push({ cluster, x, y });
    }

    if (Number.isFinite(maxVisibleNodes) && maxVisibleNodes > 0) {
      const maxNodes = Math.max(1, Math.round(maxVisibleNodes));
      if (result.length > maxNodes) {
        return [...result]
          .sort((a, b) => b.cluster.count - a.cluster.count)
          .slice(0, maxNodes);
      }
    }

    return result;
  }, [worldClusters, projection, rotationCenter, progress, dimensions.width, dimensions.height, maxVisibleNodes]);

  // Notify parent of rotation changes
  useEffect(() => {
    onRotationChange?.(rotation);
  }, [rotation, onRotationChange]);

  // Notify parent of progress changes
  useEffect(() => {
    onProgressChange?.(progress);
  }, [progress, onProgressChange]);



  // Reset map offset when switching from map mode to globe mode
  useEffect(() => {
    if (progress < 100) {
      setMapOffset([0, 0]);
    }
  }, [progress]);

  // Handle resize (use viewport size for consistent centering on refresh)
  useEffect(() => {
    const measure = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (width <= 0 || height <= 0) return;

      setDimensions(prev => {
        if (prev.width === width && prev.height === height) {
          return prev;
        }
        return { width, height };
      });
    };

    const scheduleMeasure = () => {
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
      }

      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = requestAnimationFrame(() => {
          resizeRafRef.current = null;
          measure();
        });
      });
    };

    measure();
    scheduleMeasure();

    window.addEventListener('resize', scheduleMeasure);
    return () => {
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
      }
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, []);

  // Cleanup any pending animation frames on unmount
  useEffect(() => {
    return () => {
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      if (zoomingTimeoutRef.current !== null) {
        window.clearTimeout(zoomingTimeoutRef.current);
        zoomingTimeoutRef.current = null;
      }
      if (autoRotateRafRef.current !== null) {
        cancelAnimationFrame(autoRotateRafRef.current);
        autoRotateRafRef.current = null;
      }
      autoRotateLastTimeRef.current = null;
      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
      if (viewAnimationRef.current !== null) {
        cancelAnimationFrame(viewAnimationRef.current);
        viewAnimationRef.current = null;
      }
    };
  }, []);

  // Center when dimensions ready (useLayoutEffect for synchronous execution)
  useLayoutEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    setRotation([0, 0]);
    setZoom(1);
    setProgress(0);
  }, [dimensions.width, dimensions.height]);

  // Load world data
  useEffect(() => {
    const controller = new AbortController();

    const loadWorldData = async () => {
      try {
        const response = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json", {
          signal: controller.signal,
        });
        const world: any = await response.json();
        const countriesFeature = feature(world, world.objects.countries) as any;
        setWorldData(countriesFeature.features || []);
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        console.error("Error loading world data:", error);
      }
    };

    loadWorldData();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSunTimestamp(Date.now());
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadTexture = (layer: string, imageRef: React.MutableRefObject<HTMLImageElement | null>) => {
      const url = `${GIBS_WMS_BASE}?service=WMS&request=GetMap&version=1.1.1&layers=${layer}&styles=&format=image/png&transparent=true&width=${GIBS_WMS_WIDTH}&height=${GIBS_WMS_HEIGHT}&srs=EPSG:4326&bbox=-180,-90,180,90&time=${gibsDate}`;
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onerror = () => {
        console.warn(`Failed to load GIBS layer ${layer} for ${gibsDate}.`);
      };
      image.src = url;
      imageRef.current = image;
      return image;
    };

    if (showCloudLayer && cloudTextureDateRef.current !== gibsDate) {
      cloudTextureDateRef.current = gibsDate;
      const image = loadTexture(CLOUD_LAYER, cloudTextureRef);
      image.onload = () => {
        const offscreen = document.createElement("canvas");
        offscreen.width = GIBS_WMS_WIDTH;
        offscreen.height = GIBS_WMS_HEIGHT;
        const offCtx = offscreen.getContext("2d");
        if (offCtx) {
          offCtx.drawImage(image, 0, 0);
          const data = offCtx.getImageData(0, 0, GIBS_WMS_WIDTH, GIBS_WMS_HEIGHT);
          cloudTextureDataRef.current = data;
          cloudTextureUsesAlphaRef.current = inferTextureUsesAlpha(data);
        }
        setOverlayDebug(`cloud:${cloudTextureUsesAlphaRef.current ? "alpha" : "opaque"} weather:${weatherTextureUsesAlphaRef.current ? "alpha" : "opaque"}`);
        setOverlayRefresh(prev => prev + 1);
      };
    } else if (!showCloudLayer) {
      cloudTextureDataRef.current = null;
      cloudTextureDateRef.current = null;
    }

    if (showWeatherLayer && weatherTextureDateRef.current !== gibsDate) {
      weatherTextureDateRef.current = gibsDate;
      const image = loadTexture(WEATHER_LAYER, weatherTextureRef);
      image.onload = () => {
        const offscreen = document.createElement("canvas");
        offscreen.width = GIBS_WMS_WIDTH;
        offscreen.height = GIBS_WMS_HEIGHT;
        const offCtx = offscreen.getContext("2d");
        if (offCtx) {
          offCtx.drawImage(image, 0, 0);
          const data = offCtx.getImageData(0, 0, GIBS_WMS_WIDTH, GIBS_WMS_HEIGHT);
          weatherTextureDataRef.current = data;
          weatherTextureUsesAlphaRef.current = inferTextureUsesAlpha(data);
        }
        setOverlayDebug(`cloud:${cloudTextureUsesAlphaRef.current ? "alpha" : "opaque"} weather:${weatherTextureUsesAlphaRef.current ? "alpha" : "opaque"}`);
        setOverlayRefresh(prev => prev + 1);
      };
    } else if (!showWeatherLayer) {
      weatherTextureDataRef.current = null;
      weatherTextureDateRef.current = null;
    }
  }, [gibsDate, showCloudLayer, showWeatherLayer]);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    if (zoomingTimeoutRef.current !== null) {
      window.clearTimeout(zoomingTimeoutRef.current);
    }
    setIsZooming(true);
    zoomingTimeoutRef.current = window.setTimeout(() => {
      setIsZooming(false);
      zoomingTimeoutRef.current = null;
    }, 150);
    const factor = event.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
    const newZoom = Math.max(MIN_ZOOM, zoom * factor);

    // In full map mode, zoom towards mouse position
    const isFullMapMode = progress >= 100;
    if (isFullMapMode) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;

        // Calculate the point under mouse relative to center (accounting for current offset)
        const pointX = mouseX - centerX - mapOffset[0];
        const pointY = mouseY - centerY - mapOffset[1];

        // Scale the offset so the point under mouse stays fixed
        const scale = newZoom / zoom;
        const newOffsetX = mapOffset[0] - pointX * (scale - 1);
        const newOffsetY = mapOffset[1] - pointY * (scale - 1);

        setMapOffset([newOffsetX, newOffsetY]);
      }
    }

    setZoom(newZoom);
  }, [zoom, progress, dimensions.width, dimensions.height, mapOffset]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => prev * ZOOM_FACTOR);
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(MIN_ZOOM, prev / ZOOM_FACTOR));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setRotation([0, 0]);
    setProgress(0);
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    setIsDragging(true);
    isDraggingRef.current = true;
    dragDistanceRef.current = 0; // Reset drag distance on new drag
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      lastMouseRef.current = [event.clientX - rect.left, event.clientY - rect.top];
    }
  }, []);

  const scheduleDrag = useCallback((currentMouse: [number, number]) => {
    if (!isDraggingRef.current) return;
    dragPendingMouseRef.current = currentMouse;
    if (dragRafRef.current === null) {
      dragRafRef.current = requestAnimationFrame(() => {
        const pending = dragPendingMouseRef.current;
        if (!pending) {
          dragRafRef.current = null;
          return;
        }
        const [lastX, lastY] = lastMouseRef.current;
        const dx = pending[0] - lastX;
        const dy = pending[1] - lastY;

        // Track drag distance for click vs drag detection
        dragDistanceRef.current += Math.abs(dx) + Math.abs(dy);

        const isFullMapMode = progress >= 100;

        if (isFullMapMode) {
          // Full flat map mode: direct offset panning (like Google Maps)
          setMapOffset(prev => [
            prev[0] + dx,
            prev[1] + dy
          ]);
        } else {
          // Globe or transitioning mode: rotation-based movement
          const sensitivity = (progress < 50 ? 0.5 : 0.25) / zoom;
          setRotation(prev => [
            prev[0] + dx * sensitivity,
            Math.max(-90, Math.min(90, prev[1] - dy * sensitivity))
          ]);
        }

        lastMouseRef.current = pending;
        dragPendingMouseRef.current = null;
        dragRafRef.current = null;
      });
    }
  }, [progress, zoom]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    scheduleDrag([event.clientX - rect.left, event.clientY - rect.top]);
  }, [scheduleDrag]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    isDraggingRef.current = false;
    dragPendingMouseRef.current = null;
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      setIsDragging(true);
      isDraggingRef.current = true;
      dragDistanceRef.current = 0;
      lastMouseRef.current = [touch.clientX - rect.left, touch.clientY - rect.top];
      lastPinchDistanceRef.current = null;
      lastPinchCenterRef.current = null;
      return;
    }

    if (event.touches.length === 2) {
      const touchA = event.touches[0];
      const touchB = event.touches[1];
      const center: [number, number] = [
        (touchA.clientX + touchB.clientX) / 2 - rect.left,
        (touchA.clientY + touchB.clientY) / 2 - rect.top,
      ];
      setIsDragging(true);
      isDraggingRef.current = true;
      dragDistanceRef.current = 0;
      lastMouseRef.current = center;
      lastPinchCenterRef.current = center;
      lastPinchDistanceRef.current = Math.hypot(
        touchA.clientX - touchB.clientX,
        touchA.clientY - touchB.clientY,
      );
    }
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      scheduleDrag([touch.clientX - rect.left, touch.clientY - rect.top]);
      lastPinchDistanceRef.current = null;
      lastPinchCenterRef.current = null;
      return;
    }

    if (event.touches.length !== 2) return;

    const touchA = event.touches[0];
    const touchB = event.touches[1];
    const center: [number, number] = [
      (touchA.clientX + touchB.clientX) / 2 - rect.left,
      (touchA.clientY + touchB.clientY) / 2 - rect.top,
    ];
    scheduleDrag(center);

    const distance = Math.hypot(touchA.clientX - touchB.clientX, touchA.clientY - touchB.clientY);
    if (lastPinchDistanceRef.current !== null) {
      const scale = distance / lastPinchDistanceRef.current;
      if (Number.isFinite(scale) && scale !== 0) {
        const newZoom = Math.max(MIN_ZOOM, zoom * scale);
        if (newZoom !== zoom) {
          if (zoomingTimeoutRef.current !== null) {
            window.clearTimeout(zoomingTimeoutRef.current);
          }
          setIsZooming(true);
          zoomingTimeoutRef.current = window.setTimeout(() => {
            setIsZooming(false);
            zoomingTimeoutRef.current = null;
          }, 150);

          const isFullMapMode = progress >= 100;
          if (isFullMapMode) {
            const centerX = dimensions.width / 2;
            const centerY = dimensions.height / 2;
            const pointX = center[0] - centerX - mapOffset[0];
            const pointY = center[1] - centerY - mapOffset[1];
            const scaleFactor = newZoom / zoom;
            setMapOffset([
              mapOffset[0] - pointX * (scaleFactor - 1),
              mapOffset[1] - pointY * (scaleFactor - 1),
            ]);
          }

          setZoom(newZoom);
        }
      }
    }

    lastPinchDistanceRef.current = distance;
    lastPinchCenterRef.current = center;
  }, [scheduleDrag, zoom, progress, dimensions.width, dimensions.height, mapOffset]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 0) {
      lastPinchDistanceRef.current = null;
      lastPinchCenterRef.current = null;
      handleMouseUp();
      return;
    }

    if (event.touches.length === 1) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const touch = event.touches[0];
        lastMouseRef.current = [touch.clientX - rect.left, touch.clientY - rect.top];
      }
      dragPendingMouseRef.current = null;
      dragDistanceRef.current = 0;
      setIsDragging(true);
      isDraggingRef.current = true;
      lastPinchDistanceRef.current = null;
      lastPinchCenterRef.current = null;
    }
  }, [handleMouseUp]);

  const normalizeAngle = useCallback((angle: number) => {
    const wrapped = ((angle + 180) % 360 + 360) % 360 - 180;
    return wrapped;
  }, []);

  useEffect(() => {
    if (!autoRotateEnabled || progress >= 100) return;

    const step = (time: number) => {
      if (!autoRotateEnabled || progress >= 100) {
        autoRotateRafRef.current = null;
        autoRotateLastTimeRef.current = null;
        return;
      }

      if (isDraggingRef.current || isAnimating || viewAnimationRef.current !== null) {
        autoRotateLastTimeRef.current = time;
        autoRotateRafRef.current = requestAnimationFrame(step);
        return;
      }

      if (autoRotateLastTimeRef.current === null) {
        autoRotateLastTimeRef.current = time;
      }

      const deltaSeconds = (time - autoRotateLastTimeRef.current) / 1000;
      autoRotateLastTimeRef.current = time;

      if (deltaSeconds > 0) {
        const deltaLon = autoRotateSpeed * deltaSeconds;
        setRotation((prev) => [normalizeAngle(prev[0] + deltaLon), prev[1]]);
      }

      autoRotateRafRef.current = requestAnimationFrame(step);
    };

    autoRotateRafRef.current = requestAnimationFrame(step);

    return () => {
      if (autoRotateRafRef.current !== null) {
        cancelAnimationFrame(autoRotateRafRef.current);
        autoRotateRafRef.current = null;
      }
      autoRotateLastTimeRef.current = null;
    };
  }, [autoRotateEnabled, autoRotateSpeed, progress, normalizeAngle, isAnimating]);

  const animateViewTo = useCallback((targetRotation: [number, number], targetZoom: number, duration = 900) => {
    if (viewAnimationRef.current !== null) {
      cancelAnimationFrame(viewAnimationRef.current);
    }

    const startZoom = zoom;
    const deltaZoom = targetZoom - startZoom;
    const startTime = Date.now();
    const isMapMode = progress >= 100;

    // Animation state for globe vs map
    const startRotation: [number, number] = [rotation[0], rotation[1]];
    const deltaLon = normalizeAngle(targetRotation[0] - startRotation[0]);
    const deltaLat = targetRotation[1] - startRotation[1];

    // Animation state for map offset
    const startMapOffset = mapOffset;
    let targetMapOffset = mapOffset;

    if (isMapMode) {
      // Calculate target offset to center the target coordinate
      // Current projection center is at [width/2 + offset[0], height/2 + offset[1]]
      // We want to move such that projected(target) is at [width/2, height/2]
      // In equirectangular: x = (lon + 180)/360 * width, y = (90 - lat)/180 * height
      // This is simplified; better to use the projection delta relative to center

      const width = dimensions.width;
      const height = dimensions.height;
      const scale = Math.min(width, height) * 0.25 * targetZoom; // Use target zoom scale

      const targetX = (targetRotation[0] / 360) * width * targetZoom; // Rough approx for movement delta
      // Actually, we can just calculate the shift needed.
      // Drag moves offset by pixels. 
      // 1 degree lon = (width * zoom) / 360 pixels.
      // 1 degree lat = (height * zoom) / 180 pixels (roughly).
      // Let's use a simpler approach: Interpolate Offset relative to current.

      // Calculate pixel delta for the rotation change
      const pxPerDegX = (Math.min(width, height) * 0.25 * startZoom) * 2 * Math.PI / 360; // Scale factor from D3
      // No, let's look at the projection definition in createProjection:
      // scale(Math.min(width, height) * 0.25 * zoom)
      // d3.geoEquirectangular scale S implies 2*PI*S pixels for 360 degrees?
      // No, D3 projection logic: x = lambda * scale * cos(phi0) ... 
      // For equirectangular: x = lambda * scale.
      // Lambda is in radians. So 360 deg = 2*PI radians. Width = 2*PI*scale.
      // So degToPx = (2 * Math.PI * scale) / 360.

      const s = Math.min(width, height) * 0.25 * startZoom; // Current scale
      const dx = deltaLon * (2 * Math.PI * s) / 360;
      const dy = -deltaLat * (2 * Math.PI * s) / 360; // Latitude is inverted y

      targetMapOffset = [startMapOffset[0] + dx, startMapOffset[1] + dy];
    }

    const step = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      if (isMapMode) {
        // Map mode: Animate Offset
        setMapOffset([
          startMapOffset[0] + (targetMapOffset[0] - startMapOffset[0]) * eased,
          startMapOffset[1] + (targetMapOffset[1] - startMapOffset[1]) * eased
        ]);
      } else {
        // Globe mode: Animate Rotation
        setRotation([
          startRotation[0] + deltaLon * eased,
          startRotation[1] + deltaLat * eased,
        ]);
      }

      setZoom(startZoom + deltaZoom * eased);

      if (t < 1) {
        viewAnimationRef.current = requestAnimationFrame(step);
      } else {
        viewAnimationRef.current = null;
      }
    };

    viewAnimationRef.current = requestAnimationFrame(step);
  }, [normalizeAngle, rotation, zoom, mapOffset, progress, dimensions]);

  // Render globe
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const isOsmMapMode = mapVariant === 'openstreetmap' && progress >= 100;

    svg.selectAll("*").remove();
    if (isOsmMapMode || worldData.length === 0) return;

    const { width, height } = dimensions;
    const projection = createProjection(width, height);
    const path = d3.geoPath(projection);

    // Outer glow effect
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "globe-glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
    filter.append("feMerge")
      .selectAll("feMergeNode")
      .data(["blur", "SourceGraphic"])
      .enter()
      .append("feMergeNode")
      .attr("in", d => d);

    // Radial gradient for sphere
    const gradient = defs.append("radialGradient")
      .attr("id", "sphere-gradient")
      .attr("cx", "30%")
      .attr("cy", "30%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "rgba(255,255,255,0.03)");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "rgba(0,0,0,0)");

    const spherePathValue = path({ type: "Sphere" });
    if (spherePathValue) {
      defs.append("clipPath")
        .attr("id", "sphere-clip")
        .append("path")
        .attr("d", spherePathValue);
    }

    // Sphere fill
    const spherePath = path({ type: "Sphere" });
    if (spherePath) {

      svg.append("path")
        .datum({ type: "Sphere" })
        .attr("d", spherePath)
        .attr("fill", "url(#sphere-gradient)")
        .attr("stroke", "none");
    }

    // Countries
    svg.selectAll(".country")
      .data(worldData)
      .enter()
      .append("path")
      .attr("class", "country")
      .attr("d", d => {
        try {
          const pathString = path(d as any);
          if (!pathString || pathString.includes("NaN")) return "";
          return pathString;
        } catch {
          return "";
        }
      })
      .attr("fill", "rgba(255,255,255,0.08)")
      .attr("stroke", "rgba(255,255,255,0.15)")
      .attr("stroke-width", 0.5)
      .style("visibility", function () {
        const pathData = d3.select(this).attr("d");
        return pathData && pathData.length > 0 ? "visible" : "hidden";
      });

    // Sphere outline - fade out as we transition to map mode
    if (spherePath && progress < 95) {
      const outlineOpacity = Math.max(0, 1 - progress / 80) * 0.3;
      svg.append("path")
        .datum({ type: "Sphere" })
        .attr("d", spherePath)
        .attr("fill", "none")
        .attr("stroke", `rgba(255,255,255,${outlineOpacity})`)
        .attr("stroke-width", 1.5)
        .attr("filter", "url(#globe-glow)");
    }

  }, [worldData, dimensions, createProjection, progress, mapVariant]);

  // Render base map (OSM tiles)
  useEffect(() => {
    if (!baseCanvasRef.current) return;

    const canvas = baseCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const isFullMapMode = progress >= 100;

    if (mapVariant !== 'openstreetmap') {
      return;
    }

    if (!isFullMapMode || !showOsmTiles || !projection || !projectionInvert) {
      return;
    }

    // OSM Tile Rendering (Mercator)
    // 1. Calculate Zoom Level
    const projectionScale = (projection as d3.GeoProjection).scale();
    // d3 mercator scale = 256 / (2*PI) * 2^z
    // s = 256 * 2^z / (2*PI)  =>  s * 2*PI / 256 = 2^z
    const z = Math.max(0, Math.floor(Math.log2(projectionScale * 2 * Math.PI / 256)));
    const renderZ = Math.max(0, (isDragging || isZooming) ? z - 1 : z);
    const zoomPower = Math.pow(2, renderZ);

    // 2. Visible Bounds
    // Invert screen corners to get Lon/Lat
    const tl = projectionInvert([0, 0]);
    const br = projectionInvert([width, height]);

    if (!tl || !br) return;

    const [lon1, lat1] = tl;
    const [lon2, lat2] = br;

    // Convert to Tile Coordinates
    const tileX = (lon: number) => (lon + 180) / 360 * zoomPower;
    const tileY = (lat: number) => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * zoomPower;

    const minX = Math.floor(Math.min(tileX(lon1), tileX(lon2)));
    const maxX = Math.floor(Math.max(tileX(lon1), tileX(lon2)));
    const minY = Math.floor(Math.min(tileY(lat1), tileY(lat2)));
    const maxY = Math.floor(Math.max(tileY(lat1), tileY(lat2)));

    // 3. Draw Tiles
    // We need to calculate where to draw the tile (0,0) based on projection
    // Or just map tile coordinates to screen coordinates

    // Simpler: iterate tiles, calculate their screen position using projection
    // But projection gives pixel for center?
    // Better: Use the d3 transform directly.
    // x_screen = (x_tile - tx) * k + cx ...

    // Let's use the layout math:
    // scale k = 256 * 2^z / (2*PI) -- wait, d3 scale matches this?
    // Actually projection(lon,lat) gives exact screen pixels.
    // So let's project the Top-Left of each tile to find where to draw it.

    ctx.save();

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        // Wrap x for world repeating?
        // Render tiles
        const wrappedX = x % zoomPower;
        const normX = wrappedX < 0 ? wrappedX + zoomPower : wrappedX;

        const url = `https://tile.openstreetmap.org/${renderZ}/${normX}/${y}.png`;

        // Check cache (LRU-ish order)
        let img = tileCache.current.get(url);
        if (!img) {
          img = new Image();
          img.crossOrigin = "anonymous";
          img.src = url;
        }

        tileCache.current.delete(url);
        tileCache.current.set(url, img);

        if (tileCache.current.size > TILE_CACHE_MAX) {
          const oldestKey = tileCache.current.keys().next().value as string | undefined;
          if (oldestKey) {
            tileCache.current.delete(oldestKey);
          }
        }

        if (img.complete && img.naturalWidth > 0) {
          // Calculate position
          // Tile coord (x, y) corresponds to lon/lat:
          // Convert back to lon/lat is expensive inside loop?
          // No, we can project tile coordinates directly if we know the transform.

          // Let's deduce screen rect of the tile.
          // We know tile (x,y) at zoom z covers conceptual pixel space:
          // X: x*256 to (x+1)*256
          // Y: y*256 to (y+1)*256
          // But this is in "Tile Pixel Space".

          // D3 Mercator projection pixel space:
          // [x, y] = projection([lon, lat])

          // We can just project the Top-Left corner of the tile.
          const lon = (x / zoomPower) * 360 - 180;
          const lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / zoomPower)));
          const lat = lat_rad * 180 / Math.PI;

          const [px, py] = projection([lon, lat]) || [0, 0];

          // Calculate size?
          // Size varies if z is not integer matching projection scale?
          // But we chose z based on projection scale.
          // scale factor = projection.scale() * 2 * PI / (256 * 2^z)
          // This factor applies to the 256px tile.
          const scaleFactor = (projectionScale * 2 * Math.PI) / (zoomPower * 256);
          const size = 256 * scaleFactor;

          // Fix for floating point gaps: add small overlap?
          ctx.drawImage(img, px, py, size + 0.5, size + 0.5);
        }
      }
    }
    ctx.restore();
  }, [dimensions, mapVariant, progress, projection, projectionInvert, showOsmTiles, isDragging, isZooming]);

  // Render overlays (day/night, sun, weather, clouds)
  useEffect(() => {
    if (!overlayCanvasRef.current || !projection) return;

    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    if (!width || !height) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const isFullMapMode = progress >= 100;
    const projectionBase = projection as d3.GeoProjection;
    const overlayInvert = (() => {
      if (!projectionInvert) return null;
      if (progress < 95) {
        const ortho = d3.geoOrthographic()
          .scale(projectionBase.scale())
          .translate(projectionBase.translate())
          .rotate(projectionBase.rotate())
          .precision(0.1);
        return ortho.invert?.bind(ortho) ?? projectionInvert;
      }
      return projectionInvert;
    })();
    const shouldClipSphere = progress < 95;

    if (shouldClipSphere) {
      const clipPath = d3.geoPath(projection).context(ctx);
      ctx.save();
      ctx.beginPath();
      clipPath({ type: "Sphere" } as any);
      ctx.clip();
    }

    const shouldDrawTiles =
      isFullMapMode &&
      mapVariant === 'openstreetmap' &&
      projectionInvert &&
      (showCloudLayer || showWeatherLayer);
    const shouldDrawGlobalOverlay =
      overlayInvert &&
      (showCloudLayer || showWeatherLayer) &&
      (!isFullMapMode || mapVariant !== 'openstreetmap');

    if (shouldDrawTiles && projectionInvert) {
      const projectionScale = (projection as d3.GeoProjection).scale();
      const z = Math.max(0, Math.floor(Math.log2(projectionScale * 2 * Math.PI / 256)));
      const renderZ = Math.max(0, (isDragging || isZooming) ? z - 1 : z);
      const gibsZoom = Math.min(6, renderZ);
      const zoomPower = Math.pow(2, gibsZoom);

      const tl = projectionInvert([0, 0]);
      const br = projectionInvert([width, height]);
      if (tl && br) {
        const [lon1, lat1] = tl;
        const [lon2, lat2] = br;

        const tileX = (lon: number) => (lon + 180) / 360 * zoomPower;
        const tileY = (lat: number) => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * zoomPower;

        const minX = Math.floor(Math.min(tileX(lon1), tileX(lon2)));
        const maxX = Math.floor(Math.max(tileX(lon1), tileX(lon2)));
        const minY = Math.floor(Math.min(tileY(lat1), tileY(lat2)));
        const maxY = Math.floor(Math.max(tileY(lat1), tileY(lat2)));

        const layers: Array<{ name: string; opacity: number }> = [];
        if (showCloudLayer) layers.push({ name: CLOUD_LAYER, opacity: 0.45 });
        if (showWeatherLayer) layers.push({ name: WEATHER_LAYER, opacity: 0.35 });

        for (const layer of layers) {
          ctx.save();
          ctx.globalAlpha = layer.opacity;

          for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
              const wrappedX = x % zoomPower;
              const normX = wrappedX < 0 ? wrappedX + zoomPower : wrappedX;
              if (y < 0 || y >= zoomPower) continue;

              const url = `${GIBS_BASE_URL}/${layer.name}/default/${gibsDate}/${GIBS_TILE_MATRIX}/${gibsZoom}/${y}/${normX}.png`;

              let img = overlayTileCache.current.get(url);
              if (!img) {
                img = new Image();
                img.crossOrigin = "anonymous";
                img.src = url;
                img.onload = () => setOverlayRefresh(prev => prev + 1);
                overlayTileCache.current.set(url, img);
              }

              overlayTileCache.current.delete(url);
              overlayTileCache.current.set(url, img);

              if (overlayTileCache.current.size > OVERLAY_TILE_CACHE_MAX) {
                const oldestKey = overlayTileCache.current.keys().next().value as string | undefined;
                if (oldestKey) {
                  overlayTileCache.current.delete(oldestKey);
                }
              }

              if (img.complete && img.naturalWidth > 0) {
                const lon = (x / zoomPower) * 360 - 180;
                const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / zoomPower)));
                const lat = latRad * 180 / Math.PI;
                const [px, py] = projection([lon, lat]) || [0, 0];
                const scaleFactor = (projectionScale * 2 * Math.PI) / (zoomPower * 256);
                const size = 256 * scaleFactor;
                ctx.drawImage(img, px, py, size + 0.5, size + 0.5);
              }
            }
          }

          ctx.restore();
        }
      }
    }

    if (shouldDrawGlobalOverlay && overlayInvert) {
      const cloudTexture = cloudTextureDataRef.current;
      const weatherTexture = weatherTextureDataRef.current;
      const cloudOpacity = showCloudLayer ? 0.45 : 0;
      const weatherOpacity = showWeatherLayer ? 0.35 : 0;
      const cloudUsesAlpha = cloudTextureUsesAlphaRef.current;
      const weatherUsesAlpha = weatherTextureUsesAlphaRef.current;
      const cloudBoost = cloudUsesAlpha ? 1 : 1.35;
      const weatherBoost = weatherUsesAlpha ? 1 : 1.5;
      const totalOpacity = cloudOpacity + weatherOpacity;

      if (totalOpacity > 0 && (cloudTexture || weatherTexture)) {
        const sampleStep = isDragging ? 8 : 5;
        const sampleWidth = Math.ceil(width / sampleStep);
        const sampleHeight = Math.ceil(height / sampleStep);
        let rasterCanvas = overlayTextureRasterRef.current;
        if (!rasterCanvas) {
          rasterCanvas = document.createElement('canvas');
          overlayTextureRasterRef.current = rasterCanvas;
        }

        if (rasterCanvas.width !== sampleWidth || rasterCanvas.height !== sampleHeight) {
          rasterCanvas.width = sampleWidth;
          rasterCanvas.height = sampleHeight;
        }

        const rasterCtx = rasterCanvas.getContext('2d');
        if (rasterCtx) {
          const imageData = rasterCtx.createImageData(sampleWidth, sampleHeight);
          const data = imageData.data;

          for (let sy = 0; sy < sampleHeight; sy++) {
            const y = (sy + 0.5) * sampleStep;
            for (let sx = 0; sx < sampleWidth; sx++) {
              const x = (sx + 0.5) * sampleStep;
              const lonLat = overlayInvert([x, y]);
              if (!lonLat) continue;

              const [lon, lat] = lonLat;
              const u = (lon + 180) / 360;
              const v = (90 - lat) / 180;
              if (u < 0 || u > 1 || v < 0 || v > 1) continue;

              let r = 0;
              let g = 0;
              let b = 0;
              let a = 0;

              if (cloudTexture && showCloudLayer) {
                const tx = Math.min(GIBS_WMS_WIDTH - 1, Math.max(0, Math.floor(u * GIBS_WMS_WIDTH)));
                const ty = Math.min(GIBS_WMS_HEIGHT - 1, Math.max(0, Math.floor(v * GIBS_WMS_HEIGHT)));
                const idx = (ty * GIBS_WMS_WIDTH + tx) * 4;
                const rawR = cloudTexture.data[idx];
                const rawG = cloudTexture.data[idx + 1];
                const rawB = cloudTexture.data[idx + 2];
                const rawAlpha = cloudTexture.data[idx + 3] / 255;
                const intensity = Math.max(rawR, rawG, rawB) / 255;
                const alphaSource = cloudUsesAlpha ? rawAlpha : Math.min(1, intensity * 1.4);
                const alpha = alphaSource * cloudOpacity * (cloudUsesAlpha ? 1 : 1.25);
                r += Math.min(255, rawR * cloudBoost) * alpha;
                g += Math.min(255, rawG * cloudBoost) * alpha;
                b += Math.min(255, rawB * cloudBoost) * alpha;
                a += alpha;
              }

              if (weatherTexture && showWeatherLayer) {
                const tx = Math.min(GIBS_WMS_WIDTH - 1, Math.max(0, Math.floor(u * GIBS_WMS_WIDTH)));
                const ty = Math.min(GIBS_WMS_HEIGHT - 1, Math.max(0, Math.floor(v * GIBS_WMS_HEIGHT)));
                const idx = (ty * GIBS_WMS_WIDTH + tx) * 4;
                const rawR = weatherTexture.data[idx];
                const rawG = weatherTexture.data[idx + 1];
                const rawB = weatherTexture.data[idx + 2];
                const rawAlpha = weatherTexture.data[idx + 3] / 255;
                const intensity = Math.max(rawR, rawG, rawB) / 255;
                const alphaSource = weatherUsesAlpha ? rawAlpha : Math.min(1, intensity * 1.5);
                const alpha = alphaSource * weatherOpacity * (weatherUsesAlpha ? 1 : 1.3);
                r += Math.min(255, rawR * weatherBoost) * alpha;
                g += Math.min(255, rawG * weatherBoost) * alpha;
                b += Math.min(255, rawB * weatherBoost) * alpha;
                a += alpha;
              }

              if (a <= 0) continue;

              const outIdx = (sy * sampleWidth + sx) * 4;
              const invA = 1 / a;
              data[outIdx] = Math.min(255, Math.round(r * invA));
              data[outIdx + 1] = Math.min(255, Math.round(g * invA));
              data[outIdx + 2] = Math.min(255, Math.round(b * invA));
              data[outIdx + 3] = Math.min(255, Math.round(a * 255));
            }
          }

          rasterCtx.putImageData(imageData, 0, 0);
          ctx.drawImage(rasterCanvas, 0, 0, width, height);
        }
      }
    }

    if (showDayNight && overlayInvert) {
      const sampleStep = isDragging ? 10 : 6;
      const sampleWidth = Math.ceil(width / sampleStep);
      const sampleHeight = Math.ceil(height / sampleStep);
      let rasterCanvas = overlayRasterRef.current;
      if (!rasterCanvas) {
        rasterCanvas = document.createElement('canvas');
        overlayRasterRef.current = rasterCanvas;
      }

      if (rasterCanvas.width !== sampleWidth || rasterCanvas.height !== sampleHeight) {
        rasterCanvas.width = sampleWidth;
        rasterCanvas.height = sampleHeight;
      }

      const rasterCtx = rasterCanvas.getContext('2d');
      if (rasterCtx) {
        const imageData = rasterCtx.createImageData(sampleWidth, sampleHeight);
        const data = imageData.data;
        const sunLonLat: [number, number] = [sunPosition.longitude, sunPosition.latitude];

        for (let sy = 0; sy < sampleHeight; sy++) {
          const y = (sy + 0.5) * sampleStep;
          for (let sx = 0; sx < sampleWidth; sx++) {
            const x = (sx + 0.5) * sampleStep;
            const lonLat = overlayInvert([x, y]);
            if (!lonLat) continue;

            const distance = d3.geoDistance(lonLat as [number, number], sunLonLat);
            const nightFactor = Math.max(0, (distance - Math.PI / 2) / (Math.PI / 2));
            const darkness = Math.min(0.8, nightFactor * 0.8);
            if (darkness <= 0) continue;

            const idx = (sy * sampleWidth + sx) * 4;
            data[idx] = 6;
            data[idx + 1] = 10;
            data[idx + 2] = 16;
            data[idx + 3] = Math.floor(darkness * 255);
          }
        }

        rasterCtx.putImageData(imageData, 0, 0);
        ctx.drawImage(rasterCanvas, 0, 0, width, height);
      }
    }

    if (shouldClipSphere) {
      ctx.restore();
    }

    if (showSun) {
      const sunCoords = projection([sunPosition.longitude, sunPosition.latitude]);
      if (sunCoords) {
        const [sunX, sunY] = sunCoords;
        const size = Math.min(width, height) * 0.24;
        const dirX = (sunX - width / 2) || 1;
        const dirY = (sunY - height / 2) || -1;
        const mag = Math.hypot(dirX, dirY) || 1;
        const offsetX = sunX + (dirX / mag) * size * 1.6;
        const offsetY = sunY + (dirY / mag) * size * 1.6;

        const glow = ctx.createRadialGradient(offsetX, offsetY, 0, offsetX, offsetY, size);
        glow.addColorStop(0, "rgba(255, 228, 170, 0.18)");
        glow.addColorStop(0.5, "rgba(255, 200, 120, 0.1)");
        glow.addColorStop(1, "rgba(255, 200, 120, 0)");

        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(offsetX, offsetY, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [
    dimensions,
    progress,
    mapVariant,
    projection,
    projectionInvert,
    showDayNight,
    showSun,
    showCloudLayer,
    showWeatherLayer,
    sunPosition,
    gibsDate,
    isDragging,
    isZooming,
    overlayRefresh,
  ]);

  // Render camera markers on canvas
  useEffect(() => {
    if (!canvasRef.current || worldData.length === 0 || dimensions.width === 0 || !projection) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const markerScale = Math.max(0.4, markerSize);
    const glowScale = Math.max(0, glowIntensity);
    const glowAlphaStrong = Math.min(1, 0.4 * glowScale);
    const glowAlphaMid = Math.min(1, 0.12 * glowScale);

    // Draw clusters/cameras
    visibleClusters.forEach(({ cluster, x, y }) => {
      const isHovered = hoveredCluster?.id === cluster.id;
      // Logarithmic scaling for radius: visibly larger for more items, but capped
      const baseRadius = cluster.count === 1 ? 3 : Math.min(10 + Math.log10(cluster.count) * 3, 25);
      const scaledBase = baseRadius * markerScale;
      const radius = (isHovered ? scaledBase * 1.2 : scaledBase) * Math.min(zoom, 1.5);

      if (glowScale > 0.02) {
        const glowRadius = radius * 3 * glowScale;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
        gradient.addColorStop(0, `rgba(255, 248, 220, ${glowAlphaStrong})`);
        gradient.addColorStop(0.5, `rgba(255, 248, 220, ${glowAlphaMid})`);
        gradient.addColorStop(1, 'rgba(255, 248, 220, 0)');

        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Core marker
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? 'rgba(255, 248, 220, 0.9)' : 'rgba(255, 248, 220, 0.6)';
      ctx.fill();

      // Cluster count
      // Cluster count - show exact count
      if (showClusterLabels && cluster.count > 1 && radius > 8) {
        // Adjust font size to fit inside circle
        const fontSize = Math.min(radius * 0.9, 12);
        ctx.font = `600 ${fontSize}px JetBrains Mono`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(cluster.count), x, y);
      }
    });

  }, [visibleClusters, dimensions, hoveredCluster, worldData, projection, zoom, markerSize, showClusterLabels, glowIntensity]);

  // Handle canvas mouse events
  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = event.clientX;
    const clientY = event.clientY;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    hoverPendingMouseRef.current = [x, y];

    if (hoverRafRef.current === null) {
      hoverRafRef.current = requestAnimationFrame(() => {
        const pending = hoverPendingMouseRef.current;
        if (!pending) {
          hoverRafRef.current = null;
          return;
        }

        let found: CameraCluster | null = null;
        const markerScale = Math.max(0.4, markerSize);
        for (const { cluster, x: cx, y: cy } of visibleClusters) {
          const baseRadius = cluster.count === 1 ? 3 : Math.min(10 + Math.log10(cluster.count) * 3, 25);
          const radius = baseRadius * Math.min(zoom, 1.5) * markerScale * 1.2; // Use hovered size for hit test tolerance
          if (Math.hypot(pending[0] - cx, pending[1] - cy) < radius) {
            found = cluster;
            break;
          }
        }

        if (hoveredClusterRef.current?.id !== found?.id) {
          hoveredClusterRef.current = found;
          setHoveredCluster(found);
          onClusterSelect?.(found ?? null);
        }

        if (found) {
          setTooltipPos({ x: clientX, y: clientY });
        }

        hoverPendingMouseRef.current = null;
        hoverRafRef.current = null;
      });
    }
  }, [visibleClusters, onClusterSelect, zoom, markerSize]);

  const handleCanvasMouseLeave = useCallback(() => {
    hoverPendingMouseRef.current = null;
    if (hoverRafRef.current !== null) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    if (hoveredClusterRef.current !== null) {
      hoveredClusterRef.current = null;
      setHoveredCluster(null);
      onClusterSelect?.(null);
    }
  }, [onClusterSelect]);

  // Handle click on camera
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    // Only process click if drag distance was minimal (not a drag operation)
    // This prevents accidental node selection when releasing after dragging on globe
    if (dragDistanceRef.current > DRAG_THRESHOLD) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // Find clicked cluster
    const markerScale = Math.max(0.4, markerSize);
    for (const { cluster, x: cx, y: cy } of visibleClusters) {
      const baseRadius = cluster.count === 1 ? 3 : Math.min(10 + Math.log10(cluster.count) * 3, 25);
      const radius = baseRadius * Math.min(zoom, 1.5) * markerScale * 1.2;

      if (Math.hypot(x - cx, y - cy) < radius) {
        const targetRotation: [number, number] = [
          -cluster.longitude,
          Math.max(-90, Math.min(90, -cluster.latitude)),
        ];

        if (cluster.count === 1 && cluster.cameras[0]) {
          // Single camera - open detail
          onCameraSelect?.(cluster.cameras[0]);
          const targetZoom = Math.max(zoom, 1.5);
          animateViewTo(targetRotation, targetZoom);
        } else {
          // Cluster - zoom in
          const zoomBoost = 1 + Math.min(2, Math.log10(Math.max(2, cluster.count)));
          const targetZoom = Math.max(zoom * zoomBoost, zoom + 0.35);
          animateViewTo(targetRotation, targetZoom);
        }
        break;
      }
    }
  }, [visibleClusters, zoom, onCameraSelect, animateViewTo, markerSize]);

  const handleAnimate = useCallback(() => {
    if (isAnimating) return;

    setIsAnimating(true);
    const startProgress = progress;
    const endProgress = startProgress === 0 ? 100 : 0;
    const duration = 1600;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const currentProgress = startProgress + (endProgress - startProgress) * eased;

      setProgress(currentProgress);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    animate();
  }, [isAnimating, progress]);

  const handleMapVariantSelect = useCallback((variant: 'outline' | 'openstreetmap') => {
    setMapVariant(variant);
    onMapVariantChange?.(variant);
  }, [onMapVariantChange]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-grab active:cursor-grabbing touch-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Base texture canvas */}
      <canvas
        ref={baseCanvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      {/* SVG for globe geometry */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Overlay canvas for sun/day-night/clouds/weather */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Canvas for camera markers */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-auto touch-none"
        style={{ width: '100%', height: '100%' }}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        onClick={handleCanvasClick}
      />

      {/* Zoom Controls */}
      <div className="absolute right-3 top-24 translate-y-0 z-10 sm:right-6 sm:top-1/2 sm:-translate-y-1/2">
        <ZoomControls
          zoom={zoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleZoomReset}
        />
      </div>

      {/* Cluster tooltip */}
      <AnimatePresence>
        {hoveredCluster && !isDragging && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 pointer-events-none"
            style={{ left: tooltipPos.x + 15, top: tooltipPos.y - 10 }}
          >
            <div className="hud-panel rounded-sm p-3 min-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
                <span className="font-mono text-xs uppercase tracking-wider text-white/80">
                  {hoveredCluster.count === 1 ? 'Camera · Click to view' : 'Cluster · Click to zoom'}
                </span>
              </div>
              {hoveredCluster.count === 1 && hoveredCluster.cameras[0] && (
                <>
                  <p className="text-sm font-medium text-white mb-1">
                    {hoveredCluster.cameras[0].city}
                  </p>
                  <p className="text-xs text-white/80">
                    {hoveredCluster.cameras[0].country}
                  </p>
                  {hoveredCluster.cameras[0].image_url && (
                    <div className="mt-2 rounded overflow-hidden border border-border">
                      <img
                        src={hoveredCluster.cameras[0].image_url}
                        alt="Camera preview"
                        className="w-full h-24 object-cover"
                      />
                    </div>
                  )}
                </>
              )}
              {hoveredCluster.count > 1 && (
                <>
                  <p className="text-2xl font-mono font-medium text-white">
                    {hoveredCluster.count.toLocaleString()}
                  </p>
                  <p className="text-xs text-white/80">cameras in this area</p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom controls */}
      <div className="absolute bottom-20 left-3 right-3 flex flex-col gap-2 z-10 sm:bottom-10 sm:left-auto sm:right-6 sm:flex-row sm:items-center sm:gap-3">
        <button
          onClick={handleAnimate}
          disabled={isAnimating}
          className="hud-panel corner-accents w-full sm:w-auto px-4 py-2 font-mono text-xs uppercase tracking-wider text-white hover:bg-secondary/50 transition-colors disabled:opacity-50"
        >
          {isAnimating ? "Morphing..." : progress === 100 ? "View as Globe" : "View as Map"}
        </button>

        <div className="hud-panel corner-accents w-full sm:w-auto flex items-center gap-1 p-1">
          <button
            onClick={() => handleMapVariantSelect('outline')}
            className={`flex-1 sm:flex-none px-3 py-1 text-center font-mono text-[10px] uppercase tracking-wider transition-colors ${mapVariant === 'outline' ? 'text-white bg-secondary/60' : 'text-white/70 hover:text-white'}`}
          >
            Outline
          </button>
          <button
            onClick={() => handleMapVariantSelect('openstreetmap')}
            className={`flex-1 sm:flex-none px-3 py-1 text-center font-mono text-[10px] uppercase tracking-wider transition-colors ${mapVariant === 'openstreetmap' ? 'text-white bg-secondary/60' : 'text-white/70 hover:text-white'}`}
          >
            OpenStreetMap
          </button>
        </div>
      </div>

      {/* Zoom level indicator */}
      <div className="absolute bottom-20 left-3 z-10 sm:bottom-10 sm:left-6">
        <div className="hud-panel px-3 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/80">
            Zoom: {zoom.toFixed(2)}x
          </span>
        </div>
      </div>
    </div>
  );
}
