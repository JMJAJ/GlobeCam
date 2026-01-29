import { useEffect, useMemo, useRef } from 'react';
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cesium3DTileset,
  Color,
  Ellipsoid,
  Ion,
  Math as CesiumMath,
  PointPrimitiveCollection,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
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
}

export function CesiumGlobe({
  cameras,
  onCameraSelect,
  selectedCameraId,
  autoRotateEnabled = false,
  autoRotateSpeed = 1.25,
  markerSize = 1,
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const markerLayerRef = useRef<PointPrimitiveCollection | null>(null);
  const clickHandlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const markerIndexRef = useRef<Map<string, any>>(new Map());
  const selectedIdRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const scratchDiffRef = useRef(new Cartesian3());
  const scratchToPointRef = useRef(new Cartesian3());
  const scratchCamUnitRef = useRef(new Cartesian3());

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

    viewerRef.current = v;

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
      if (cam) onCameraSelect?.(cam);
    }, ScreenSpaceEventType.LEFT_CLICK);

    let destroyed = false;
    let tileset: Cesium3DTileset | null = null;
    (async () => {
      try {
        const terrain = await createWorldTerrainAsync();
        if (destroyed) return;
        v.terrainProvider = terrain;
      } catch (e) {
        console.error('Failed to create world terrain', e);
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

        // If this tileset includes a globe/surface layer, leaving the default globe enabled can create
        // "double globe" z-fighting artifacts. Prefer the tileset surface.
        v.scene.globe.show = false;
        v.scene.requestRender();
      } catch (e) {
        console.error('Failed to load Cesium Ion tileset 2275207', e);
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
      ro.disconnect();
      v.camera.changed.removeEventListener(updateMarkerVisibility);
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
      v.destroy();
      viewerRef.current = null;
    };
  }, [onCameraSelect]);

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
  }, [autoRotateEnabled, autoRotateSpeed]);

  return (
    <div className="absolute inset-0" ref={containerRef} />
  );
}
