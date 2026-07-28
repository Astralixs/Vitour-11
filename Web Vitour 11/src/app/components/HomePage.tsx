import { Link } from 'react-router';
import { MapPin, Phone, Mail, GraduationCap, Users, Award } from 'lucide-react';
import { Button } from './ui/button';
import { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

export default function HomePage() {
  const [locationId, setLocationId] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState('home');

  const aboutReveal = useReveal();
  const card1 = useReveal();
  const card2 = useReveal();
  const card3 = useReveal();
  const historyReveal = useReveal();
  const facilitiesReveal = useReveal();
  const facility1 = useReveal();
  const facility2 = useReveal();
  const facility3 = useReveal();
  const facility4 = useReveal();
  const locationReveal = useReveal();
  const locationInfo = useReveal();
  const locationMap = useReveal();
  const [showDenah, setShowDenah] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/locations`)
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) setLocationId(data[0].id);
      });
  }, []);

  useEffect(() => {
    const sections = ['home', 'about', 'location'];
    const observers: IntersectionObserver[] = [];

    sections.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id);
        },
        { threshold: 0.4 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(obs => obs.disconnect());
  }, []);

  const fadeUp = (visible: boolean, delay = 0) =>
    `transition-all duration-700 ease-out ${delay ? `delay-[${delay}ms]` : ''} ${
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
    }`;

  const fadeIn = (visible: boolean, delay = 0) =>
    `transition-all duration-700 ease-out ${delay ? `delay-[${delay}ms]` : ''} ${
      visible ? 'opacity-100' : 'opacity-0'
    }`;

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        .hero-title  { animation: fadeSlideUp 0.9s ease-out 0.2s both; }
        .hero-sub    { animation: fadeSlideUp 0.9s ease-out 0.45s both; }
        .hero-btn    { animation: fadeSlideUp 0.9s ease-out 0.7s both; }
        .hero-overlay { animation: fadeIn 1.2s ease-out 0s both; }
        .nav-anim    { animation: fadeSlideDown 0.6s ease-out 0s both; }
        .card-hover  {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .card-hover:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px rgba(63,81,181,0.15);
        }
        .img-zoom img {
          transition: transform 0.5s ease;
        }
        .img-zoom:hover img {
          transform: scale(1.05);
        }
      `}</style>

      {/* Navigation Header */}
      <nav className="nav-anim bg-[#3f51b5] text-white px-4 md:px-8 py-3 md:py-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-lg md:text-2xl font-bold">Virtual Tour 11</h1>
          <div className="flex gap-3 md:gap-6 text-sm md:text-base">
            <a href="#home" className={`hover:text-blue-200 transition-colors ${activeSection === 'home' ? 'font-bold underline' : ''}`}>Home</a>
            <a href="#about" className={`hover:text-blue-200 transition-colors ${activeSection === 'about' ? 'font-bold underline' : ''}`}>About</a>
            <a href="#location" className={`hover:text-blue-200 transition-colors ${activeSection === 'location' ? 'font-bold underline' : ''}`}>Location</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 hero-overlay">
          <img
            src='/slide_2a.jpeg'
            alt="SMKN 11 Bandung"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-[#3f51b5]/40"></div>
        </div>
        <div className="relative z-10 text-center text-white px-4 w-full max-w-4xl mx-auto">
          <h2 className="hero-title text-4xl sm:text-5xl md:text-7xl font-bold mb-3 md:mb-4"><u>Welcome</u></h2>
          <h3 className="hero-sub text-xl sm:text-3xl md:text-6xl font-bold mb-6 md:mb-8 leading-snug">Explore through the glass of virtual</h3>
          <div className="hero-btn">
            <Link to={locationId ? `/tour?location_id=${locationId}` : '/tour'}>
              <Button
                size="lg"
                className="bg-[#3f51b5] text-white hover:bg-[#3949a3] text-base md:text-xl px-8 md:px-12 py-4 md:py-6 h-auto transition-transform duration-200 hover:scale-105 active:scale-95 w-full sm:w-auto"
              >
                Mulai Tour Virtual
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-12 md:py-20 px-4 md:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div ref={aboutReveal.ref} className={fadeUp(aboutReveal.visible)}>
            <h2 className="text-2xl md:text-4xl font-bold text-[#3f51b5] text-center mb-8 md:mb-12">Tentang SMKN 11 Bandung</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-10 md:mb-16">
            <div ref={card1.ref} className={`card-hover bg-white p-6 md:p-8 rounded-lg shadow-md text-center ${fadeUp(card1.visible, 0)}`}>
              <div className="bg-[#3f51b5] w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-transform duration-300 hover:rotate-12">
                <GraduationCap className="text-white" size={28} />
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-3 text-[#3f51b5]">Pendidikan Berkualitas</h3>
              <p className="text-gray-600 text-sm md:text-base">
                SMKN 11 Bandung berkomitmen memberikan pendidikan terbaik dengan kurikulum yang relevan dan modern.
              </p>
            </div>

            <div ref={card2.ref} className={`card-hover bg-white p-6 md:p-8 rounded-lg shadow-md text-center ${fadeUp(card2.visible, 150)}`}>
              <div className="bg-[#3f51b5] w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-transform duration-300 hover:rotate-12">
                <Users className="text-white" size={28} />
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-3 text-[#3f51b5]">Kesehatan Mental</h3>
              <p className="text-gray-600 text-sm md:text-base">
                Program BK di SMKN 11 Bandung fokus pada kesejahteraan mental siswa melalui konseling dan dukungan profesional.
              </p>
            </div>

            <div ref={card3.ref} className={`card-hover bg-white p-6 md:p-8 rounded-lg shadow-md text-center ${fadeUp(card3.visible, 300)}`}>
              <div className="bg-[#3f51b5] w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-transform duration-300 hover:rotate-12">
                <Award className="text-white" size={28} />
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-3 text-[#3f51b5]">Prestasi Gemilang</h3>
              <p className="text-gray-600 text-sm md:text-base">
                Siswa kami meraih berbagai prestasi di tingkat regional dan nasional dalam berbagai bidang.
              </p>
            </div>
          </div>

          <div ref={historyReveal.ref} className={`card-hover bg-white p-6 md:p-12 rounded-lg shadow-md ${fadeUp(historyReveal.visible)}`}>
            <h3 className="text-2xl md:text-3xl font-bold text-[#3f51b5] mb-4 md:mb-6">Sejarah Sekolah</h3>
            <p className="text-gray-700 leading-relaxed mb-4 text-sm md:text-base">
              SMKN 11 Bandung merupakan sekolah menengah kejuruan negeri di Kota Bandung yang berdiri pada tahun
              1968 sebagai SMEA Cimahi, filial dari SMEA Negeri 1 Bandung. Pada awalnya, kegiatan belajar mengajar
              dilakukan di beberapa lokasi berbeda sebelum akhirnya menempati gedung di Jalan Budi Cilember pada tahun 1970.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4 text-sm md:text-base">
              Pada tahun 1980, sekolah ini resmi berdiri sendiri dengan nama SMEA Negeri Cimahi. Kemudian
              pada tahun 1987, namanya berubah menjadi SMK Negeri 11 Bandung seiring perubahan sistem
              pendidikan kejuruan di Indonesia. Sekolah ini terus berkembang dengan membuka berbagai
              program keahlian, termasuk Rekayasa Perangkat Lunak (RPL).
            </p>
            <p className="text-gray-700 leading-relaxed text-sm md:text-base">
              SMKN 11 Bandung juga aktif meningkatkan mutu pendidikan. Sekolah ini pernah menjadi Rintisan
              Sekolah Bertaraf Internasional (RSBI) dan memperoleh sertifikat ISO 9001:2000 sebagai bentuk
              komitmen terhadap kualitas pendidikan. Hingga kini, SMKN 11 Bandung dikenal sebagai salah
              satu SMK unggulan di Kota Bandung.
            </p>
          </div>
        </div>
      </section>

            {/* Facilities Section */}
      <section className="py-12 md:py-20 px-4 md:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div ref={facilitiesReveal.ref} className={fadeUp(facilitiesReveal.visible)}>
            <h2 className="text-2xl md:text-4xl font-bold text-[#3f51b5] text-center mb-8 md:mb-12">Fasilitas Kami</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            
            {/* Card 1 - Gedung Modern */}
            <div ref={facility1.ref} className={`img-zoom overflow-hidden rounded-lg shadow-lg card-hover ${fadeUp(facility1.visible, 0)}`}>
              <img
                src="/IMG_0157.jpeg"
                alt="School Building"
                className="w-full h-48 md:h-64 object-cover"
              />
              <div className="p-4 md:p-6 bg-gray-50">
                <h3 className="text-lg md:text-xl font-bold text-[#3f51b5] mb-2">Gedung Modern</h3>
                <p className="text-gray-600 text-sm md:text-base">
                  Fasilitas belajar yang luar biasa dengan peralatan modern dan teknologi terkini.
                </p>
              </div>
            </div>

            {/* Card 2 - Ruang Kelas */}
            <div ref={facility2.ref} className={`img-zoom overflow-hidden rounded-lg shadow-lg card-hover ${fadeUp(facility2.visible, 150)}`}>
              <img
                src="/kelasking.jpeg"
                alt="Classroom"
                className="w-full h-48 md:h-64 object-cover"
              />
              <div className="p-4 md:p-6 bg-gray-50">
                <h3 className="text-lg md:text-xl font-bold text-[#3f51b5] mb-2">Ruang Kelas Nyaman</h3>
                <p className="text-gray-600 text-sm md:text-base">
                  Pembelajaran yang berada di kelas yang nyaman dan kondusif guna mendukung proses belajar.
                </p>
              </div>
            </div>

            {/* Card 3 - Video */}
            <div ref={facility3.ref} className={`img-zoom overflow-hidden rounded-lg shadow-lg card-hover ${fadeUp(facility3.visible, 300)}`}>
              <div className="w-full h-48 md:h-64">
                <iframe
                  src="https://www.youtube.com/embed/ONWUEFy4wjE"
                  title="Video Fasilitas"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="p-4 md:p-6 bg-gray-50">
                <h3 className="text-lg md:text-xl font-bold text-[#3f51b5] mb-2">Profil Sekolah</h3>
              </div>
            </div>

            {/* Card 4 - Denah */}
           {/* Modal Fullscreen */}
            {showDenah && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
                onClick={() => setShowDenah(false)}
              >
                <div
                  className="relative w-full max-w-5xl mx-4 my-4 flex flex-col"
                  style={{ height: '90vh' }}
                  onClick={e => e.stopPropagation()}
                >
                  <iframe
                    src="https://denah-sekolah.tiiny.site/"
                    title="Denah Sekolah Fullscreen"
                    className="w-full flex-1 rounded-t-lg border-0"
                  />
                  <div className="bg-white rounded-b-lg px-4 py-3 flex justify-center">
                    <button
                      onClick={() => setShowDenah(false)}
                      className="text-sm text-[#3f51b5] border border-[#3f51b5] px-6 py-2 rounded-full hover:bg-[#3f51b5] hover:text-white transition"
                    >
                      ✕ Tutup
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Card facility4 */}
            <div ref={facility4.ref} className={`img-zoom overflow-hidden rounded-lg shadow-lg card-hover ${fadeUp(facility4.visible, 450)}`}>
              <div
                className="w-full h-48 md:h-64 relative cursor-pointer group"
                onClick={() => setShowDenah(true)}
              >
                <iframe
                  src="https://denah-sekolah.tiiny.site/"
                  title="Denah Sekolah"
                  className="w-full h-full border-0 pointer-events-none"
                />
                {/* Overlay klik */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition text-white text-sm bg-black/50 px-4 py-2 rounded-full">
                    🔍 Perbesar
                  </span>
                </div>
              </div>
              <div className="p-4 md:p-6 bg-gray-50 flex items-center justify-between">
                <h3 className="text-lg md:text-xl font-bold text-[#3f51b5]">PDF Denah Sekolah</h3>
                <button
                  onClick={() => setShowDenah(true)}
                  className="text-sm text-[#3f51b5] border border-[#3f51b5] px-3 py-1 rounded-full hover:bg-[#3f51b5] hover:text-white transition"
                >
                  Lihat Penuh
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Location Section */}
      <section id="location" className="py-12 md:py-20 px-4 md:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div ref={locationReveal.ref} className={fadeUp(locationReveal.visible)}>
            <h2 className="text-2xl md:text-4xl font-bold text-[#3f51b5] text-center mb-8 md:mb-12">Lokasi Kami</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            <div ref={locationInfo.ref} className={fadeUp(locationInfo.visible, 0)}>
              <div className="card-hover bg-white p-6 md:p-8 rounded-lg shadow-md mb-6">
                <h3 className="text-xl md:text-2xl font-bold text-[#3f51b5] mb-4 md:mb-6">SMK Negeri 11 Bandung</h3>

                <div className="space-y-4">
                  <div className="flex items-start gap-3 md:gap-4">
                    <MapPin className="text-[#3f51b5] mt-1 flex-shrink-0" size={20} />
                    <div>
                      <p className="font-semibold text-gray-800 text-sm md:text-base">Alamat</p>
                      <p className="text-gray-600 text-sm md:text-base">
                        Jl. Budi Raya No. 11, Cijagra, Kec. Lengkong<br />
                        Kota Bandung, Jawa Barat 40265
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 md:gap-4">
                    <Phone className="text-[#3f51b5] mt-1 flex-shrink-0" size={20} />
                    <div>
                      <p className="font-semibold text-gray-800 text-sm md:text-base">Telepon</p>
                      <p className="text-gray-600 text-sm md:text-base">(022) 7315150</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 md:gap-4">
                    <Mail className="text-[#3f51b5] mt-1 flex-shrink-0" size={20} />
                    <div>
                      <p className="font-semibold text-gray-800 text-sm md:text-base">Email</p>
                      <p className="text-gray-600 text-sm md:text-base break-all">info@smkn11bandung.sch.id</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#3f51b5] text-white p-5 md:p-6 rounded-lg shadow-md">
                <h4 className="text-lg md:text-xl font-bold mb-3">Jam Operasional</h4>
                <p className="mb-2 text-sm md:text-base">Senin - Jumat: 07.00 - 16.00 WIB</p>
                <p className="text-sm md:text-base">Sabtu: 07.00 - 12.00 WIB</p>
              </div>
            </div>

            <div ref={locationMap.ref} className={`overflow-hidden rounded-lg shadow-lg h-[300px] md:h-[500px] ${fadeUp(locationMap.visible, 150)}`}>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3961.00062464909!2d107.55575517427145!3d-6.890527093108526!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68e6bd6aaaaaab%3A0xf843088e2b5bf838!2sSMK%20Negeri%2011%20Bandung!5e0!3m2!1sen!2sid!4v1775716742394!5m2!1sen!2sid"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#2c3e8f] text-white py-6 md:py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm md:text-lg">
            ViTour 11 | All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}