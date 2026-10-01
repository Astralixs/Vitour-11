import { Link, useSearchParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    pannellum: any;
  }
}

const API_URL = import.meta.env.VITE_API_URL;

// ── Load Pannellum (CSS + JS) only once for the whole session ──
let pannellumPromise: Promise<void> | null = null;

function loadPannellum(): Promise<void> {
  if (window.pannellum) return Promise.resolve();
  if (pannellumPromise) return pannellumPromise;

  pannellumPromise = new Promise<void>((resolve, reject) => {
    if (!document.querySelector('link[data-pannellum]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/pannellum.css';
      link.setAttribute('data-pannellum', 'true');
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = '/pannellum.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      pannellumPromise = null; // allow retry
      reject(new Error('Failed to load Pannellum library.'));
    };
    document.body.appendChild(script);
  });

  return pannellumPromise;
}

// ── Start downloading an image into the browser cache ──
// crossOrigin must match what Pannellum uses, otherwise the cached copy may not be reused.
const preloaded = new Set<string>();
function preloadImage(url?: string) {
  if (!url || preloaded.has(url)) return;
  preloaded.add(url);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.src = url;
}

// Preload the panoramas that the given scene links to via hotspots.
function preloadNeighbors(scenes: Record<string, any>, sceneId: string) {
  const hotSpots = scenes[sceneId]?.hotSpots || [];
  hotSpots.forEach((hs: any) => {
    if (hs.type === 'scene' && hs.sceneId && scenes[hs.sceneId]) {
      preloadImage(scenes[hs.sceneId].panorama);
    }
  });
}

export default function TourPage() {
  const panoramaRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const locationId = searchParams.get('location_id') || '1';

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    const fail = (msg: string) => {
      if (cancelled) return;
      setError(msg);
      setIsLoading(false);
    };

    // 1) Fetch the tour config, and as soon as it arrives, start downloading the
    //    first panorama (while Pannellum itself may still be loading).
    const configPromise = fetch(`${API_URL}/api/locations/${locationId}/tour`, {
      signal: controller.signal,
    })
      .then(res => {
        if (!res.ok) throw new Error(`Tour request failed (${res.status})`);
        return res.json();
      })
      .then(tourConfig => {
        const firstId = tourConfig?.default?.firstScene;
        preloadImage(tourConfig?.scenes?.[firstId]?.panorama);
        return tourConfig;
      });

    // 2) Load the Pannellum library at the same time (not one after the other).
    Promise.all([configPromise, loadPannellum()])
      .then(([tourConfig]) => {
        if (cancelled) return;

        if (!tourConfig.scenes || Object.keys(tourConfig.scenes).length === 0) {
          fail('No panoramas found for this location.');
          return;
        }
        if (!panoramaRef.current || !window.pannellum) return;

        const viewer = window.pannellum.viewer(panoramaRef.current, {
          default: {
            firstScene: tourConfig.default.firstScene,
            autoLoad: true,
            showControls: true,
            showFullscreenCtrl: true,
            showZoomCtrl: true,
            mouseZoom: true,
            compass: false,
            hotSpotDebug: false,
          },
          scenes: tourConfig.scenes,
        });
        viewerRef.current = viewer;

        // Hide the overlay only when the panorama is actually ready.
        viewer.on('load', () => {
          if (cancelled) return;
          setIsLoading(false);
          // Warm the cache for scenes the visitor is likely to open next.
          preloadNeighbors(tourConfig.scenes, viewer.getScene());
        });

        viewer.on('error', (msg: string) => {
          console.error('Pannellum error:', msg);
          fail('Failed to load the panorama image.');
        });
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError') return;
        console.error('Failed to load tour:', err);
        fail(
          err?.message === 'Failed to load Pannellum library.'
            ? err.message
            : 'Failed to load tour data. Make sure backend is running.'
        );
      });

    return () => {
      cancelled = true;
      controller.abort();
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); } catch { /* already destroyed */ }
        viewerRef.current = null;
      }
    };
  }, [locationId]);

  return (
    <div className="flex flex-col bg-white" style={{ height: '100dvh' }}>
      {/* Navbar */}
      <nav className="bg-[#3f51b5] text-white px-4 md:px-8 py-3 md:py-4 z-50 shadow-md flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-lg md:text-2xl font-bold">Virtual Tour 11</h1>
          <Link to="/">
            <Button
              variant="ghost"
              className="text-white hover:text-blue-200 hover:bg-white/10 text-sm md:text-base px-2 md:px-4"
            >
              <ArrowLeft className="mr-1 md:mr-2" size={18} />
              <span className="hidden sm:inline">Kembali ke Beranda</span>
              <span className="sm:hidden">Kembali</span>
            </Button>
          </Link>
        </div>
      </nav>

      {/* Panorama */}
      <section className="flex-1 bg-gray-900 relative min-h-0">
        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white bg-gray-900 z-10">
            <div className="text-center px-4">
              <p className="text-lg md:text-xl mb-2">Memuat panorama...</p>
              <p className="text-xs md:text-sm opacity-75">Mohon tunggu sebentar</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-white bg-red-900 z-10">
            <div className="text-center px-4">
              <p className="text-lg md:text-xl mb-2">{error}</p>
              <p className="text-xs md:text-sm opacity-75">Silakan refresh halaman</p>
            </div>
          </div>
        )}
        <div ref={panoramaRef} className="w-full h-full" />
      </section>

      {/* Footer */}
      <footer className="bg-[#2c3e8f] text-white py-3 md:py-4 px-4 md:px-8 flex-shrink-0">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs md:text-sm">
            Virtual Tour 11 | © 2025 SMK Negeri 11 Bandung. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}