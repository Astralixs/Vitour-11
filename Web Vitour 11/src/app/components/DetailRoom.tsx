import { Link, useParams } from 'react-router';
import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, MapPin, Users } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Adjust this import if you already have a shared Supabase client
// exported elsewhere in your project (e.g. './lib/supabase').
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Adjust these fields to match your actual "rooms" table columns.
interface Room {
  id: number;
  name: string;
  description: string;
  image_url: string;
  location?: string;
  capacity?: number;
}

export default function DetailRoom() {
  const { id } = useParams();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Room ID tidak ditemukan di URL.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
        } else {
          setRoom(data as Room);
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#424753]">
          <Loader2 className="animate-spin text-[#0667d3]" size={32} />
          <p className="text-sm md:text-base">Memuat data ruangan...</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl md:text-3xl font-bold text-[#004fa7]">
            Ruangan Tidak Ditemukan
          </h1>
          <p className="text-[#424753] text-sm md:text-base">
            {error ?? 'Data untuk ruangan ini tidak tersedia.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 mt-2 text-sm md:text-base text-[#0667d3] hover:text-[#004fa7] transition-colors"
          >
            <ArrowLeft size={16} />
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 mb-6 md:mb-10 text-sm md:text-base text-[#0667d3] hover:text-[#004fa7] transition-colors"
        >
          <ArrowLeft size={16} />
          Kembali ke Beranda
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
          {/* Photo */}
          <div className="rounded-xl overflow-hidden shadow-lg border border-[#c2c6d5] aspect-video bg-[#f0f3ff]">
            <img
              src={room.image_url}
              alt={room.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Text */}
          <div className="space-y-5 md:space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#004fa7] mb-2">
                {room.name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm md:text-base text-[#424753]">
                {room.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={16} className="text-[#0667d3]" />
                    {room.location}
                  </span>
                )}
                {room.capacity && (
                  <span className="flex items-center gap-1.5">
                    <Users size={16} className="text-[#0667d3]" />
                    {room.capacity} orang
                  </span>
                )}
              </div>
            </div>

            <p className="text-[#424753] text-sm md:text-base leading-relaxed whitespace-pre-line">
              {room.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}