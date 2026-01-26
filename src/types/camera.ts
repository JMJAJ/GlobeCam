// Camera data types for the global surveillance platform

export interface CameraData {
  id?: string;
  latitude: number;
  longitude: number;
  continent: string;
  country: string;
  city: string;
  region: string;
  manufacturer: string;
  image_url: string;
  page_url: string;
}

export interface CameraCluster {
  id: string;
  latitude: number;
  longitude: number;
  cameras: CameraData[];
  count: number;
}

export interface GeoFeature {
  type: string;
  geometry: any;
  properties: any;
}

export interface ViewState {
  rotation: [number, number];
  scale: number;
  progress: number;
}
