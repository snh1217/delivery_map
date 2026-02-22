type NaverLatLng = {
  lat: () => number;
  lng: () => number;
};

type NaverMapPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type NaverMapInstance = {
  fitBounds: (bounds: NaverLatLngBounds, padding?: NaverMapPadding) => void;
};

type NaverOverlay = {
  setMap: (map: NaverMapInstance | null) => void;
};

type NaverMarkerInstance = NaverOverlay;

type NaverLatLngBounds = {
  extend: (latLng: NaverLatLng) => void;
};

type NaverMapsApi = {
  Map: new (
    element: HTMLElement,
    options: {
      center: NaverLatLng;
      zoom: number;
    },
  ) => NaverMapInstance;
  LatLng: new (lat: number, lng: number) => NaverLatLng;
  LatLngBounds: new () => NaverLatLngBounds;
  Marker: new (options: {
    position: NaverLatLng;
    map: NaverMapInstance;
    title?: string;
  }) => NaverMarkerInstance;
  Polygon: new (options: {
    map: NaverMapInstance;
    paths: NaverLatLng[];
    fillColor: string;
    fillOpacity: number;
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
  }) => NaverOverlay;
  InfoWindow: new (options: {
    content: string;
    borderWidth?: number;
    backgroundColor?: string;
    disableAnchor?: boolean;
  }) => NaverOverlay & {
    open: (map: NaverMapInstance, marker?: NaverMarkerInstance) => void;
  };
};

declare global {
  interface Window {
    naver?: {
      maps: NaverMapsApi;
    };
  }
}

export {};
