'use client';
import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
const images = new Map<string, Promise<string>>();
let retainedBytes = 0;
function loadImage(src: string) {
  let cached = images.get(src);
  if (cached) return cached;
  cached = fetch(src, {
    credentials: 'omit',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
    .then(async (r) => {
      if (!r.ok) throw new Error('IMAGE_UNAVAILABLE');
      const blob = await r.blob();
      if (
        !blob.type.startsWith('image/') ||
        retainedBytes + blob.size > 48 * 1024 * 1024
      )
        return src;
      retainedBytes += blob.size;
      return URL.createObjectURL(blob);
    })
    .catch(() => src);
  images.set(src, cached);
  return cached;
}
export default function MemoryImage({
  src,
  alt = '',
  loading,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const node = useRef<HTMLImageElement>(null),
    [url, setUrl] = useState<string>();
  useEffect(() => {
    let active = true;
    setUrl(undefined);
    if (typeof src !== 'string' || !src) return;
    const start = () =>
      void loadImage(src).then((value) => {
        if (active) setUrl(value);
      });
    let observer: IntersectionObserver | undefined;
    if (loading === 'lazy' && node.current) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer?.disconnect();
            start();
          }
        },
        { rootMargin: '250px' },
      );
      observer.observe(node.current);
    } else start();
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [src, loading]);
  return (
    <img
      {...props}
      alt={alt}
      ref={node}
      src={url}
      loading={loading}
      data-original-src={src}
    />
  );
}
