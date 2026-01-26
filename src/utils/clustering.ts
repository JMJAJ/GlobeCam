import { CameraData, CameraCluster } from "@/types/camera";

interface QuadTreeNode {
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  cameras: CameraData[];
  children: QuadTreeNode[] | null;
  depth: number;
}

const MAX_CAMERAS_PER_NODE = 50;
const MAX_DEPTH = 9;

function createNode(
  bounds: QuadTreeNode['bounds'],
  cameras: CameraData[],
  depth: number
): QuadTreeNode {
  if (cameras.length <= MAX_CAMERAS_PER_NODE || depth >= MAX_DEPTH) {
    return { bounds, cameras, children: null, depth };
  }

  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const midLng = (bounds.minLng + bounds.maxLng) / 2;

  const quadrants = [
    { minLat: midLat, maxLat: bounds.maxLat, minLng: bounds.minLng, maxLng: midLng },
    { minLat: midLat, maxLat: bounds.maxLat, minLng: midLng, maxLng: bounds.maxLng },
    { minLat: bounds.minLat, maxLat: midLat, minLng: bounds.minLng, maxLng: midLng },
    { minLat: bounds.minLat, maxLat: midLat, minLng: midLng, maxLng: bounds.maxLng },
  ];

  const children = quadrants.map((q) => {
    const inQuad = cameras.filter(
      (c) =>
        c.latitude >= q.minLat &&
        c.latitude < q.maxLat &&
        c.longitude >= q.minLng &&
        c.longitude < q.maxLng
    );
    return createNode(q, inQuad, depth + 1);
  });

  return { bounds, cameras: [], children, depth };
}

export function buildQuadTree(cameras: CameraData[]): QuadTreeNode {
  const bounds = { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 };
  return createNode(bounds, cameras, 0);
}

export function getClustersAtZoom(
  tree: QuadTreeNode,
  zoomLevel: number
): CameraCluster[] {
  if (zoomLevel >= MAX_DEPTH + 2) {
    const allCameras = collectCameras(tree);
    return allCameras.map((camera, index) => ({
      id: camera.id ?? `camera-${index}`,
      latitude: camera.latitude,
      longitude: camera.longitude,
      cameras: [camera],
      count: 1,
    }));
  }

  const targetDepth = Math.min(Math.max(Math.floor(zoomLevel), 1), MAX_DEPTH);
  const clusters: CameraCluster[] = [];

  function traverse(node: QuadTreeNode) {
    if (node.children === null || node.depth >= targetDepth) {
      const allCameras = collectCameras(node);
      if (allCameras.length > 0) {
        const centerLat =
          allCameras.reduce((sum, c) => sum + c.latitude, 0) / allCameras.length;
        const centerLng = meanLongitude(allCameras);
        clusters.push({
          id: `cluster-${node.bounds.minLat}-${node.bounds.minLng}-${node.depth}`,
          latitude: centerLat,
          longitude: centerLng,
          cameras: allCameras,
          count: allCameras.length,
        });
      }
    } else {
      node.children?.forEach(traverse);
    }
  }

  traverse(tree);
  return clusters;
}

function collectCameras(node: QuadTreeNode): CameraData[] {
  if (node.children === null) return node.cameras;
  return node.children.flatMap(collectCameras);
}

function meanLongitude(cameras: CameraData[]): number {
  if (cameras.length === 0) return 0;

  let sumSin = 0;
  let sumCos = 0;

  cameras.forEach((camera) => {
    const radians = (camera.longitude * Math.PI) / 180;
    sumSin += Math.sin(radians);
    sumCos += Math.cos(radians);
  });

  const avg = Math.atan2(sumSin / cameras.length, sumCos / cameras.length);
  return (avg * 180) / Math.PI;
}

export function buildGridClusters(
  cameras: CameraData[],
  cellSizeDegrees: number
): CameraCluster[] {
  if (!Number.isFinite(cellSizeDegrees) || cellSizeDegrees <= 0) {
    return cameras.map((camera, index) => ({
      id: camera.id ?? `camera-${index}`,
      latitude: camera.latitude,
      longitude: camera.longitude,
      cameras: [camera],
      count: 1,
    }));
  }

  const bins = new Map<string, { cameras: CameraData[]; sumLat: number }>();

  for (const camera of cameras) {
    const latIndex = Math.floor((camera.latitude + 90) / cellSizeDegrees);
    const lngIndex = Math.floor((camera.longitude + 180) / cellSizeDegrees);
    const key = `${latIndex}:${lngIndex}`;
    const entry = bins.get(key);

    if (entry) {
      entry.cameras.push(camera);
      entry.sumLat += camera.latitude;
    } else {
      bins.set(key, { cameras: [camera], sumLat: camera.latitude });
    }
  }

  const clusters: CameraCluster[] = [];
  let index = 0;
  for (const entry of bins.values()) {
    if (entry.cameras.length === 1) {
      const camera = entry.cameras[0];
      clusters.push({
        id: camera.id ?? `camera-${index++}`,
        latitude: camera.latitude,
        longitude: camera.longitude,
        cameras: [camera],
        count: 1,
      });
    } else {
      clusters.push({
        id: `cluster-${index++}`,
        latitude: entry.sumLat / entry.cameras.length,
        longitude: meanLongitude(entry.cameras),
        cameras: entry.cameras,
        count: entry.cameras.length,
      });
    }
  }

  return clusters;
}

export function clusterCamerasToMax(
  cameras: CameraData[],
  options: {
    maxClusters: number;
    bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
    zoom?: number;
  }
): CameraCluster[] {
  const { maxClusters, bounds, zoom } = options;

  if (cameras.length <= maxClusters) {
    return cameras.map((camera, index) => ({
      id: camera.id ?? `camera-${index}`,
      latitude: camera.latitude,
      longitude: camera.longitude,
      cameras: [camera],
      count: 1,
    }));
  }

  const derivedBounds = bounds ?? cameras.reduce(
    (acc, camera) => ({
      minLat: Math.min(acc.minLat, camera.latitude),
      maxLat: Math.max(acc.maxLat, camera.latitude),
      minLng: Math.min(acc.minLng, camera.longitude),
      maxLng: Math.max(acc.maxLng, camera.longitude),
    }),
    { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 }
  );

  const latRange = Math.max(0.0001, derivedBounds.maxLat - derivedBounds.minLat);
  const lngRange = Math.max(0.0001, derivedBounds.maxLng - derivedBounds.minLng);
  const zoomFactor = Math.max(0.5, zoom ?? 1);

  let cellSize = Math.max(
    0.05,
    Math.sqrt((latRange * lngRange) / maxClusters) / zoomFactor
  );

  let clusters = buildGridClusters(cameras, cellSize);
  let iterations = 0;
  while (clusters.length > maxClusters && iterations < 8) {
    cellSize *= 1.4;
    clusters = buildGridClusters(cameras, cellSize);
    iterations += 1;
  }

  return clusters;
}

export function getVisibleClusters(
  clusters: CameraCluster[],
  viewBounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): CameraCluster[] {
  return clusters.filter(
    (c) =>
      c.latitude >= viewBounds.minLat &&
      c.latitude <= viewBounds.maxLat &&
      c.longitude >= viewBounds.minLng &&
      c.longitude <= viewBounds.maxLng
  );
}
