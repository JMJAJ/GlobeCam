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
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = Number.POSITIVE_INFINITY;
const ZOOM_FACTOR = 1.15;
const MAP_TEXTURE_URL = "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg";

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

export function GlobeVisualization({ cameras, onCameraSelect, onClusterSelect, onRotationChange, onProgressChange }: GlobeVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textureRef = useRef<HTMLImageElement | null>(null);
  const textureDataRef = useRef<ImageData | null>(null);
  const rasterCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isAnimating, setIsAnimating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [worldData, setWorldData] = useState<GeoFeature[]>([]);
  const [rotation, setRotation] = useState<[number, number]>([0, 0]);
  const [zoom, setZoom] = useState(1);
  const [mapVariant, setMapVariant] = useState<'outline' | 'satellite'>('outline');
  const [isDragging, setIsDragging] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredCluster, setHoveredCluster] = useState<CameraCluster | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [textureReady, setTextureReady] = useState(false);
  const [mapOffset, setMapOffset] = useState<[number, number]>([0, 0]);
  const resizeRafRef = useRef<number | null>(null);
  const viewAnimationRef = useRef<number | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const dragPendingMouseRef = useRef<[number, number] | null>(null);
  const lastMouseRef = useRef<[number, number]>([0, 0]);
  const isDraggingRef = useRef(false);
  const dragDistanceRef = useRef(0);
  const DRAG_THRESHOLD = 5;
  const hoverRafRef = useRef<number | null>(null);
  const hoverPendingMouseRef = useRef<[number, number] | null>(null);
  const hoveredClusterRef = useRef<CameraCluster | null>(null);

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
      // Full flat map mode - use standard equirectangular with offset panning
      const projection = d3.geoEquirectangular()
        .scale(Math.min(width, height) * 0.25 * zoom)
        .translate([width / 2 + mapOffset[0], height / 2 + mapOffset[1]])
        .rotate([0, 0]) // No rotation in flat map mode
        .precision(0.1);
      return projection;
    }

    // Globe or transitioning mode - use interpolated projection
    const projection = interpolateProjection(d3.geoOrthographicRaw, d3.geoEquirectangularRaw)
      .scale(baseScale(alpha) * zoom)
      .translate([width / 2, height / 2])
      .rotate([rotation[0], rotation[1]])
      .precision(0.1);

    projection.alpha(alpha);
    return projection;
  }, [progress, rotation, zoom, mapOffset]);

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
    // Grid size in degrees. larger = fewer clusters.
    // At zoom 1 -> 30 deg. At zoom 4 -> ~7 deg.
    const cellSize = 30 / Math.max(0.5, stableZoom);
    return buildGridClusters(cameras, cellSize);
  }, [cameras, stableZoom]);

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

    return result;
  }, [worldClusters, projection, rotationCenter, progress, dimensions.width, dimensions.height]);

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

  // Load satellite texture
  useEffect(() => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = MAP_TEXTURE_URL;

    image.onload = () => {
      textureRef.current = image;
      const offscreen = document.createElement("canvas");
      offscreen.width = image.width;
      offscreen.height = image.height;
      const offCtx = offscreen.getContext("2d");
      if (offCtx) {
        try {
          offCtx.drawImage(image, 0, 0);
          textureDataRef.current = offCtx.getImageData(0, 0, image.width, image.height);
        } catch (error) {
          console.warn("Satellite texture pixel access blocked; falling back to map-only render.", error);
          textureDataRef.current = null;
        }
      }
      setTextureReady(true);
    };
    image.onerror = (error) => {
      console.warn("Failed to load satellite texture.", error);
      setTextureReady(false);
      textureDataRef.current = null;
      textureRef.current = null;
    };
  }, []);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
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

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentMouse: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];

    if (isDraggingRef.current) {
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
    }
  }, [progress, zoom, rotation]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    isDraggingRef.current = false;
    dragPendingMouseRef.current = null;
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
  }, []);

  const normalizeAngle = useCallback((angle: number) => {
    const wrapped = ((angle + 180) % 360 + 360) % 360 - 180;
    return wrapped;
  }, []);

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
    if (!svgRef.current || worldData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

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

  }, [worldData, dimensions, createProjection, progress]);

  // Render satellite texture on base canvas
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

    if (mapVariant !== 'satellite' || !textureReady) return;

    const textureImage = textureRef.current;
    if (!textureImage) return;

    const isFullMapMode = progress >= 100;

    // FAST PATH: For flat map mode, use direct canvas drawImage (instant, 60fps)
    if (isFullMapMode) {
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Calculate draw size based on zoom
      const drawWidth = width * zoom;
      const drawHeight = (drawWidth / textureImage.width) * textureImage.height;
      const drawX = (width - drawWidth) / 2 + mapOffset[0];
      const drawY = (height - drawHeight) / 2 + mapOffset[1];

      ctx.globalAlpha = 0.95;
      ctx.drawImage(textureImage, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();
      return;
    }

    // GLOBE/TRANSITION MODE: Need projection-based rendering
    if (!projection || !projectionInvert) return;

    const invert = projectionInvert;
    const texture = textureDataRef.current;

    // If pixel data isn't accessible, fallback to a flat map draw when in map view.
    if (!texture) {
      if (progress >= 95 && textureImage) {
        ctx.globalAlpha = 0.95;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(textureImage, 0, 0, width, height);
      }
      return;
    }

    const isGlobeView = progress < 95;
    if (isGlobeView) {
      const radius = (projection as any).scale?.() ?? Math.min(width, height) * 0.4;
      ctx.save();
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      ctx.clip();
    }

    // Aggressive LOD for 60fps target
    // Globe mode needs per-pixel sampling which is expensive, so use larger steps
    let sampleStep: number;
    if (isDragging) {
      sampleStep = 8; // Very low quality during interaction for 60fps
    } else if (zoom >= 4) {
      sampleStep = 2; // High quality at very high zoom
    } else if (zoom >= 2) {
      sampleStep = 3; // Medium-high quality
    } else if (zoom >= 1) {
      sampleStep = 4; // Medium quality at default zoom
    } else {
      sampleStep = 6; // Lower quality when zoomed out
    }
    const sampleWidth = Math.ceil(width / sampleStep);
    const sampleHeight = Math.ceil(height / sampleStep);

    let rasterCanvas = rasterCanvasRef.current;
    if (!rasterCanvas) {
      rasterCanvas = document.createElement('canvas');
      rasterCanvasRef.current = rasterCanvas;
    }

    if (rasterCanvas.width !== sampleWidth || rasterCanvas.height !== sampleHeight) {
      rasterCanvas.width = sampleWidth;
      rasterCanvas.height = sampleHeight;
    }

    const rasterCtx = rasterCanvas.getContext('2d');
    if (!rasterCtx) return;

    const imageData = rasterCtx.createImageData(sampleWidth, sampleHeight);
    const data = imageData.data;

    for (let sy = 0; sy < sampleHeight; sy++) {
      const y = (sy + 0.5) * sampleStep;
      for (let sx = 0; sx < sampleWidth; sx++) {
        const x = (sx + 0.5) * sampleStep;
        const lonLat = invert([x, y]);
        if (!lonLat) continue;
        const [lon, lat] = lonLat;
        const u = (lon + 180) / 360;
        const v = (90 - lat) / 180;
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;

        const tx = Math.min(texture.width - 1, Math.max(0, Math.floor(u * texture.width)));
        const ty = Math.min(texture.height - 1, Math.max(0, Math.floor(v * texture.height)));
        const tIndex = (ty * texture.width + tx) * 4;
        const idx = (sy * sampleWidth + sx) * 4;

        data[idx] = texture.data[tIndex];
        data[idx + 1] = texture.data[tIndex + 1];
        data[idx + 2] = texture.data[tIndex + 2];
        data[idx + 3] = 220;
      }
    }

    rasterCtx.putImageData(imageData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(rasterCanvas, 0, 0, width, height);

    if (isGlobeView) {
      ctx.restore();
    }
  }, [dimensions, mapVariant, progress, zoom, mapOffset, projection, projectionInvert, textureReady, isDragging]);

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

    // Draw clusters/cameras
    visibleClusters.forEach(({ cluster, x, y }) => {
      const isHovered = hoveredCluster?.id === cluster.id;
      // Logarithmic scaling for radius: visibly larger for more items, but capped
      const baseRadius = cluster.count === 1 ? 3 : Math.min(10 + Math.log10(cluster.count) * 3, 25);
      const radius = (isHovered ? baseRadius * 1.2 : baseRadius) * Math.min(zoom, 1.5);

      // Outer glow
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
      gradient.addColorStop(0, 'rgba(255, 248, 220, 0.4)');
      gradient.addColorStop(0.5, 'rgba(255, 248, 220, 0.1)');
      gradient.addColorStop(1, 'rgba(255, 248, 220, 0)');

      ctx.beginPath();
      ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core marker
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? 'rgba(255, 248, 220, 0.9)' : 'rgba(255, 248, 220, 0.6)';
      ctx.fill();

      // Cluster count
      // Cluster count - show exact count
      if (cluster.count > 1 && radius > 8) {
        // Adjust font size to fit inside circle
        const fontSize = Math.min(radius * 0.9, 12);
        ctx.font = `600 ${fontSize}px JetBrains Mono`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(cluster.count), x, y);
      }
    });

  }, [visibleClusters, dimensions, hoveredCluster, worldData, projection, zoom]);

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
        for (const { cluster, x: cx, y: cy } of visibleClusters) {
          const baseRadius = cluster.count === 1 ? 3 : Math.min(10 + Math.log10(cluster.count) * 3, 25);
          const radius = baseRadius * Math.min(zoom, 1.5) * 1.2; // Use hovered size for hit test tolerance
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
  }, [visibleClusters, onClusterSelect, zoom]);

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
    for (const { cluster, x: cx, y: cy } of visibleClusters) {
      const baseRadius = cluster.count === 1 ? 3 : Math.min(10 + Math.log10(cluster.count) * 3, 25);
      const radius = baseRadius * Math.min(zoom, 1.5) * 1.2;

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
  }, [visibleClusters, zoom, onCameraSelect, animateViewTo]);

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

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
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

      {/* Canvas for camera markers */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-auto"
        style={{ width: '100%', height: '100%' }}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        onClick={handleCanvasClick}
      />

      {/* Zoom Controls */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-10">
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
      <div className="absolute bottom-10 right-6 flex items-center gap-3 z-10">
        <button
          onClick={handleAnimate}
          disabled={isAnimating}
          className="hud-panel corner-accents px-4 py-2 font-mono text-xs uppercase tracking-wider text-white hover:bg-secondary/50 transition-colors disabled:opacity-50"
        >
          {isAnimating ? "Morphing..." : progress === 100 ? "View as Globe" : "View as Map"}
        </button>

        <div className="hud-panel corner-accents flex items-center gap-1 p-1">
          <button
            onClick={() => setMapVariant('outline')}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${mapVariant === 'outline' ? 'text-white bg-secondary/60' : 'text-white/70 hover:text-white'}`}
          >
            Outline
          </button>
          <button
            onClick={() => setMapVariant('satellite')}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${mapVariant === 'satellite' ? 'text-white bg-secondary/60' : 'text-white/70 hover:text-white'}`}
          >
            Satellite
          </button>
        </div>
      </div>

      {/* Zoom level indicator */}
      <div className="absolute bottom-10 left-6 z-10">
        <div className="hud-panel px-3 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/80">
            Zoom: {zoom.toFixed(2)}x
          </span>
        </div>
      </div>
    </div>
  );
}
