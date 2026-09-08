import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../../services/supabase';

interface DetailProps {
  /** 'details' (default) shows the room/denah editor. 'data' shows the photo-count pie chart. */
  view?: 'details' | 'data';
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const GEDUNG_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const PIE_COLORS = ['#00b8ff', '#9d7fd4', '#c4a840', '#5dd0ff', '#4a6a9e', '#0095e8', '#7098c4', '#a0e0ff', '#0077cc', '#c47070'];

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.sin(angle), y: cy - r * Math.cos(angle) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  // Full-circle single slice (only one room has photos): split into two half-arcs so SVG renders it.
  if (endAngle - startAngle >= 2 * Math.PI - 0.0001) {
    const mid = startAngle + Math.PI;
    return `${arcPath(cx, cy, r, startAngle, mid)} ${arcPath(cx, cy, r, mid, endAngle)}`;
  }
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export default function Detail({ view = 'details', showToast }: DetailProps) {
  // ── ROOM DETAILS STATE (feeds the public "Detail Ruangan" page) ──
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [roomLocation, setRoomLocation] = useState('');
  const [roomCapacity, setRoomCapacity] = useState('');
  const [roomLoading, setRoomLoading] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);

  // ── PHOTOS (single upload flow — first photo becomes the cover, any extra
  // photos become gallery photos → the public page auto-shows a carousel) ──
  const [galleryImages, setGalleryImages] = useState<any[]>([]); // already-saved gallery photos (only while editing)
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);   // newly picked, not uploaded yet
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

  // Local preview URLs for photos picked but not yet saved, so the admin can actually see
  // the image (not just a filename) and remove one before confirming.
  const galleryPreviews = useMemo(
    () => galleryFiles.map(file => ({ file, url: URL.createObjectURL(file) })),
    [galleryFiles]
  );
  useEffect(() => {
    return () => { galleryPreviews.forEach(p => URL.revokeObjectURL(p.url)); };
  }, [galleryPreviews]);

  // The room currently being edited (for showing its existing cover photo in the carousel).
  const currentEditingRoom = editingRoomId ? rooms.find((r: any) => r.id === editingRoomId) : null;

  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);

  // ── DENAH / MAP PIN STATE (clickable areas on the school map) ──
  const [pins, setPins] = useState<any[]>([]);
  const [pinLabel, setPinLabel] = useState('');
  const [pinRoomId, setPinRoomId] = useState('');
  const [pinMarker, setPinMarker] = useState<{ x: number; y: number } | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [editingPinId, setEditingPinId] = useState<number | null>(null);

  const mapImageRef = useRef<HTMLDivElement>(null);

  // ── PICTURE STATS (feeds the "Data" pie chart) ──
  const [galleryCounts, setGalleryCounts] = useState<Record<number, number>>({});
  const [statsLoading, setStatsLoading] = useState(false);

  // Keep a live ref to the room currently being edited, so the realtime callback below
  // (subscribed once on mount) always sees the latest value without needing to resubscribe.
  const editingRoomIdRef = useRef<number | null>(null);
  useEffect(() => { editingRoomIdRef.current = editingRoomId; }, [editingRoomId]);

  useEffect(() => {
    fetchRooms();
    fetchPins();
    fetchPictureCounts();

    // Realtime: any insert/update/delete on rooms or room_images (from this admin tab,
    // another admin tab, or the public site) refreshes the data automatically.
    const channel = supabase
      .channel('detail-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_images' }, () => {
        fetchPictureCounts();
        if (editingRoomIdRef.current) fetchGalleryImages(editingRoomIdRef.current);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPictureCounts = async () => {
    setStatsLoading(true);
    try {
      const { data, error } = await supabase.from('room_images').select('room_id');
      if (error) throw error;
      const counts: Record<number, number> = {};
      (data || []).forEach((row: any) => {
        counts[row.room_id] = (counts[row.room_id] || 0) + 1;
      });
      setGalleryCounts(counts);
    } catch (err: any) {
      console.error('[fetchPictureCounts] FULL ERROR:', err);
      showToast(`Gagal mengambil statistik foto: ${err.message}`, 'error');
    }
    setStatsLoading(false);
  };

  // One slice per Gedung (A–L, plus "Belum Ditentukan" for rooms with no Gedung set):
  // sums each room's cover photo (if any) + gallery photo count into its building's total.
  const pictureSlices = useMemo(() => {
    const grouped: Record<string, number> = {};
    rooms.forEach((room: any) => {
      const cover = room.image_url ? 1 : 0;
      const gallery = galleryCounts[room.id] || 0;
      const total = cover + gallery;
      if (total === 0) return;
      const label = room.location || 'Belum Ditentukan';
      grouped[label] = (grouped[label] || 0) + total;
    });

    const gedungOrder = GEDUNG_OPTIONS.map(g => `Gedung ${g}`);
    const raw = Object.entries(grouped)
      .sort(([a], [b]) => {
        const ia = gedungOrder.indexOf(a);
        const ib = gedungOrder.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      })
      .map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));

    const total = raw.reduce((s, d) => s + d.value, 0);
    let cumulative = 0;
    return raw.map(d => {
      const startAngle = total > 0 ? (cumulative / total) * 2 * Math.PI : 0;
      cumulative += d.value;
      const endAngle = total > 0 ? (cumulative / total) * 2 * Math.PI : 0;
      return { ...d, startAngle, endAngle, percent: total > 0 ? (d.value / total) * 100 : 0 };
    });
  }, [rooms, galleryCounts]);

  const totalPictures = pictureSlices.reduce((s, d) => s + d.value, 0);

  // ── ROOM DETAILS: fetch / add / edit / delete ──
  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRooms(data || []);
    } catch (err: any) {
      console.error('[fetchRooms] FULL ERROR:', err);
      showToast(`Gagal mengambil detail ruangan: ${err.message}`, 'error');
    }
  };

  const resetRoomForm = () => {
    setEditingRoomId(null);
    setRoomName('');
    setRoomDescription('');
    setRoomLocation('');
    setRoomCapacity('');
    setGalleryImages([]);
    setGalleryFiles([]);
    setPreviewSlideIndex(0);
  };

  const handleEditRoomClick = (room: any) => {
    setEditingRoomId(room.id);
    setRoomName(room.name || '');
    setRoomDescription(room.description || '');
    setRoomLocation(room.location || '');
    setRoomCapacity(room.capacity ? String(room.capacity) : '');
    setGalleryFiles([]);
    setPreviewSlideIndex(0);
    fetchGalleryImages(room.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── GALLERY IMAGES: fetch existing / delete existing (adding new ones happens on Save) ──
  const fetchGalleryImages = async (roomId: number) => {
    try {
      const { data, error } = await supabase
        .from('room_images')
        .select('*')
        .eq('room_id', roomId)
        .order('position', { ascending: true });
      if (error) throw error;
      setGalleryImages(data || []);
    } catch (err: any) {
      console.error('[fetchGalleryImages] FULL ERROR:', err);
      showToast(`Gagal mengambil foto galeri: ${err.message}`, 'error');
    }
  };

  // Remove a photo that was picked but not yet uploaded/saved.
  const handleRemoveGalleryFile = (index: number) => {
    setGalleryFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteGalleryImage = async (img: any) => {
    try {
      const marker = '/room-images/';
      const idx = img.image_url.indexOf(marker);
      if (idx !== -1) {
        const filePath = img.image_url.substring(idx + marker.length);
        const { error: storageError } = await supabase.storage.from('room-images').remove([filePath]);
        if (storageError) console.error('[handleDeleteGalleryImage] storage remove error:', storageError);
      }

      const { error } = await supabase.from('room_images').delete().eq('id', img.id);
      if (error) throw error;

      if (editingRoomId) fetchGalleryImages(editingRoomId);
      showToast('Foto dihapus!');
    } catch (err: any) {
      console.error('[handleDeleteGalleryImage] FULL ERROR:', err);
      showToast(`Gagal menghapus foto: ${err.message}`, 'error');
    }
  };

  // Cover photo (existing, while editing) + saved gallery photos + newly picked photos,
  // combined into one ordered list — this mirrors exactly what the public "Detail Ruangan"
  // carousel shows. When CREATING a new room, the first newly picked photo is the cover.
  const roomPreviewSlides = useMemo(() => {
    const slides: { key: string; url: string; label: string; onDelete?: () => void }[] = [];

    if (currentEditingRoom?.image_url) {
      slides.push({ key: 'cover-existing', url: currentEditingRoom.image_url, label: 'Cover' });
    }

    galleryImages.forEach((img: any) => {
      slides.push({ key: `saved-${img.id}`, url: img.image_url, label: 'Foto tambahan', onDelete: () => handleDeleteGalleryImage(img) });
    });

    galleryPreviews.forEach((p, idx) => {
      const isNewCover = !currentEditingRoom && idx === 0; // creating new room: first picked photo = cover
      slides.push({
        key: `new-${idx}`,
        url: p.url,
        label: isNewCover ? 'Cover (baru)' : 'Foto tambahan (baru)',
        onDelete: () => handleRemoveGalleryFile(idx),
      });
    });

    return slides;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEditingRoom, galleryImages, galleryPreviews]);

  useEffect(() => {
    if (previewSlideIndex >= roomPreviewSlides.length) setPreviewSlideIndex(0);
  }, [roomPreviewSlides.length, previewSlideIndex]);

  // Handles BOTH creating a new room and saving edits to an existing one.
  // All photos are picked through the single multi-file input above, uploaded together here.
  const handleSaveRoom = async () => {
    if (!roomName.trim()) { showToast('Silakan isi nama ruangan', 'error'); return; }
    if (!editingRoomId && galleryFiles.length === 0) { showToast('Silakan pilih minimal satu foto', 'error'); return; }

    setRoomLoading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of galleryFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('room-images')
          .upload(fileName, file, { contentType: file.type });
        if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

        const { data: { publicUrl } } = supabase.storage
          .from('room-images')
          .getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      const payload: any = {
        name: roomName,
        description: roomDescription,
        location: roomLocation || null,
        capacity: roomCapacity ? Number(roomCapacity) : null,
      };

      let roomId = editingRoomId;

      if (editingRoomId) {
        // Editing: cover photo stays as-is here — every newly uploaded photo joins the gallery.
        const { error: updateError } = await supabase.from('rooms').update(payload).eq('id', editingRoomId);
        if (updateError) throw new Error(updateError.message);
      } else {
        // Creating: the first uploaded photo becomes the cover.
        payload.image_url = uploadedUrls[0];
        const { data: inserted, error: insertError } = await supabase
          .from('rooms')
          .insert(payload)
          .select()
          .single();
        if (insertError) throw new Error(insertError.message);
        roomId = inserted.id;
      }

      const extraUrls = editingRoomId ? uploadedUrls : uploadedUrls.slice(1);
      if (roomId && extraUrls.length > 0) {
        let position = editingRoomId ? galleryImages.length : 0;
        for (const url of extraUrls) {
          const { error: galleryInsertError } = await supabase.from('room_images').insert({
            room_id: roomId,
            image_url: url,
            position: position++,
          });
          if (galleryInsertError) throw new Error(galleryInsertError.message);
        }
      }

      showToast(editingRoomId ? 'Detail ruangan berhasil diperbarui!' : 'Detail ruangan berhasil ditambahkan!');
      resetRoomForm();
      fetchRooms();
    } catch (err: any) {
      console.error('[handleSaveRoom] FULL ERROR:', err);
      showToast(`Gagal menyimpan ruangan: ${err.message || err}`, 'error');
    }
    setRoomLoading(false);
  };

  const handleDeleteRoom = async (id: number) => {
    try {
      const roomToDelete = rooms.find((r: any) => r.id === id);

      if (roomToDelete?.image_url) {
        const marker = '/room-images/';
        const idx = roomToDelete.image_url.indexOf(marker);
        if (idx !== -1) {
          const filePath = roomToDelete.image_url.substring(idx + marker.length);
          const { error: storageError } = await supabase.storage.from('room-images').remove([filePath]);
          if (storageError) console.error('[handleDeleteRoom] storage remove error:', storageError);
        }
      }

      const { error } = await supabase.from('rooms').delete().eq('id', id);
      if (error) throw error;

      if (editingRoomId === id) resetRoomForm();
      fetchRooms();
      showToast('Detail ruangan berhasil dihapus!');
    } catch (err: any) {
      console.error('[handleDeleteRoom] FULL ERROR:', err);
      showToast(`Gagal menghapus ruangan: ${err.message}`, 'error');
    }
  };

  // ── DENAH PINS: fetch / add / edit / delete ──
  const fetchPins = async () => {
    try {
      const { data, error } = await supabase
        .from('room_pins')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setPins(data || []);
    } catch (err: any) {
      console.error('[fetchPins] FULL ERROR:', err);
      showToast(`Gagal mengambil pin peta: ${err.message}`, 'error');
    }
  };

  const resetPinForm = () => {
    setEditingPinId(null);
    setPinLabel('');
    setPinRoomId('');
    setPinMarker(null);
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPinMarker({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  };

  const handleEditPinClick = (pin: any) => {
    setEditingPinId(pin.id);
    setPinLabel(pin.label || '');
    setPinRoomId(pin.room_id ? String(pin.room_id) : '');
    setPinMarker({ x: pin.map_x, y: pin.map_y });
  };

  const handleSavePin = async () => {
    if (!pinMarker) { showToast('Tap posisi di denah dulu', 'error'); return; }
    if (!pinLabel.trim()) { showToast('Isi label/nama area', 'error'); return; }

    setPinLoading(true);
    try {
      const payload = {
        label: pinLabel,
        map_x: pinMarker.x,
        map_y: pinMarker.y,
        room_id: pinRoomId ? Number(pinRoomId) : null,
      };

      if (editingPinId) {
        const { error } = await supabase.from('room_pins').update(payload).eq('id', editingPinId);
        if (error) throw error;
        showToast('Area diperbarui!');
      } else {
        const { error } = await supabase.from('room_pins').insert(payload);
        if (error) throw error;
        showToast('Area ditambahkan!');
      }

      resetPinForm();
      fetchPins();
    } catch (err: any) {
      console.error('[handleSavePin] FULL ERROR:', err);
      showToast(`Gagal menyimpan area: ${err.message}`, 'error');
    }
    setPinLoading(false);
  };

  const handleDeletePin = async (id: number) => {
    try {
      const { error } = await supabase.from('room_pins').delete().eq('id', id);
      if (error) throw error;
      if (editingPinId === id) resetPinForm();
      fetchPins();
      showToast('Area dihapus!');
    } catch (err: any) {
      console.error('[handleDeletePin] FULL ERROR:', err);
      showToast(`Gagal menghapus area: ${err.message}`, 'error');
    }
  };

  // ── "DATA" VIEW: pie chart of how many pictures exist per room ──
  if (view === 'data') {
    return (
      <>
        <div className="stats-row">
          <div className="stat-card" style={{ gridColumn: '1 / -1' }}>
            <div className="stat-num">{totalPictures}</div>
            <div className="stat-label">Total Foto di Database</div>
          </div>
        </div>

        <div className="section-title">Data Foto</div>
        <div className="section-sub">DISTRIBUSI FOTO PER GEDUNG (COVER + GALERI)</div>

        <div className="info-box">
          Pie chart ini menjumlahkan foto cover dan foto galeri dari semua Detail Ruangan, dikelompokkan berdasarkan Gedung.
        </div>

        <div className="card">
          <div className="card-title">
            <span>// Distribusi Foto per Gedung</span>
            <button
              className="btn btn-secondary"
              onClick={fetchPictureCounts}
              disabled={statsLoading}
              style={{ padding: '0.3rem 0.7rem', fontSize: '0.68rem' }}
            >
              {statsLoading ? 'Memuat...' : '↻ Refresh'}
            </button>
          </div>

          {pictureSlices.length === 0
            ? <div className="empty-state">Belum ada foto tersimpan di database.</div>
            : <div className="pie-chart-wrap">
              <svg viewBox="0 0 200 200" width="220" height="220">
                {pictureSlices.map((s, i) => (
                  <path key={i} d={arcPath(100, 100, 90, s.startAngle, s.endAngle)} fill={s.color} stroke="#0a1420" strokeWidth={1} />
                ))}
                <circle cx="100" cy="100" r="52" fill="#0d1b2e" />
                <text x="100" y="96" textAnchor="middle" fontSize="22" fill="#00b8ff" fontFamily="'Playfair Display', serif" fontWeight={700}>{totalPictures}</text>
                <text x="100" y="114" textAnchor="middle" fontSize="8" fill="#0095e8" letterSpacing="1">FOTO</text>
              </svg>

              <div className="pie-legend">
                {pictureSlices.map((s, i) => (
                  <div key={i} className="pie-legend-item">
                    <span className="pie-swatch" style={{ background: s.color }} />
                    <span className="pie-legend-label">{s.label}</span>
                    <span className="pie-legend-value">{s.value} ({s.percent.toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card" style={{ gridColumn: '1 / -1' }}>
          <div className="stat-num">{rooms.length}</div>
          <div className="stat-label">Total Detail Ruangan</div>
        </div>
      </div>

      <div className="section-title">Detail Ruangan</div>
      <div className="section-sub">FOTO + TEKS MANUAL UNTUK HALAMAN PUBLIK "DETAIL RUANGAN"</div>

      <div className="info-box">
        Upload foto dan isi info di bawah. Ini akan tampil di halaman detail ruangan yang dilihat pengunjung saat mereka tap area di denah.
      </div>

      {/* ── Add / Edit room form (photos picked below, before confirming) ── */}
      <div className="card">
        <div className="card-title">
          <span>{editingRoomId ? `// Mengedit Ruangan #${editingRoomId}` : '// Tambah Detail Ruangan'}</span>
          {editingRoomId && <span className="editing-badge">MENGEDIT</span>}
        </div>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label">Nama Ruangan</label>
          <input className="form-input" placeholder="misalnya Ruang RPL 1" value={roomName} onChange={e => setRoomName(e.target.value)} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Lokasi (Gedung)</label>
            <select className="form-input" value={roomLocation} onChange={e => setRoomLocation(e.target.value)}>
              <option value="">Belum dipilih</option>
              {GEDUNG_OPTIONS.map(g => (
                <option key={g} value={`Gedung ${g}`}>{`Gedung ${g}`}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Kapasitas (opsional)</label>
            <input className="form-input" type="number" placeholder="misalnya 36" value={roomCapacity} onChange={e => setRoomCapacity(e.target.value)} />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label">Deskripsi</label>
          <textarea
            className="form-input"
            placeholder="Deskripsikan ruangan ini..."
            value={roomDescription}
            onChange={e => setRoomDescription(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label">
            {editingRoomId ? 'Tambah Foto (opsional)' : 'Foto Ruangan (bisa pilih lebih dari 1 — foto pertama otomatis jadi cover)'}
          </label>
          <div className="file-input-wrapper" onClick={() => galleryFileInputRef.current?.click()}>
            <input
              ref={galleryFileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={e => {
                const picked = e.target.files ? Array.from(e.target.files) : [];
                setGalleryFiles(prev => [...prev, ...picked]);
                e.target.value = ''; // allow picking the same file again later
              }}
            />
            <div className="file-label">
              <strong>Pilih gambar</strong> atau tap di sini — bisa pilih beberapa sekaligus
            </div>
          </div>
          <span style={{ fontSize: '0.68rem', color: '#0095e8' }}>
            Foto diupload saat kamu tekan Simpan/Tambah di bawah. Selama belum ditekan, foto masih bisa ditambah atau dibatalkan lewat preview di bawah ini. Kalau totalnya lebih dari 1 foto, halaman publik otomatis menampilkan carousel.
          </span>
        </div>

        {/* Carousel preview — mirrors exactly what the public Detail Ruangan page will show */}
        {roomPreviewSlides.length > 0 && (
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Preview Carousel (tampilan di Detail Ruangan)</label>
            <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid #0077cc', background: '#0a1420' }}>
              <img
                src={roomPreviewSlides[previewSlideIndex]?.url}
                alt={roomPreviewSlides[previewSlideIndex]?.label}
                style={{ width: '100%', height: 'clamp(260px, 45vw, 460px)', objectFit: 'contain', display: 'block', background: '#000' }}
              />
              {roomPreviewSlides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setPreviewSlideIndex(i => (i - 1 + roomPreviewSlides.length) % roomPreviewSlides.length)}
                    style={{ position: 'absolute', top: '50%', left: '0.5rem', transform: 'translateY(-50%)', background: 'rgba(10,10,15,0.7)', color: '#00b8ff', border: '1px solid #0077cc', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                  >‹</button>
                  <button
                    type="button"
                    onClick={() => setPreviewSlideIndex(i => (i + 1) % roomPreviewSlides.length)}
                    style={{ position: 'absolute', top: '50%', right: '0.5rem', transform: 'translateY(-50%)', background: 'rgba(10,10,15,0.7)', color: '#00b8ff', border: '1px solid #0077cc', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                  >›</button>
                </>
              )}
              <div style={{ position: 'absolute', bottom: '0.6rem', left: '0.6rem', background: 'rgba(10,10,15,0.75)', color: '#a0e0ff', fontSize: '0.68rem', padding: '0.25rem 0.6rem', borderRadius: '4px', letterSpacing: '0.05em' }}>
                {roomPreviewSlides[previewSlideIndex]?.label} · {previewSlideIndex + 1}/{roomPreviewSlides.length}
              </div>
            </div>

            {roomPreviewSlides.length > 1 && (
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginTop: '0.7rem' }}>
                {roomPreviewSlides.map((s, i) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setPreviewSlideIndex(i)}
                    aria-label={`Slide ${i + 1}`}
                    style={{ width: '9px', height: '9px', padding: 0, borderRadius: '50%', border: 'none', cursor: 'pointer', background: i === previewSlideIndex ? '#00b8ff' : '#0077cc' }}
                  />
                ))}
              </div>
            )}

            {roomPreviewSlides[previewSlideIndex]?.onDelete && (
              <button
                className="btn btn-danger"
                style={{ width: '100%', marginTop: '0.6rem' }}
                onClick={roomPreviewSlides[previewSlideIndex]?.onDelete}
              >
                Hapus Foto Ini
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-primary"
            onClick={handleSaveRoom}
            disabled={roomLoading || !roomName.trim() || (!editingRoomId && galleryFiles.length === 0)}
            style={{ flex: 1 }}
          >
            {roomLoading ? 'Menyimpan...' : editingRoomId ? '✓ Simpan Perubahan' : '+ Tambah Detail Ruangan'}
          </button>
          {editingRoomId && (
            <button className="btn btn-secondary" onClick={resetRoomForm}>Batal</button>
          )}
        </div>
      </div>

      {/* ── Room list ── */}
      <div className="card">
        <div className="card-title">// Semua Ruangan ({rooms.length})</div>
        {rooms.length === 0
          ? <div className="empty-state">Belum ada detail ruangan. Tambahkan satu di atas!</div>
          : <div className="room-grid">
            {rooms.map((room: any) => (
              <div key={room.id} className={`room-card ${editingRoomId === room.id ? 'editing' : ''}`}>
                <img className="room-img" src={room.image_url} alt={room.name}
                  onError={(e: any) => { e.target.src = ''; e.target.style.background = '#0077cc'; }} />
                <div className="room-info">
                  <div className="room-name">{room.name}</div>
                  <div className="room-meta">
                    {room.location || ''}{room.location && room.capacity ? ' · ' : ''}{room.capacity ? `${room.capacity} orang` : ''}
                  </div>
                  {room.description && <div className="room-desc">{room.description}</div>}
                  <div className="room-actions">
                    <span style={{ fontSize: '0.62rem', color: '#0095e8' }}>ID: {room.id}</span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn btn-edit" onClick={() => handleEditRoomClick(room)}>Edit</button>
                      <button className="btn btn-danger" onClick={() => handleDeleteRoom(room.id)}>Hapus</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>}
      </div>

      {/* ── Denah / map pin editor ── */}
      <div className="section-title" style={{ marginTop: '2rem', fontSize: '1.3rem' }}>Peta Denah Ruangan</div>
      <div className="section-sub">TENTUKAN AREA MANA YANG BISA DIKLIK PENGUNJUNG DI DENAH</div>

      <div className="info-box">
        Tap posisi ruangan di denah untuk menandai area, kasih label, lalu (opsional) hubungkan ke salah satu Detail Ruangan di atas. Kalau belum dihubungkan ke ruangan manapun, pengunjung akan lihat pesan "belum tersedia" saat nge-tap area itu.
      </div>

      <div className="card">
        <div className="card-title">
          <span>{editingPinId ? `// Mengedit Area #${editingPinId}` : '// Langkah 1 — Tap posisi di denah'}</span>
          {editingPinId && <span className="editing-badge">MENGEDIT</span>}
        </div>
        <div className="click-image-wrapper" ref={mapImageRef} onClick={handleMapClick}>
          <img src="/Denah.jpeg" alt="Denah SMK Negeri 11 Bandung" draggable={false}
            onError={(e: any) => { e.target.style.display = 'none'; }} />
          {!pinMarker && <div className="crosshair-label">Tap untuk menempatkan area</div>}

          {/* Show already-saved pins for reference (skip the one currently being edited) */}
          {pins.filter(p => p.id !== editingPinId).map((p: any) => (
            <div key={p.id} className="existing-pin" style={{ left: `${p.map_x}%`, top: `${p.map_y}%` }}>
              <div className="existing-pin-dot" />
            </div>
          ))}

          {pinMarker && (
            <div className="click-marker" style={{ left: `${pinMarker.x}%`, top: `${pinMarker.y}%` }}>
              <div className="click-marker-ring"><div className="click-marker-dot" /></div>
            </div>
          )}
        </div>

        <div className="coord-readout">
          {!pinMarker ? (
            <span className="coord-empty">Tap di denah untuk menentukan posisi area</span>
          ) : (
            <>
              <div className="coord-pill">
                <span className="coord-key">X</span>
                <span className="coord-val">{pinMarker.x}%</span>
              </div>
              <div className="coord-divider" />
              <div className="coord-pill">
                <span className="coord-key">Y</span>
                <span className="coord-val">{pinMarker.y}%</span>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <button className="btn btn-danger" style={{ padding: '0.25rem 0.65rem', fontSize: '0.7rem' }}
                  onClick={() => setPinMarker(null)}>
                  Hapus
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">// Langkah 2 — Label & hubungkan ke ruangan</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Label Area</label>
            <input className="form-input" placeholder="misalnya Ruang Teori 7" value={pinLabel} onChange={e => setPinLabel(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Hubungkan ke Detail Ruangan</label>
            <select className="form-input" value={pinRoomId} onChange={e => setPinRoomId(e.target.value)}>
              <option value="">Belum ada detail</option>
              {rooms.map((r: any) => (
                <option key={r.id} value={r.id}>{r.name} (ID: {r.id})</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-primary"
            onClick={handleSavePin}
            disabled={pinLoading || !pinMarker || !pinLabel.trim()}
            style={{ flex: 1 }}
          >
            {pinLoading ? 'Menyimpan...' : editingPinId ? '✓ Simpan Area' : '+ Tambah Area'}
          </button>
          {(editingPinId || pinMarker || pinLabel) && (
            <button className="btn btn-secondary" onClick={resetPinForm}>Batal</button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">// Area di Denah ({pins.length})</div>
        {pins.length === 0
          ? <div className="empty-state">Belum ada area. Tandai di denah di atas!</div>
          : <div className="hotspot-list">
            {pins.map((pin: any) => {
              const linkedRoom = rooms.find((r: any) => r.id === pin.room_id);
              return (
                <div key={pin.id} className="hotspot-item">
                  <div className="hotspot-item-info">
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={`hotspot-badge ${linkedRoom ? 'linked' : 'unlinked'}`}>
                        {linkedRoom ? 'TERHUBUNG' : 'BELUM TERHUBUNG'}
                      </span>
                      <span style={{ color: '#a0e0ff', fontSize: '0.8rem' }}>{pin.label}</span>
                    </div>
                    <span style={{ color: '#0095e8', fontSize: '0.68rem' }}>x: {pin.map_x}% | y: {pin.map_y}%</span>
                    {linkedRoom && <span style={{ color: '#0095e8', fontSize: '0.68rem' }}>menuju {linkedRoom.name}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn btn-edit" onClick={() => handleEditPinClick(pin)}>Edit</button>
                    <button className="btn btn-danger" onClick={() => handleDeletePin(pin.id)}>Hapus</button>
                  </div>
                </div>
              );
            })}
          </div>}
      </div>
    </>
  );
}