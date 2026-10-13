import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Lock } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import DenahCanvas, { FLOORS, type Floor } from '../Admin/DenahCanvas';

// Adjust this import if you already have a shared Supabase client
// exported elsewhere in your project (e.g. './lib/supabase').
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// A clickable area on the map. x/y = top-left corner, w/h = size,
// all in % of the shared canvas (see DenahCanvas.tsx).
interface Pin {
  id: number;
  label: string;
  map_x: number;
  map_y: number;
  map_w: number | null;
  map_h: number | null;
  room_id: number | null;
  floor: Floor | null;
}

interface RoomLite {
  id: number;
  image_url: string | null;
  description: string | null;
}

export default function RoomMap() {
  const navigate = useNavigate();
  const [pins, setPins] = useState<Pin[]>([]);
  const [rooms, setRooms] = useState<Record<number, RoomLite>>({});
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [floor, setFloor] = useState<Floor>('bawah');

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: pinData, error: pinError } = await supabase
        .from('room_pins')
        .select('*');

      if (pinError) {
        console.error('[RoomMap] failed to fetch pins:', pinError);
        setLoading(false);
        return;
      }

      setPins(pinData || []);

      const roomIds = (pinData || [])
        .map((p: any) => p.room_id)
        .filter((id: any) => id !== null);

      if (roomIds.length > 0) {
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('id, image_url, description')
          .in('id', roomIds);

        if (!roomError) {
          const map: Record<number, RoomLite> = {};
          (roomData || []).forEach((r: any) => { map[r.id] = r; });
          setRooms(map);
        }
      }

      setLoading(false);
    };

    load();
  }, []);

  const handlePinClick = (pin: Pin) => {
    const room = pin.room_id ? rooms[pin.room_id] : null;

    if (!pin.room_id || !room || !room.image_url) {
      setWarning(`Detail untuk "${pin.label}" belum tersedia.`);
      window.clearTimeout((window as any).__roomWarnTimeout);
      (window as any).__roomWarnTimeout = window.setTimeout(() => setWarning(null), 3000);
      return;
    }

    navigate(`/Details/${pin.room_id}`);
  };

  const currentFloor = FLOORS.find(f => f.key === floor)!;
  // Only areas on this floor that have a drawn hitbox (old point-pins have no size yet)
  const visiblePins = pins.filter(
    p => (p.floor ?? 'bawah') === floor && (p.map_w ?? 0) > 0 && (p.map_h ?? 0) > 0
  );

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in-text {
          opacity: 0;
          animation: fadeInUp 0.6s ease-out forwards;
        }
      `}</style>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 md:py-5">
        <Link
          to="/"
          className="inline-flex items-center gap-2 mb-2 md:mb-3 text-sm text-[#0667d3] hover:text-[#004fa7] transition-colors"
        >
          <ArrowLeft size={16} />
          Kembali ke Beranda
        </Link>

        {/* Title + floor switcher share one row on desktop to save vertical space */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3 md:mb-4">
          <div>
            <h1
              className="fade-in-text text-xl md:text-2xl font-bold text-[#004fa7] mb-1"
              style={{ animationDelay: '0.05s' }}
            >
              Denah Ruangan
            </h1>
            <p
              className="fade-in-text text-[#424753] text-xs md:text-sm"
              style={{ animationDelay: '0.15s' }}
            >
              Pilih lantai, lalu tap pada ruangan di denah untuk melihat detailnya.
            </p>
          </div>

          {/* Floor switcher */}
          <div
            className="fade-in-text inline-flex self-start md:self-auto p-1 rounded-full bg-[#f0f3ff] border border-[#c2c6d5]"
            style={{ animationDelay: '0.25s' }}
          >
            {FLOORS.map(f => (
              <button
                key={f.key}
                onClick={() => setFloor(f.key)}
                className={`px-4 md:px-5 py-1.5 text-sm rounded-full transition-colors ${
                  floor === f.key
                    ? 'bg-[#0667d3] text-white shadow'
                    : 'text-[#424753] hover:text-[#004fa7]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center text-[#424753] text-sm md:text-base">
            Memuat denah...
          </div>
        ) : (
          // Phones: full width. Laptops/PCs: sized by height so the whole map fits on screen.
          <DenahCanvas
            floor={floor}
            className="w-full md:w-auto md:h-[calc(100dvh-10.5rem)] md:mx-auto rounded-xl border border-[#c2c6d5] shadow-lg"
          >
            {visiblePins.map(pin => {
              const room = pin.room_id ? rooms[pin.room_id] : null;
              const available = !!(pin.room_id && room && room.image_url);
              const labelBelow = pin.map_y < 6; // keep the tooltip inside the map for top-row rooms

              return (
                <button
                  key={pin.id}
                  onClick={() => handlePinClick(pin)}
                  aria-label={pin.label}
                  className={`group absolute z-10 hover:z-20 focus-visible:z-20 rounded-[3px] border border-transparent cursor-pointer outline-none transition-all duration-200 ${
                    available
                      ? 'bg-[#0667d3]/0 hover:bg-[#0667d3]/20 focus-visible:bg-[#0667d3]/20 active:bg-[#0667d3]/20 hover:border-[#0667d3] focus-visible:border-[#0667d3] hover:shadow-[0_0_14px_3px_rgba(6,103,211,0.55)] focus-visible:shadow-[0_0_14px_3px_rgba(6,103,211,0.55)]'
                      : 'bg-[#9aa3b5]/0 hover:bg-[#9aa3b5]/20 focus-visible:bg-[#9aa3b5]/20 active:bg-[#9aa3b5]/20 hover:border-[#9aa3b5] focus-visible:border-[#9aa3b5] hover:shadow-[0_0_14px_3px_rgba(154,163,181,0.6)] focus-visible:shadow-[0_0_14px_3px_rgba(154,163,181,0.6)]'
                  }`}
                  style={{
                    left: `${pin.map_x}%`,
                    top: `${pin.map_y}%`,
                    width: `${pin.map_w}%`,
                    height: `${pin.map_h}%`,
                  }}
                >
                  {/* Lock in the center for areas that have no detail page yet */}
                  {!available && (
                    <span
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[#ff0000] opacity-70 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none drop-shadow-[0_0_2px_rgba(255,255,255,0.9)]"
                      style={{ width: 'min(60%, 22px)', aspectRatio: '1 / 1' }}
                      aria-hidden="true"
                    >
                      <Lock className="w-full h-full" strokeWidth={2.4} />
                    </span>
                  )}
                  <span
                    className={`absolute left-1/2 -translate-x-1/2 ${
                      labelBelow ? 'top-full mt-1' : 'bottom-full mb-1'
                    } whitespace-nowrap text-[10px] md:text-xs bg-black/75 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none`}
                  >
                    {pin.label}
                  </span>
                </button>
              );
            })}
          </DenahCanvas>
        )}

        {!loading && visiblePins.length === 0 && (
          <p className="text-center text-sm text-[#424753] mt-6 fade-in-text">
            Belum ada area yang ditandai di {currentFloor.label.toLowerCase()}.
          </p>
        )}
      </div>

      {warning && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#8b4444] text-white text-sm px-4 py-2.5 rounded-full shadow-lg z-50 text-center max-w-[90vw]">
          {warning}
        </div>
      )}
    </div>
  );
}