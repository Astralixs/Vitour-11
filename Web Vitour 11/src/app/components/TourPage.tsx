import { Link, useSearchParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    pannellum: any;
  }
}

const API_URL = import.meta.env.VITE_API_URL;

export default function TourPage() {
  const panoramaRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const locationId = searchParams.get('location_id') || '1';

  useEffect(() => {
    const loadingTimeout = setTimeout(() => setIsLoading(false), 8000);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/pannellum.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = '/pannellum.js';
    script.async = true;

    script.onload = async () => {
      try {
        const res = await fetch(`${API_URL}/api/locations/${locationId}/tour`);
        const tourConfig = await res.json();

        console.log('API_URL:', API_URL);
        console.log('Tour config:', JSON.stringify(tourConfig, null, 2));

        if (!tourConfig.scenes || Object.keys(tourConfig.scenes).length === 0) {
          setError('No panoramas found for this location.');
          setIsLoading(false);
          clearTimeout(loadingTimeout);
          return;
        }

        Object.entries(tourConfig.scenes).forEach(([sceneId, scene]: any) => {
          console.log(`Scene "${sceneId}" panorama URL:`, scene.panorama);
        });

        if (panoramaRef.current && window.pannellum) {
          viewerRef.current = window.pannellum.viewer(panoramaRef.current, {
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

          clearTimeout(loadingTimeout);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load tour config:', err);
        setError('Failed to load tour data. Make sure backend is running.');
        clearTimeout(loadingTimeout);
        setIsLoading(false);
      }
    };

    script.onerror = () => {
      setError('Failed to load Pannellum library.');
      clearTimeout(loadingTimeout);
      setIsLoading(false);
    };

    document.body.appendChild(script);

    return () => {
      clearTimeout(loadingTimeout);
      if (viewerRef.current) viewerRef.current.destroy();
      if (script.parentNode) document.body.removeChild(script);
      if (link.parentNode) document.head.removeChild(link);
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
        {isLoading && (
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