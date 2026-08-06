import { Link, useParams } from 'react-router';
import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, MapPin, Users } from 'lucide-react';
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

interface RoomImage {
  id: number;
  image_url: string;
  position: number;
}

export default function DetailRoom() {
  const { id } = useParams();
  const [room, setRoom] = useState<Room | null>(null);
  const [images, setImages] = useState<string[]>([]); // cover photo + gallery, combined
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Room ID tidak ditemukan di URL.');
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      setActiveIndex(0);

      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', id)
        .single();

      if (roomError || !roomData) {
        setError(roomError?.message ?? 'Data untuk ruangan ini tidak tersedia.');
        setLoading(false);
        return;
      }

      setRoom(roomData as Room);

      const { data: galleryData } = await supabase
        .from('room_images')
        .select('id, image_url, position')
        .eq('room_id', id)
        .order('position', { ascending: true });

      const gallery = ((galleryData || []) as RoomImage[]).map(g => g.image_url);
      // Cover photo always comes first, then any additional gallery photos.
      const combined = [roomData.image_url, ...gallery].filter(Boolean);
      setImages(combined);

      setLoading(false);
    };

    load();
  }, [id]);

  const goPrev = () => setActiveIndex(i => (i - 1 + images.length) % images.length);
  const goNext = () => setActiveIndex(i => (i + 1) % images.length);

  // Auto-advance the carousel every 4s. Restarting the timer whenever activeIndex
  // changes (whether from autoplay or a manual click) means each slide always
  // gets a full 4s of view time, and manual navigation never fights the timer.
  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex(i => (i + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [images.length, activeIndex]);

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

  const hasMultipleImages = images.length > 1;

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
          {/* Photo / Carousel */}
          <div>
            <div className="relative rounded-xl overflow-hidden shadow-lg border border-[#c2c6d5] aspect-video bg-[#f0f3ff]">
              <div
                className="flex h-full transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${activeIndex * 100}%)` }}
              >
                {images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={room.name}
                    className="w-full h-full object-cover flex-shrink-0"
                  />
                ))}
              </div>

              {hasMultipleImages && (
                <>
                  <button
                    onClick={goPrev}
                    aria-label="Foto sebelumnya"
                    className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={goNext}
                    aria-label="Foto berikutnya"
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>

                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveIndex(i)}
                        aria-label={`Foto ${i + 1}`}
                        className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-colors ${
                          i === activeIndex ? 'bg-white' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {hasMultipleImages && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    className={`shrink-0 w-16 h-12 md:w-20 md:h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === activeIndex ? 'border-[#0667d3]' : 'border-transparent'
                    }`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
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