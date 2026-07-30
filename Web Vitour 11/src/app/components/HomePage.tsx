import { Link } from 'react-router';
import { MapPin, Phone, ShieldCheck, Compass, Clock } from 'lucide-react';
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
  const aboutImage = useReveal();
  const accreditationReveal = useReveal();
  const locationReveal = useReveal();
  const locationInfo = useReveal();
  const locationMap = useReveal();

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
          box-shadow: 0 20px 40px rgba(0,79,167,0.15);
        }
      `}</style>

      {/* Navigation Header (kept from original) */}
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
      <section id="home" className="relative w-full h-[80vh] min-h-[480px] md:min-h-[600px] flex items-center overflow-hidden">
        <div className="absolute inset-0 hero-overlay">
          <img
            src="/slide_2a.jpeg"
            alt="SMKN 11 Bandung"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/60"></div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-16 text-white w-full">
          <div className="max-w-2xl">
            <h1 className="hero-title text-3xl sm:text-4xl md:text-6xl font-bold leading-tight mb-3 md:mb-4">
              Welcome to SMK Negeri 11 Bandung
            </h1>
            <p className="hero-sub text-base sm:text-lg md:text-xl opacity-90 mb-6 md:mb-8">
              Membangun generasi unggul yang siap kerja, mandiri, dan berkarakter mulia melalui pendidikan vokasi berkualitas internasional.
            </p>
            <div className="hero-btn">
              <Link to={locationId ? `/tour?location_id=${locationId}` : '/tour'}>
                <Button
                  size="lg"
                  className="flex items-center gap-2 bg-[#0667d3] text-white hover:bg-[#004fa7] rounded-full text-base md:text-lg px-6 md:px-10 py-4 md:py-6 h-auto transition-transform duration-200 hover:scale-105 active:scale-95 w-full sm:w-auto"
                >
                  <Compass size={20} />
                  Mulai Tour Virtual
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-12 md:py-20 px-4 md:px-16 bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div ref={aboutReveal.ref} className={`space-y-5 md:space-y-6 ${fadeUp(aboutReveal.visible)}`}>
            <div className="inline-block px-3 py-1 bg-[#d7e2ff] text-[#004491] rounded-full text-xs md:text-sm font-medium">
              Tentang Kami
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#004fa7] leading-snug">
              Beacon of Vocational Education
            </h2>
            <p className="text-[#424753] text-sm md:text-base leading-relaxed">
              SMK Negeri 11 Bandung merupakan lembaga pendidikan kejuruan yang berkomitmen untuk mencetak
              lulusan kompeten di berbagai bidang teknologi dan bisnis. Kami mengintegrasikan kurikulum
              industri dengan nilai-nilai karakter untuk memastikan setiap siswa siap menghadapi tantangan
              masa depan.
            </p>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="p-4 bg-[#f0f3ff] rounded-lg border border-[#c2c6d5]">
                <h3 className="text-xl md:text-2xl font-bold text-[#004fa7]">25+</h3>
                <p className="text-xs md:text-sm text-[#424753]">Tahun Pengalaman</p>
              </div>
              <div className="p-4 bg-[#f0f3ff] rounded-lg border border-[#c2c6d5]">
                <h3 className="text-xl md:text-2xl font-bold text-[#004fa7]">12</h3>
                <p className="text-xs md:text-sm text-[#424753]">Jurusan Unggulan</p>
              </div>
            </div>
          </div>

          <div
            ref={aboutImage.ref}
            className={`img-zoom relative rounded-xl overflow-hidden aspect-video shadow-lg border border-[#c2c6d5] bg-white card-hover ${fadeUp(aboutImage.visible, 150)}`}
          >
            <img
              className="w-full h-full object-cover"
              src="/kelasking.jpeg"
              alt="Siswa SMKN 11 Bandung belajar di ruang kelas modern"
            />
          </div>
        </div>
      </section>

      {/* Accreditation Section */}
      <section
        ref={accreditationReveal.ref}
        className={`py-10 md:py-16 px-4 md:px-16 bg-[#0667d3] text-white overflow-hidden relative ${fadeUp(accreditationReveal.visible)}`}
      >
        <div className="absolute right-0 top-0 opacity-10 translate-x-1/4 -translate-y-1/4 pointer-events-none">
          <ShieldCheck size={280} />
        </div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center relative z-10 gap-6 md:gap-8 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
            <div className="bg-white/20 p-3 md:p-4 rounded-full">
              <ShieldCheck size={36} />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">Accredited A</h2>
              <p className="opacity-90 text-sm md:text-base">Highest Institutional Rating by National Accreditation Board</p>
            </div>
          </div>
          <button className="bg-white text-[#0667d3] px-6 md:px-8 py-3 rounded-lg font-medium text-sm md:text-base hover:bg-[#f0f3ff] transition-colors shadow-sm w-full sm:w-auto">
            Lihat Sertifikasi
          </button>
        </div>
      </section>

      {/* Contact & Location Section */}
      <section id="location" className="py-12 md:py-20 px-4 md:px-16 bg-[#f0f3ff]">
        <div className="max-w-7xl mx-auto">
          <div ref={locationReveal.ref} className={fadeUp(locationReveal.visible)}>
            <h2 className="text-2xl md:text-4xl font-bold text-[#004fa7] mb-2">Hubungi Kami</h2>
            <p className="text-[#424753] text-sm md:text-base mb-8 md:mb-12">
              Kunjungi kampus kami atau hubungi kami melalui saluran di bawah ini.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-stretch">
            {/* Left Column: Info & Hours */}
            <div ref={locationInfo.ref} className={`md:col-span-5 space-y-6 ${fadeUp(locationInfo.visible, 0)}`}>
              <div className="space-y-4">
                <div className="flex items-start gap-3 md:gap-4 group">
                  <div className="bg-white p-2 md:p-3 rounded-lg border border-[#c2c6d5] group-hover:border-[#004fa7] transition-colors flex-shrink-0">
                    <MapPin className="text-[#004fa7]" size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm md:text-base">Alamat</h4>
                    <p className="text-[#424753] text-sm md:text-base">
                      Jl. Budi Raya No. 11, Cijagra, Kec. Lengkong, Kota Bandung, Jawa Barat 40265
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 md:gap-4 group">
                  <div className="bg-white p-2 md:p-3 rounded-lg border border-[#c2c6d5] group-hover:border-[#004fa7] transition-colors flex-shrink-0">
                    <Phone className="text-[#004fa7]" size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm md:text-base">Telepon</h4>
                    <p className="text-[#424753] text-sm md:text-base">(022) 7315150</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#004fa7] text-white p-5 md:p-6 rounded-xl shadow-sm border-l-8 border-[#d7e2ff]">
                <h3 className="font-bold mb-3 flex items-center gap-2 text-sm md:text-base">
                  <Clock size={16} />
                  Jam Operasional
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-xs md:text-sm">Senin - Jumat</span>
                    <span className="text-xs md:text-sm font-bold">07.00 - 16.00 WIB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm">Sabtu</span>
                    <span className="text-xs md:text-sm font-bold">07.00 - 12.00 WIB</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Map (kept from original) */}
            <div
              ref={locationMap.ref}
              className={`md:col-span-7 h-[300px] md:h-full min-h-[350px] md:min-h-[400px] rounded-xl overflow-hidden border border-[#c2c6d5] shadow-lg ${fadeUp(locationMap.visible, 150)}`}
            >
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3961.00062464909!2d107.55575517427145!3d-6.890527093108526!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e68e6bd6aaaaaab%3A0xf843088e2b5bf838!2sSMK%20Negeri%2011%20Bandung!5e0!3m2!1sen!2sid!4v1775716742394!5m2!1sen!2sid"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Lokasi SMK Negeri 11 Bandung"
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