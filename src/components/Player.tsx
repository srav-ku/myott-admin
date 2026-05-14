'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

type Props = {
  src: string;
  poster?: string | null;
  autoplay?: boolean;
  onEnded?: () => void;
};

export function Player({ src, poster, autoplay = true, onEnded }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setLoading(true);
    setErr(null);

    let hls: { destroy(): void } | null = null;
    const isHls = /\.m3u8(\?|$)/i.test(src);
    const canNativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== '';

    if (isHls && !canNativeHls) {
      // dynamic import keeps hls.js out of the SSR bundle
      void import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          setErr('HLS not supported in this browser');
          setLoading(false);
          return;
        }
        const h = new Hls({ enableWorker: true, lowLatencyMode: false });
        h.loadSource(src);
        h.attachMedia(video);
        h.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          if (autoplay) video.play().catch(() => {});
        });
        h.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            setErr(`Playback failed: ${data.details || data.type}`);
            setLoading(false);
          }
        });
        hls = h;
      });
    } else {
      video.src = src;
      const handleReady = () => {
        setLoading(false);
        if (autoplay) video.play().catch(() => {});
      };
      const handleError = () => {
        setErr('Failed to load video');
        setLoading(false);
      };
      video.addEventListener('loadedmetadata', handleReady);
      video.addEventListener('error', handleError);
      return () => {
        video.removeEventListener('loadedmetadata', handleReady);
        video.removeEventListener('error', handleError);
        video.removeAttribute('src');
        video.load();
      };
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [src, autoplay]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        controls
        playsInline
        poster={poster ?? undefined}
        onEnded={onEnded}
        className="w-full h-full"
      />
      {loading && !err && (
        <div className="absolute inset-0 grid place-items-center bg-black/30 pointer-events-none">
          <Loader2 className="animate-spin text-white" size={36} />
        </div>
      )}
      {err && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center">
          <div>
            <AlertTriangle className="mx-auto text-[var(--color-brand)] mb-2" size={32} />
            <div className="text-sm text-white">{err}</div>
            <div className="text-xs text-[var(--color-text-dim)] mt-1">
              Try switching to a different quality.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
