import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Building2, Monitor, Users, X } from 'lucide-react';
import { supabase } from '../../../services/supabase';

interface Room {
  id: number;
  name: string;
  description: string | null;
  location: string | null; // e.g. "Gedung A"
  capacity: number | null;
  image_url: string | null; // cover photo from the room-images bucket
}

const SLIDE_MS = 8000;   // time each room stays on screen
const FADE_MS = 600;     // fade-out/in duration
const REFRESH_MS = 30000; // fallback refresh (realtime handles most updates)

export default function Signage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [clock, setClock] = useState(new Date());

  // Only rooms that actually have a photo are shown (1 cover image per room)
  const slides = useMemo(() => rooms.filter(r => !!r.image_url), [rooms]);

  const fetchRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, name, description, location, capacity, image_url')
      .order('name', { ascending: true });

    if (error) {
      console.error('[Signage] fetch error:', error);
      return;
    }
    setRooms((data as Room[]) || []);
    setLoaded(true);
  }, []);

  useEffect(() => { document.title = 'Signage - Denah Ruangan'; }, []);

  // Initial load + realtime updates + fallback polling
  useEffect(() => {
    fetchRooms();
    const channel = supabase
      .channel('signage-rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => fetchRooms())
      .subscribe();
    const interval = setInterval(fetchRooms, REFRESH_MS);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchRooms]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Keep the index valid if rooms are added/removed while the screen is running
  useEffect(() => {
    setCurrentIndex(i => (slides.length ? i % slides.length : 0));
  }, [slides.length]);

  // Auto-advance with a fade between rooms
  useEffect(() => {
    if (slides.length < 2) return;
    let swap: number | undefined;
    const interval = window.setInterval(() => {
      setFade(false);
      swap = window.setTimeout(() => {
        setCurrentIndex(i => (i + 1) % slides.length);
        setFade(true);
      }, FADE_MS);
    }, SLIDE_MS);
    return () => {
      window.clearInterval(interval);
      if (swap) window.clearTimeout(swap);
    };
  }, [slides.length]);

  // Preload the next photo so the transition never shows a blank frame
  useEffect(() => {
    if (slides.length < 2) return;
    const next = slides[(currentIndex + 1) % slides.length];
    if (next?.image_url) {
      const img = new Image();
      img.src = next.image_url;
    }
  }, [currentIndex, slides]);

  const room = slides[currentIndex];

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (d: Date) =>
    d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const infoItems = [
    room?.location && { icon: <Building2 size={18} />, label: 'Lokasi', value: room.location },
    room?.capacity && { icon: <Users size={18} />, label: 'Kapasitas', value: `${room.capacity} orang` },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[];

  return (
    <div className="relative flex h-screen w-screen select-none flex-col overflow-hidden bg-[#0c1b4d] text-white">
      {/* Decorative rings */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" aria-hidden="true">
        <div className="absolute -right-48 -top-64 h-[620px] w-[620px] rounded-full border border-white" />
        <div className="absolute -bottom-72 -left-48 h-[620px] w-[620px] rounded-full border border-white" />
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white" />
      </div>

      <button
        type="button"
        onClick={() => navigate('/')}
        title="Keluar dari mode signage"
        className="absolute right-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
      >
        <X size={17} />
      </button>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-8 py-5 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <Monitor size={21} />
          </div>
          <div>
            <p className="text-lg font-bold">ViTour</p>
            <p className="text-xs text-blue-300">SMKN 11 Bandung</p>
          </div>
        </div>
        <div className="mr-12 text-right">
          <p className="font-mono text-3xl font-bold tracking-wider">{formatTime(clock)}</p>
          <p className="text-xs capitalize text-blue-300">{formatDate(clock)}</p>
        </div>
      </header>

      {/* Main */}
      <main
        className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-8 py-6 text-center lg:px-12"
        style={{ opacity: fade ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}
      >
        {room ? (
          <div className="flex h-full w-full max-w-6xl flex-col items-center">
            {/* One photo per room: blurred copy fills the frame, sharp copy is shown uncropped */}
            <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl">
              <img
                src={room.image_url!}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
              />
              <img
                src={room.image_url!}
                alt={room.name}
                className="relative h-full w-full object-contain"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#071a3a]/60 via-transparent to-transparent" />
            </div>

            <h1 className="mx-auto mt-6 max-w-5xl text-4xl font-extrabold leading-tight tracking-tight lg:text-6xl">
              {room.name}
            </h1>

            {room.description && (
              <p className="mx-auto mt-3 line-clamp-2 max-w-3xl text-base leading-7 text-blue-200 lg:text-xl lg:leading-8">
                {room.description}
              </p>
            )}

            {infoItems.length > 0 && (
              <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-3">
                {infoItems.map(item => (
                  <Info key={item.label} {...item} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <Monitor size={44} className="mx-auto mb-5 text-blue-300" />
            <h1 className="text-3xl font-bold lg:text-4xl">
              {loaded ? 'Belum ada foto ruangan' : 'Memuat ruangan...'}
            </h1>
            {loaded && (
              <p className="mt-3 text-lg text-blue-300">
                Tambahkan Detail Ruangan beserta foto dari panel admin.
              </p>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-between border-t border-white/10 bg-white/5 px-8 py-3 text-xs text-blue-300 lg:px-12">
        <span>
          {slides.length > 0 ? `Ruangan ${currentIndex + 1} dari ${slides.length}` : 'Tidak ada ruangan'}
        </span>

        {slides.length > 1 && slides.length <= 24 && (
          <div className="flex items-center gap-1.5">
            {slides.map((s, idx) => (
              <span
                key={s.id}
                className={`h-2 rounded-full transition-all ${
                  idx === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/35'
                }`}
              />
            ))}
          </div>
        )}

        <span className="hidden sm:block">© {new Date().getFullYear()} ViTour · SMKN 11 Bandung</span>
      </footer>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/10 px-5 py-3 backdrop-blur">
      <div className="mb-1 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-300">
        {icon}
        {label}
      </div>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
