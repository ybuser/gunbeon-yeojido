export type Point = { getLat: () => number; getLng: () => number };
export type KMap = {
  setBounds: (bounds: unknown) => void;
  relayout: () => void;
  getCenter: () => Point;
  setCenter: (point: Point) => void;
};
export type KakaoAPI = {
  load: (callback: () => void) => void;
  Map: new (element: HTMLElement, options: unknown) => KMap;
  LatLng: new (lat: number, lon: number) => Point;
  LatLngBounds: new () => { extend: (point: unknown) => void };
  Marker: new (options: unknown) => {
    setMap: (map: KMap | null) => void;
    setPosition: (point: Point) => void;
  };
  event: {
    addListener: (
      target: unknown,
      event: string,
      handler: (event: { latLng: Point }) => void,
    ) => void;
    removeListener: (
      target: unknown,
      event: string,
      handler: (event: { latLng: Point }) => void,
    ) => void;
  };
  CustomOverlay: new (options: unknown) => {
    setMap: (map: KMap | null) => void;
  };
};
declare global {
  interface Window {
    kakao?: { maps: KakaoAPI };
  }
}

// One SDK request per document, including concurrent map and location pickers.
// A rejected load is kept until reload: rendering another component is not a retry.
let loading: Promise<KakaoAPI> | undefined;
export function loadKakaoMaps(key: string): Promise<KakaoAPI> {
  if (!key) return Promise.reject(new Error('KAKAO_KEY_MISSING'));
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    let settled = false;
    let tag = document.getElementById('kakao-sdk') as HTMLScriptElement | null;
    const finish = (error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      tag?.removeEventListener('load', ready);
      tag?.removeEventListener('error', failed);
      if (error || !window.kakao?.maps)
        reject(new Error(error || 'KAKAO_UNAVAILABLE'));
      else resolve(window.kakao.maps);
    };
    const failed = () => finish('KAKAO_LOAD_FAILED');
    const ready = () => {
      try {
        if (!window.kakao?.maps) return finish('KAKAO_UNAVAILABLE');
        window.kakao.maps.load(() => finish());
      } catch {
        finish('KAKAO_LOAD_FAILED');
      }
    };
    const timeout = setTimeout(() => finish('KAKAO_LOAD_TIMEOUT'), 10000);
    if (window.kakao?.maps) return ready();
    if (!tag) {
      tag = document.createElement('script');
      tag.id = 'kakao-sdk';
      tag.src =
        'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=' +
        encodeURIComponent(key);
      tag.addEventListener('load', ready, { once: true });
      tag.addEventListener('error', failed, { once: true });
      document.head.appendChild(tag);
    } else {
      tag.addEventListener('load', ready, { once: true });
      tag.addEventListener('error', failed, { once: true });
    }
  });
  return loading;
}
