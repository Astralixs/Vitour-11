import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, MapPin } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Adjust this import if you already have a shared Supabase client
// exported elsewhere in your project (e.g. './lib/supabase').
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Pin {
  id: number;
  label: string;
  map_x: number;
  map_y: number;
  room_id: number | null;
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

    // No linked room yet, or the room has no photo — treat as "not available".
    if (!pin.room_id || !room || !room.image_url) {
      setWarning(`Detail untuk "${pin.label}" belum tersedia.`);
      window.clearTimeout((window as any).__roomWarnTimeout);
      (window as any).__roomWarnTimeout = window.setTimeout(() => setWarning(null), 3000);
      return;
    }

    navigate(`/Details/${pin.room_id}`);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 mb-6 text-sm md:text-base text-[#0667d3] hover:text-[#004fa7] transition-colors"
        >
          <ArrowLeft size={16} />
          Kembali ke Beranda
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold text-[#004fa7] mb-2">
          Denah Ruangan
        </h1>
        <p className="text-[#424753] text-sm md:text-base mb-6">
          Tap pada titik di denah untuk melihat detail ruangan.
        </p>

        {loading ? (
          <div className="py-24 text-center text-[#424753] text-sm md:text-base">
            Memuat denah...
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden border border-[#c2c6d5] shadow-lg bg-[#f0f3ff]">
            <img
              src="/Denah.jpeg"
              alt="Denah SMK Negeri 11 Bandung"
              className="w-full h-auto block select-none"
              draggable={false}
            />

            {pins.map(pin => {
              const room = pin.room_id ? rooms[pin.room_id] : null;
              const available = !!(pin.room_id && room && room.image_url);

              return (
                <button
                  key={pin.id}
                  onClick={() => handlePinClick(pin)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group"
                  style={{ left: `${pin.map_x}%`, top: `${pin.map_y}%` }}
                  aria-label={pin.label}
                >
                  <span
                    className={`flex items-center justify-center w-3.5 h-3.5 sm:w-6 sm:h-6 md:w-9 md:h-9 rounded-full text-white shadow-md ring-2 ring-white transition-transform group-hover:scale-110 opacity-50 hover:opacity-100 ${
                      available ? 'bg-[#0667d3]' : 'bg-[#9aa3b5]'
                    }`}
                  >
                    <MapPin size={12} className="w-2 h-2 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 opacity-70 group-hover:opacity-100 group-active:opacity-100 transition-opacity" />
                  </span>
                  <span className="absolute left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap text-[10px] md:text-xs bg-black/75 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {pin.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!loading && pins.length === 0 && (
          <p className="text-center text-sm text-[#424753] mt-6">
            Belum ada area yang ditandai di denah.
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