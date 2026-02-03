import { useEffect, useMemo, useRef } from 'react';
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cesium3DTileset,
  Color,
  Ellipsoid,
  GeoJsonDataSource,
  Ion,
  Math as CesiumMath,
  PointPrimitiveCollection,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  SceneMode,
  WebMercatorProjection,
  Rectangle,
  Viewer,
  createWorldTerrainAsync,
} from 'cesium';
import type { CameraData } from '@/types/camera';

interface CesiumGlobeProps {
  cameras: CameraData[];
  onCameraSelect?: (camera: CameraData) => void;
  selectedCameraId?: string | null;
  autoRotateEnabled?: boolean;
  autoRotateSpeed?: number;
  markerSize?: number;
  cloudsEnabled?: boolean;
  cloudsOpacity?: number;
  showCountryBorders?: boolean;
  showNavigationControls?: boolean;
  viewMode?: 'globe' | 'map';
  onReadyChange?: (ready: boolean) => void;
}

export function CesiumGlobe({
  cameras,
  onCameraSelect,
  selectedCameraId,
  autoRotateEnabled = false,
  autoRotateSpeed = 1.25,
  markerSize = 1,
  cloudsEnabled = true,
  cloudsOpacity = 0.55,
  showCountryBorders = false,
  showNavigationControls = false,
  viewMode = 'globe',
  onReadyChange,
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const markerLayerRef = useRef<PointPrimitiveCollection | null>(null);
  const bordersDataSourceRef = useRef<GeoJsonDataSource | null>(null);
  const clickHandlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const onCameraSelectRef = useRef<CesiumGlobeProps['onCameraSelect']>(onCameraSelect);
  const markerIndexRef = useRef<Map<string, any>>(new Map());
  const selectedIdRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const scratchDiffRef = useRef(new Cartesian3());
  const scratchToPointRef = useRef(new Cartesian3());
  const scratchCamUnitRef = useRef(new Cartesian3());

  useEffect(() => {
    onCameraSelectRef.current = onCameraSelect;
  }, [onCameraSelect]);

  const applyCulling = (v: Viewer, layer: PointPrimitiveCollection) => {
    const camPos = v.camera.positionWC;
    const scratchDiff = scratchDiffRef.current;
    const scratchToPoint = scratchToPointRef.current;
    const camUnit = scratchCamUnitRef.current;

    const earthRadius = Ellipsoid.WGS84.maximumRadius;
    const camMag = Cartesian3.magnitude(camPos);
    const horizonDot = earthRadius / camMag;
    Cartesian3.normalize(camPos, camUnit);

    const height = v.camera.positionCartographic.height;
    const margin = height < 50_000 ? -0.01 : 0.002;
    const nearMeters = 200_000;

    const len = (layer as any).length as number | undefined;
    const count = typeof len === 'number' ? len : 0;
    for (let i = 0; i < count; i++) {
      const p = (layer as any).get(i);
      const pos = p?.position;
      if (!pos) continue;

      Cartesian3.subtract(pos, camPos, scratchDiff);
      if (Cartesian3.magnitudeSquared(scratchDiff) < nearMeters * nearMeters) {
        p.show = true;
        continue;
      }

      Cartesian3.normalize(pos, scratchToPoint);
      const d = Cartesian3.dot(scratchToPoint, camUnit);
      p.show = d > (horizonDot + margin);
    }
  };

  useEffect(() => {
    const token = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
    Ion.defaultAccessToken = token ?? '';
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    if (viewerRef.current) return;

    const v = new Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      vrButton: false,
      shouldAnimate: true,
    });

    // Make 2D mode look like a standard web map (Google/OSM-like Web Mercator)
    // instead of the default geographic projection.
    try {
      (v.scene as any).mapProjection = new WebMercatorProjection(Ellipsoid.WGS84);
    } catch {
      // ignore
    }

    viewerRef.current = v;

    onReadyChange?.(false);
    let terrainReady = false;
    let tilesReady = false;
    let frameReady = false;
    let stableFrames = 0;
    let postRenderRemove: (() => void) | null = null;
    let readyTimeout: number | null = null;
    const maybeReady = () => {
      if (!(terrainReady && tilesReady)) return;

      if (!frameReady) {
        const onPostRender = () => {
          try {
            if (v.isDestroyed()) return;

            const globeLoaded = (v.scene.globe as any)?.tilesLoaded === true;
            const tilesetLoaded = tileset ? (tileset as any).tilesLoaded === true : true;

            // Heuristic: globe has produced draw commands (prevents "only markers" moment).
            const commandCount = ((v.scene as any).frameState?.commandList?.length as number | undefined) ?? 0;
            const hasSurfaceCommands = commandCount > 0;

            if (globeLoaded && tilesetLoaded && hasSurfaceCommands) {
              stableFrames += 1;
            } else {
              stableFrames = 0;
            }

            if (stableFrames >= 3) {
              frameReady = true;
              postRenderRemove?.();
              postRenderRemove = null;
              if (readyTimeout != null) {
                window.clearTimeout(readyTimeout);
                readyTimeout = null;
              }
              onReadyChange?.(true);
            }
          } catch {
            // ignore
          }
        };

        try {
          v.scene.postRender.addEventListener(onPostRender);
          postRenderRemove = () => {
            try {
              v.scene.postRender.removeEventListener(onPostRender);
            } catch {
              // ignore
            }
          };
          v.scene.requestRender();
        } catch {
          frameReady = true;
          onReadyChange?.(true);
        }

        // Safety: never block forever if something weird happens.
        if (readyTimeout == null) {
          readyTimeout = window.setTimeout(() => {
            readyTimeout = null;
            if (!frameReady) {
              frameReady = true;
              postRenderRemove?.();
              postRenderRemove = null;
              onReadyChange?.(true);
            }
          }, 20_000);
        }

        return;
      }

      onReadyChange?.(true);
    };

    const owmToken = import.meta.env.VITE_OPENWEATHERMAP_TOKEN as string | undefined;
    let cloudsLayer: any | null = null;
    if (owmToken && cloudsEnabled) {
      try {
        const provider = new UrlTemplateImageryProvider({
          url: `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${encodeURIComponent(owmToken)}`,
          credit: 'OpenWeatherMap',
        });
        cloudsLayer = v.imageryLayers.addImageryProvider(provider);
        cloudsLayer.alpha = Math.max(0, Math.min(1, cloudsOpacity));
      } catch (e) {
        console.error('Failed to create OpenWeatherMap clouds layer', e);
      }
    }

    const ro = new ResizeObserver(() => {
      try {
        v.resize();
        v.scene.requestRender();
      } catch {
        // ignore
      }
    });
    ro.observe(containerRef.current);

    // Ensure Cesium sizes correctly in an absolutely-positioned container.
    // (Fixes "off center"/mis-sized canvas on first paint.)
    queueMicrotask(() => {
      try {
        v.resize();
        v.scene.requestRender();
      } catch {
        // ignore
      }
    });

    // Remove the starfield/grid-like background.
    v.scene.skyBox = undefined;
    v.scene.skyAtmosphere = undefined;
    v.scene.sun = undefined;
    v.scene.moon = undefined;
    v.scene.backgroundColor = Color.fromCssColorString('#05070b');

    v.scene.globe.enableLighting = false;
    v.scene.globe.showGroundAtmosphere = true;
    v.scene.screenSpaceCameraController.enableTilt = true;
    v.scene.globe.depthTestAgainstTerrain = false;

    // Show Cesium's built-in compass/tilt widget.
    // (Cesium adds it when navigationHelpButton is enabled + widgets CSS is loaded.)
    try {
      (v as any).cesiumWidget?.creditContainer?.style && ((v as any).cesiumWidget.creditContainer.style.display = 'none');
    } catch {
      // ignore
    }

    // Google-Maps-like "heading/tilt" controls: Cesium's navigation help button/compass widget.
    // We keep the Viewer option disabled and instead toggle the widget container directly.
    try {
      const navContainer = (v as any).cesiumWidget?.navigationHelpButton?.container as HTMLElement | undefined;
      if (navContainer) navContainer.style.display = showNavigationControls ? '' : 'none';
    } catch {
      // ignore
    }

    // Reduce depth precision artifacts (z-fighting) when mixing globe + terrain + 3D tiles.
    v.scene.logarithmicDepthBuffer = true;

    // Stable initial framing after refresh.
    // Use a bounding sphere around Earth so the globe is centered regardless of container sizing quirks.
    requestAnimationFrame(() => {
      try {
        v.resize();
        const earthRadius = 6378137.0;
        const sphere = new BoundingSphere(Cartesian3.ZERO, earthRadius);
        v.camera.flyToBoundingSphere(sphere, {
          duration: 0.0,
          offset: new (Cartesian3 as any).HeadingPitchRange(
            0,
            CesiumMath.toRadians(-25),
            earthRadius * 3.0
          ),
        } as any);
        v.scene.requestRender();
      } catch {
        // ignore
      }
    });

    const markers = new PointPrimitiveCollection();
    markerLayerRef.current = markers;
    v.scene.primitives.add(markers);

    const handler = new ScreenSpaceEventHandler(v.scene.canvas);
    clickHandlerRef.current = handler;
    handler.setInputAction((movement: any) => {
      const picked = v.scene.pick(movement.position as Cartesian2);
      const cam: CameraData | undefined = picked?.primitive?.id?.__camera;
      if (cam) onCameraSelectRef.current?.(cam);
    }, ScreenSpaceEventType.LEFT_CLICK);

    let destroyed = false;
    let tileset: Cesium3DTileset | null = null;
    (async () => {
      try {
        const terrain = await createWorldTerrainAsync();
        if (destroyed) return;
        v.terrainProvider = terrain;
        terrainReady = true;
        maybeReady();
      } catch (e) {
        console.error('Failed to create world terrain', e);
        terrainReady = true;
        maybeReady();
      }
    })();

    (async () => {
      try {
        tileset = await Cesium3DTileset.fromIonAssetId(2275207);
        if (destroyed) {
          tileset.destroy();
          return;
        }
        tileset.dynamicScreenSpaceError = true;
        tileset.skipLevelOfDetail = true;
        tileset.baseScreenSpaceError = 1024;
        tileset.skipScreenSpaceErrorFactor = 16;
        tileset.skipLevels = 1;
        v.scene.primitives.add(tileset);

        v.scene.globe.show = true;
        v.scene.requestRender();

        tilesReady = true;
        maybeReady();
      } catch (e) {
        console.error('Failed to load Cesium Ion tileset 2275207', e);
        tilesReady = true;
        maybeReady();
      }
    })();

    const updateMarkerVisibility = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        const layer = markerLayerRef.current;
        if (!layer) return;

        applyCulling(v, layer);

        v.scene.requestRender();
      });
    };

    v.camera.changed.addEventListener(updateMarkerVisibility);

    let autoRotateRaf: number | null = null;
    const stepAutoRotate = () => {
      autoRotateRaf = requestAnimationFrame(stepAutoRotate);
      // The actual enable/disable is handled by the effect below; this keeps the RAF alive cheaply.
    };
    autoRotateRaf = requestAnimationFrame(stepAutoRotate);

    return () => {
      destroyed = true;
      onReadyChange?.(false);
      postRenderRemove?.();
      postRenderRemove = null;
      if (readyTimeout != null) {
        window.clearTimeout(readyTimeout);
        readyTimeout = null;
      }
      ro.disconnect();
      v.camera.changed.removeEventListener(updateMarkerVisibility);
      if (cloudsLayer) {
        try {
          v.imageryLayers.remove(cloudsLayer, true);
        } catch {
          // ignore
        }
        cloudsLayer = null;
      }
      if (autoRotateRaf != null) {
        cancelAnimationFrame(autoRotateRaf);
        autoRotateRaf = null;
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (clickHandlerRef.current) {
        clickHandlerRef.current.destroy();
        clickHandlerRef.current = null;
      }
      if (tileset && !tileset.isDestroyed()) {
        v.scene.primitives.remove(tileset);
        tileset.destroy();
      }
      if (markerLayerRef.current) {
        v.scene.primitives.remove(markerLayerRef.current);
        markerLayerRef.current.destroy();
        markerLayerRef.current = null;
      }
      if (bordersDataSourceRef.current) {
        try {
          v.dataSources.remove(bordersDataSourceRef.current, true);
        } catch {
          // ignore
        }
        bordersDataSourceRef.current = null;
      }
      v.destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;

    try {
      const navContainer = (v as any).cesiumWidget?.navigationHelpButton?.container as HTMLElement | undefined;
      if (navContainer) navContainer.style.display = showNavigationControls ? '' : 'none';
    } catch {
      // ignore
    }
  }, [showNavigationControls]);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;

    let cancelled = false;

    const applyVisibility = () => {
      const ds = bordersDataSourceRef.current;
      if (!ds) return;
      ds.show = showCountryBorders;
      v.scene.requestRender();
    };

    if (!showCountryBorders) {
      applyVisibility();
      return;
    }

    if (bordersDataSourceRef.current) {
      applyVisibility();
      return;
    }

    (async () => {
      try {
        // Public-domain Natural Earth-derived country boundaries (GeoJSON).
        // If you prefer an offline bundle later, we can move this into /public and reference it locally.
        // NOTE: Some "countries" GeoJSON datasets include polygons that can trip Cesium's polygon outline
        // generation (RangeError: Invalid array length). To avoid that, we load a *line-only* boundaries
        // dataset and force entities to render as polylines.
        const url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_boundary_lines_land.geojson';
        const ds = await GeoJsonDataSource.load(url, {
          stroke: Color.WHITE.withAlpha(0.55),
          fill: Color.TRANSPARENT,
          strokeWidth: 1,
        } as any);

        // Extra safety: ensure we never attempt to render polygons (only polylines).
        try {
          const entities = ds.entities.values;
          for (const e of entities) {
            if ((e as any).polygon) (e as any).polygon = undefined;
            if ((e as any).polyline) {
              (e as any).polyline.width = 1;
              (e as any).polyline.material = Color.WHITE.withAlpha(0.55) as any;
              (e as any).polyline.clampToGround = true;
            }
          }
        } catch {
          // ignore
        }

        if (cancelled || v.isDestroyed()) return;

        bordersDataSourceRef.current = ds;
        v.dataSources.add(ds);
        ds.show = showCountryBorders;
        v.scene.requestRender();
      } catch (e) {
        console.error('Failed to load country borders GeoJSON', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showCountryBorders]);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;

    const target = viewMode === 'map' ? SceneMode.SCENE2D : SceneMode.SCENE3D;
    if (v.scene.mode === target) return;

    try {
      if (target === SceneMode.SCENE2D) {
        v.scene.morphTo2D(0.6);

        // After switching to 2D, ensure we start from a "normal map" framing.
        // (Avoid awkward camera pitch/heading carried over from 3D.)
        setTimeout(() => {
          try {
            if (v.isDestroyed()) return;
            v.camera.setView({
              destination: Rectangle.fromDegrees(-180, -85, 180, 85),
              orientation: {
                heading: 0,
                pitch: CesiumMath.toRadians(-90),
                roll: 0,
              },
            } as any);
            v.scene.requestRender();
          } catch {
            // ignore
          }
        }, 650);
      } else {
        v.scene.morphTo3D(0.6);
      }
      v.scene.requestRender();
    } catch {
      // ignore
    }
  }, [viewMode]);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;

    const owmToken = import.meta.env.VITE_OPENWEATHERMAP_TOKEN as string | undefined;
    if (!owmToken) return;

    let layer: any | null = null;
    const count = (v.imageryLayers as any).length as number | undefined;
    const n = typeof count === 'number' ? count : 0;
    for (let i = 0; i < n; i++) {
      const maybe = (v.imageryLayers as any).get(i);
      if (maybe?.imageryProvider?.credit?.text === 'OpenWeatherMap') {
        layer = maybe;
        break;
      }
    }

    if (cloudsEnabled) {
      if (!layer) {
        try {
          const provider = new UrlTemplateImageryProvider({
            url: `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${encodeURIComponent(owmToken)}`,
            credit: 'OpenWeatherMap',
          });
          layer = v.imageryLayers.addImageryProvider(provider);
        } catch (e) {
          console.error('Failed to create OpenWeatherMap clouds layer', e);
          return;
        }
      }
      layer.alpha = Math.max(0, Math.min(1, cloudsOpacity));
      layer.show = true;
    } else if (layer) {
      layer.show = false;
    }

    v.scene.requestRender();
  }, [cloudsEnabled, cloudsOpacity]);

  const markerData = useMemo(() => {
    return cameras
      .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
      .map((c) => ({
        camera: c,
        position: Cartesian3.fromDegrees(c.longitude, c.latitude, 0),
        selected: selectedCameraId != null && c.id === selectedCameraId,
      }));
  }, [cameras, selectedCameraId]);

  useEffect(() => {
    const v = viewerRef.current;
    const layer = markerLayerRef.current;
    if (!v || !layer) return;

    layer.removeAll();
    markerIndexRef.current.clear();
    selectedIdRef.current = selectedCameraId ?? null;

    for (const item of markerData) {
      const p = layer.add({
        position: Cartesian3.fromDegrees(item.camera.longitude, item.camera.latitude, 50),
        pixelSize: (item.selected ? 10 : 6) * markerSize,
        color: item.selected ? Color.YELLOW : Color.CYAN.withAlpha(0.85),
        outlineColor: Color.BLACK.withAlpha(0.4),
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: true,
      });
      (p as any).id = { __camera: item.camera };
      markerIndexRef.current.set(item.camera.id, p as any);
    }

    applyCulling(v, layer);

    v.scene.requestRender();
  }, [markerData, markerSize]);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;

    if (!autoRotateEnabled) return;
    if (viewMode === 'map') return;

    let rafId: number | null = null;
    let last = performance.now();
    const tick = (t: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = (t - last) / 1000;
      last = t;
      // Degrees/sec -> radians/sec
      const radians = CesiumMath.toRadians(autoRotateSpeed) * dt;
      // Rotate around world Z axis.
      v.camera.rotate(Cartesian3.UNIT_Z, radians);
      v.scene.requestRender();
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [autoRotateEnabled, autoRotateSpeed, viewMode]);

  return (
    <div className="absolute inset-0" ref={containerRef} />
  );
}
