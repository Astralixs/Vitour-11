import { useState, useEffect, useRef } from 'react';
import { createPanorama, getPanoramas, deletePanorama } from '../../../services/api';
import { supabase } from '../../../services/supabase';

const BASE_URL = import.meta.env.VITE_API_URL;

function clickToEquirectangular(
  clickX: number,
  clickY: number,
  imgWidth: number,
  imgHeight: number
): { pitch: number; yaw: number } {
  const nx = clickX / imgWidth;
  const ny = clickY / imgHeight;
  const yaw = nx * 360 - 180;
  const pitch = 90 - ny * 180;
  return {
    pitch: Math.round(pitch * 10) / 10,
    yaw: Math.round(yaw * 10) / 10,
  };
}

interface PanoramaProps {
  /** Which sub-view to render: the panorama grid, or the hotspot editor for the selected panorama. */
  view: 'panoramas' | 'hotspots';
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Called when a panorama card is clicked, so the parent can switch its active tab to 'hotspots'. */
  onRequestHotspotView: () => void;
  /** Called whenever the selected panorama changes, so the parent sidebar can show its title. */
  onSelectedPanoramaChange: (label: string | null) => void;
}

export default function Panorama({ view, showToast, onRequestHotspotView, onSelectedPanoramaChange }: PanoramaProps) {
  const [locationId, setLocationId] = useState<number | null>(null);
  const [panoramas, setPanoramas] = useState<any[]>([]);
  const [hotspots, setHotspots] = useState<any[]>([]);
  const [selectedPanorama, setSelectedPanorama] = useState<any | null>(null);
  const [panoramaTitle, setPanoramaTitle] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [hsType, setHsType] = useState<'scene' | 'info'>('scene');
  const [hsPitch, setHsPitch] = useState('');
  const [hsYaw, setHsYaw] = useState('');
  const [hsText, setHsText] = useState('');
  const [hsTargetId, setHsTargetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [clickMarker, setClickMarker] = useState<{ x: number; y: number } | null>(null);

  const imageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log('[fetchLocations] BASE_URL:', BASE_URL);
    fetch(`${BASE_URL}/api/locations`)
      .then(res => {
        if (!res.ok) throw new Error(`Locations fetch failed: ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        if (data.length > 0) {
          setLocationId(data[0].id);
        } else {
          showToast('Lokasi tidak ditemukan di database!', 'error');
        }
      })
      .catch(err => {
        console.error('[fetchLocations] FULL ERROR:', err);
        showToast(`Gagal mengambil data lokasi: ${err.message}`, 'error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (locationId) fetchPanoramas(locationId); }, [locationId]);

  useEffect(() => {
    if (selectedPanorama) {
      fetchHotspots(selectedPanorama.id);
      setClickMarker(null);
      setHsPitch('');
      setHsYaw('');
    }
    onSelectedPanoramaChange(selectedPanorama ? (selectedPanorama.title || `ID: ${selectedPanorama.id}`) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPanorama]);

  const createDefaultLocation = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Tour', description: 'My first tour location' }),
      });
      if (!res.ok) throw new Error(`Create location failed: ${res.status} ${res.statusText}`);
      const loc = await res.json();
      setLocationId(loc.id);
      showToast('Lokasi berhasil dibuat!');
    } catch (err: any) {
      console.error('[createDefaultLocation] FULL ERROR:', err);
      showToast(`Gagal membuat lokasi: ${err.message}`, 'error');
    }
  };

  const fetchPanoramas = async (id: number) => {
    try {
      setPanoramas(await getPanoramas(id));
    } catch (err: any) {
      console.error('[fetchPanoramas] FULL ERROR:', err);
      showToast(`Gagal mengambil data panorama: ${err.message}`, 'error');
    }
  };

  const fetchHotspots = async (panorama_id: number) => {
    try {
      const res = await fetch(`${BASE_URL}/api/hotspots?panorama_id=${panorama_id}`);
      if (!res.ok) throw new Error(`Hotspots fetch failed: ${res.status} ${res.statusText}`);
      setHotspots(await res.json());
    } catch (err: any) {
      console.error('[fetchHotspots] FULL ERROR:', err);
      showToast(`Gagal mengambil data hotspot: ${err.message}`, 'error');
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const { pitch, yaw } = clickToEquirectangular(clickX, clickY, rect.width, rect.height);
    setHsPitch(String(pitch));
    setHsYaw(String(yaw));
    setClickMarker({ x: (clickX / rect.width) * 100, y: (clickY / rect.height) * 100 });
  };

  const handleAddPanorama = async () => {
    if (!imageFile) { showToast('Silakan pilih gambar', 'error'); return; }
    if (!locationId) { showToast('Lokasi tidak ditemukan — buat dulu', 'error'); return; }
    setLoading(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      console.log('[handleAddPanorama] uploading to storage...', fileName);
      const { error: uploadError } = await supabase.storage
        .from('panoramas')
        .upload(fileName, imageFile, { contentType: imageFile.type });
      if (uploadError) {
        console.error('[handleAddPanorama] storage upload error:', uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('panoramas')
        .getPublicUrl(fileName);
      console.log('[handleAddPanorama] got publicUrl:', publicUrl);

      console.log('[handleAddPanorama] calling createPanorama, BASE_URL =', BASE_URL);
      await createPanorama({
        location_id: locationId,
        title: panoramaTitle,
        image_url: publicUrl,
      });

      setPanoramaTitle(''); setImageFile(null);
      fetchPanoramas(locationId);
      showToast('Panorama berhasil diupload!');
    } catch (err: any) {
      console.error('[handleAddPanorama] FULL ERROR:', err);
      showToast(`Gagal mengupload panorama: ${err.message || err}`, 'error');
    }
    setLoading(false);
  };

  const handleDeletePanorama = async (id: number) => {
    try {
      const panoToDelete = panoramas.find((p: any) => p.id === id);

      if (panoToDelete?.image_url) {
        try {
          const marker = '/panoramas/';
          const idx = panoToDelete.image_url.indexOf(marker);
          if (idx !== -1) {
            const filePath = panoToDelete.image_url.substring(idx + marker.length);
            console.log('[handleDeletePanorama] removing storage file:', filePath);
            const { error: storageError } = await supabase.storage
              .from('panoramas')
              .remove([filePath]);
            if (storageError) {
              console.error('[handleDeletePanorama] storage remove error:', storageError);
            }
          } else {
            console.warn('[handleDeletePanorama] could not parse file path from image_url:', panoToDelete.image_url);
          }
        } catch (storageErr) {
          console.error('[handleDeletePanorama] storage cleanup failed:', storageErr);
        }
      }

      try {
        const res = await fetch(`${BASE_URL}/api/hotspots?panorama_id=${id}`);
        if (res.ok) {
          const ownHotspots = await res.json();
          for (const hs of ownHotspots) {
            const delRes = await fetch(`${BASE_URL}/api/hotspots/${hs.id}`, { method: 'DELETE' });
            if (!delRes.ok) console.error(`[handleDeletePanorama] failed deleting own hotspot ${hs.id}: ${delRes.status}`);
          }
          console.log(`[handleDeletePanorama] removed ${ownHotspots.length} own hotspot(s) for panorama ${id}`);
        } else {
          console.error('[handleDeletePanorama] failed fetching own hotspots:', res.status);
        }
      } catch (hsErr) {
        console.error('[handleDeletePanorama] own hotspot cleanup failed:', hsErr);
      }

      try {
        const otherPanoramas = panoramas.filter((p: any) => p.id !== id);
        for (const pan of otherPanoramas) {
          const res = await fetch(`${BASE_URL}/api/hotspots?panorama_id=${pan.id}`);
          if (!res.ok) continue;
          const hsList = await res.json();
          const targeting = hsList.filter((hs: any) => hs.target_panorama_id === id);
          for (const hs of targeting) {
            const delRes = await fetch(`${BASE_URL}/api/hotspots/${hs.id}`, { method: 'DELETE' });
            if (!delRes.ok) console.error(`[handleDeletePanorama] failed deleting linking hotspot ${hs.id}: ${delRes.status}`);
          }
          if (targeting.length > 0) {
            console.log(`[handleDeletePanorama] removed ${targeting.length} linking hotspot(s) from panorama ${pan.id}`);
          }
        }
      } catch (linkErr) {
        console.error('[handleDeletePanorama] linking hotspot cleanup failed:', linkErr);
      }

      await deletePanorama(id);

      if (selectedPanorama?.id === id) { setSelectedPanorama(null); setHotspots([]); }
      if (locationId) fetchPanoramas(locationId);
      showToast('Panorama, gambar, dan hotspot terkait berhasil dihapus!');
    } catch (err: any) {
      console.error('[handleDeletePanorama] FULL ERROR:', err);
      showToast(`Gagal menghapus panorama: ${err.message}`, 'error');
    }
  };

  const handleSetFirstScene = async (id: number) => {
    try {
      for (const pan of panoramas) {
        const res = await fetch(`${BASE_URL}/api/panoramas/${pan.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...pan, is_first_scene: pan.id === id }),
        });
        if (!res.ok) throw new Error(`Update failed for panorama ${pan.id}: ${res.status} ${res.statusText}`);
      }
      if (locationId) fetchPanoramas(locationId);
      showToast('Scene pertama berhasil diperbarui!');
    } catch (err: any) {
      console.error('[handleSetFirstScene] FULL ERROR:', err);
      showToast(`Gagal mengatur scene pertama: ${err.message}`, 'error');
    }
  };

  const handleAddHotspot = async () => {
    if (!selectedPanorama || !hsPitch || !hsYaw) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/hotspots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panorama_id: selectedPanorama.id,
          type: hsType,
          pitch: Number(hsPitch),
          yaw: Number(hsYaw),
          text: hsText,
          target_panorama_id: hsType === 'scene' && hsTargetId ? Number(hsTargetId) : null,
        })
      });
      if (!res.ok) throw new Error(`Add hotspot failed: ${res.status} ${res.statusText}`);
      setHsPitch(''); setHsYaw(''); setHsText(''); setHsTargetId('');
      setClickMarker(null);
      fetchHotspots(selectedPanorama.id);
      showToast('Hotspot berhasil ditambahkan!');
    } catch (err: any) {
      console.error('[handleAddHotspot] FULL ERROR:', err);
      showToast(`Gagal menambahkan hotspot: ${err.message}`, 'error');
    }
    setLoading(false);
  };

  const handleDeleteHotspot = async (id: number) => {
    try {
      const res = await fetch(`${BASE_URL}/api/hotspots/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete hotspot failed: ${res.status} ${res.statusText}`);
      if (selectedPanorama) fetchHotspots(selectedPanorama.id);
      showToast('Hotspot berhasil dihapus!');
    } catch (err: any) {
      console.error('[handleDeleteHotspot] FULL ERROR:', err);
      showToast(`Gagal menghapus hotspot: ${err.message}`, 'error');
    }
  };

  return (
    <>
      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card"><div className="stat-num">{panoramas.length}</div><div className="stat-label">Panorama</div></div>
        <div className="stat-card"><div className="stat-num">{hotspots.length}</div><div className="stat-label">Hotspot</div></div>
        <div className="stat-card"><div className="stat-num">{panoramas.filter((p: any) => p.is_first_scene).length > 0 ? '✓' : '—'}</div><div className="stat-label">Scene Pertama</div></div>
      </div>

      {!locationId && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <p style={{ color: '#0095e8', marginBottom: '1rem', fontSize: '0.82rem' }}>Belum ada lokasi. Buat lokasi dulu untuk mulai menambahkan panorama.</p>
          <button className="btn btn-primary" onClick={createDefaultLocation}>+ Buat Lokasi</button>
        </div>
      )}

      {/* ── PANORAMAS VIEW ── */}
      {view === 'panoramas' && (
        <>
          <div className="section-title">Panorama</div>
          <div className="section-sub">KELOLA SCENE 360°</div>

          <div className="info-box">
            Upload gambar equirectangular 360° kamu di sini. Klik <strong style={{ color: '#c4a840' }}>☆ Jadikan Pertama</strong> pada scene tempat tur harus dimulai. Klik kartu panorama untuk menambahkan hotspot ke situ.
          </div>

          <div className="card">
            <div className="card-title">// Upload Panorama Baru</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Judul</label>
                <input className="form-input" placeholder="Judul scene..." value={panoramaTitle} onChange={e => setPanoramaTitle(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Gambar 360°</label>
                <div className="file-input-wrapper" onClick={() => fileInputRef.current?.click()}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => setImageFile(e.target.files?.[0] || null)}
                  />
                  <div className="file-label">
                    {imageFile ? <strong>{imageFile.name}</strong> : <><strong>Pilih gambar</strong> atau tap di sini</>}
                  </div>
                </div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleAddPanorama} disabled={loading || !imageFile} style={{ width: '100%' }}>
              {loading ? 'Mengupload...' : 'Upload Panorama'}
            </button>
          </div>

          <div className="card">
            <div className="card-title">// Semua Panorama ({panoramas.length}) — tap kartu untuk mengedit hotspot</div>
            {panoramas.length === 0
              ? <div className="empty-state">Belum ada panorama. Upload dulu di atas!</div>
              : <div className="panorama-grid">
                {panoramas.map((pan: any) => (
                  <div key={pan.id} className={`panorama-card ${selectedPanorama?.id === pan.id ? 'selected' : ''}`}
                    onClick={() => { setSelectedPanorama(pan); onRequestHotspotView(); }}>
                    <img className="panorama-img" src={pan.image_url} alt={pan.title}
                      onError={(e: any) => { e.target.src = ''; e.target.style.background = '#0077cc'; }} />
                    <div className="panorama-info">
                      <span className="panorama-title">{pan.title || 'Tanpa judul'}</span>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {pan.is_first_scene ? <span className="first-badge">PERTAMA</span> : null}
                        <button className={`btn btn-accent ${pan.is_first_scene ? 'on' : ''}`}
                          onClick={e => { e.stopPropagation(); handleSetFirstScene(pan.id); }}>
                          {pan.is_first_scene ? '★' : '☆'}
                        </button>
                        <button className="btn btn-danger" onClick={e => { e.stopPropagation(); handleDeletePanorama(pan.id); }}>Hapus</button>
                      </div>
                    </div>
                    <div style={{ padding: '0 0.75rem 0.5rem', fontSize: '0.62rem', color: '#0095e8' }}>ID: {pan.id}</div>
                  </div>
                ))}
              </div>}
          </div>
        </>
      )}

      {/* ── HOTSPOTS VIEW ── */}
      {view === 'hotspots' && (
        <>
          <div className="section-title">Hotspot</div>
          <div className="section-sub">{selectedPanorama ? `MENGEDIT: ${selectedPanorama.title || `Panorama #${selectedPanorama.id}`}` : 'PILIH PANORAMA DULU'}</div>

          {!selectedPanorama
            ? <div className="card"><div className="empty-state">Buka tab Panorama dan tap kartu panorama untuk mengedit hotspot-nya.</div></div>
            : <>
              <div className="card">
                <div className="card-title">// Langkah 1 — Tap gambar untuk menempatkan hotspot</div>
                <div className="click-image-wrapper" ref={imageRef} onClick={handleImageClick}>
                  <img src={selectedPanorama.image_url} alt={selectedPanorama.title} draggable={false}
                    onError={(e: any) => { e.target.style.display = 'none'; }} />
                  {!clickMarker && <div className="crosshair-label">Tap untuk menempatkan hotspot</div>}
                  {clickMarker && (
                    <div className="click-marker" style={{ left: `${clickMarker.x}%`, top: `${clickMarker.y}%` }}>
                      <div className="click-marker-ring"><div className="click-marker-dot" /></div>
                    </div>
                  )}
                </div>

                <div className="coord-readout">
                  {!clickMarker ? (
                    <span className="coord-empty">Tap di mana saja pada panorama untuk mengatur koordinat</span>
                  ) : (
                    <>
                      <div className="coord-pill">
                        <span className="coord-key">Pitch</span>
                        <span className="coord-val">{hsPitch}°</span>
                      </div>
                      <div className="coord-divider" />
                      <div className="coord-pill">
                        <span className="coord-key">Yaw</span>
                        <span className="coord-val">{hsYaw}°</span>
                      </div>
                      <div style={{ marginLeft: 'auto' }}>
                        <button className="btn btn-danger" style={{ padding: '0.25rem 0.65rem', fontSize: '0.7rem' }}
                          onClick={() => { setClickMarker(null); setHsPitch(''); setHsYaw(''); }}>
                          Hapus
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-title">// Langkah 2 — Atur dan simpan hotspot</div>
                <div className="info-box">
                  Untuk tipe <strong>scene</strong>, pilih panorama tujuan dari dropdown. Untuk tipe <strong>info</strong>, cukup tambahkan teks label.
                </div>

                <div className="form-row" style={{ marginBottom: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Tipe</label>
                    <select className="form-input" value={hsType} onChange={e => setHsType(e.target.value as 'scene' | 'info')}>
                      <option value="scene">scene (tautan)</option>
                      <option value="info">info (teks)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teks Label</label>
                    <input className="form-input" placeholder="misalnya Menuju Lobby" value={hsText} onChange={e => setHsText(e.target.value)} />
                  </div>
                </div>

                {hsType === 'scene' && (
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Panorama Tujuan (tertaut ke)</label>
                    <select className="form-input" value={hsTargetId} onChange={e => setHsTargetId(e.target.value)}>
                      <option value="">Pilih panorama tujuan...</option>
                      {panoramas.filter(p => p.id !== selectedPanorama.id).map((p: any) => (
                        <option key={p.id} value={p.id}>{p.title || `Panorama #${p.id}`} (ID: {p.id})</option>
                      ))}
                    </select>
                  </div>
                )}

                <button className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%' }}
                  onClick={handleAddHotspot} disabled={loading || !hsPitch || !hsYaw}>
                  {loading ? 'Menambahkan...' : !hsPitch ? 'Tap gambar dulu untuk mengatur posisi' : '+ Tambah Hotspot'}
                </button>
              </div>

              <div className="card">
                <div className="card-title">// Hotspot ({hotspots.length})</div>
                {hotspots.length === 0
                  ? <div className="empty-state">Belum ada hotspot. Tap gambar di atas untuk menempatkan satu!</div>
                  : <div className="hotspot-list">
                    {hotspots.map((hs: any) => (
                      <div key={hs.id} className="hotspot-item">
                        <div className="hotspot-item-info">
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className={`hotspot-badge ${hs.type}`}>{hs.type.toUpperCase()}</span>
                            <span style={{ color: '#a0e0ff', fontSize: '0.8rem' }}>{hs.text || '(tanpa label)'}</span>
                          </div>
                          <span style={{ color: '#0095e8', fontSize: '0.68rem' }}>pitch: {hs.pitch} | yaw: {hs.yaw}</span>
                          {hs.type === 'scene' && <span style={{ color: '#0095e8', fontSize: '0.68rem' }}>menuju Panorama ID: {hs.target_panorama_id}</span>}
                        </div>
                        <button className="btn btn-danger" onClick={() => handleDeleteHotspot(hs.id)}>Hapus</button>
                      </div>
                    ))}
                  </div>}
              </div>
            </>}
        </>
      )}
    </>
  );
}