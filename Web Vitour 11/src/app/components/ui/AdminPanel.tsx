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
  // Normalize to [0, 1]
  const nx = clickX / imgWidth;
  const ny = clickY / imgHeight;
  // Equirectangular: x maps to yaw [-180, 180], y maps to pitch [90, -90]
  const yaw = nx * 360 - 180;
  const pitch = 90 - ny * 180;
  return {
    pitch: Math.round(pitch * 10) / 10,
    yaw: Math.round(yaw * 10) / 10,
  };
}

export default function AdminPanel() {
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
  const [activeTab, setActiveTab] = useState<'panoramas' | 'hotspots'>('panoramas');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [clickMarker, setClickMarker] = useState<{ x: number; y: number } | null>(null);

  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/api/locations`)
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) {
          setLocationId(data[0].id);
        } else {
          showToast('No location found in database!', 'error');
        }
      });
  }, []);

  useEffect(() => { if (locationId) fetchPanoramas(locationId); }, [locationId]);
  useEffect(() => {
    if (selectedPanorama) {
      fetchHotspots(selectedPanorama.id);
      // Reset click state when panorama changes
      setClickMarker(null);
      setHsPitch('');
      setHsYaw('');
    }
  }, [selectedPanorama]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const createDefaultLocation = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Tour', description: 'My first tour location' }),
      });
      const loc = await res.json();
      setLocationId(loc.id);
      showToast('Location created!');
    } catch { showToast('Failed to create location', 'error'); }
  };

  const fetchPanoramas = async (id: number) => {
    try { setPanoramas(await getPanoramas(id)); }
    catch { showToast('Failed to fetch panoramas', 'error'); }
  };

  const fetchHotspots = async (panorama_id: number) => {
    try {
      const res = await fetch(`${BASE_URL}/api/hotspots?panorama_id=${panorama_id}`);
      setHotspots(await res.json());
    } catch { showToast('Failed to fetch hotspots', 'error'); }
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
    if (!imageFile) { showToast('Please select an image', 'error'); return; }
    if (!locationId) { showToast('No location found — create one first', 'error'); return; }
    setLoading(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('panoramas')
        .upload(fileName, imageFile, { contentType: imageFile.type });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('panoramas')
        .getPublicUrl(fileName);

      await createPanorama({
        location_id: locationId,
        title: panoramaTitle,
        image_url: publicUrl,
      });
      setPanoramaTitle(''); setImageFile(null);
      fetchPanoramas(locationId); showToast('Panorama uploaded!');
    } catch { showToast('Failed to upload panorama', 'error'); }
    setLoading(false);
  };

  const handleDeletePanorama = async (id: number) => {
    try {
      await deletePanorama(id);
      if (selectedPanorama?.id === id) { setSelectedPanorama(null); setHotspots([]); }
      if (locationId) fetchPanoramas(locationId);
      showToast('Panorama deleted!');
    } catch { showToast('Failed to delete panorama', 'error'); }
  };

  const handleSetFirstScene = async (id: number) => {
    try {
      for (const pan of panoramas) {
        await fetch(`${BASE_URL}/api/panoramas/${pan.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...pan, is_first_scene: pan.id === id }),
        });
      }
      if (locationId) fetchPanoramas(locationId);
      showToast('First scene updated!');
    } catch { showToast('Failed to set first scene', 'error'); }
  };

  const handleAddHotspot = async () => {
    if (!selectedPanorama || !hsPitch || !hsYaw) return;
    setLoading(true);
    try {
      await fetch(`${BASE_URL}/api/hotspots`, {
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
      setHsPitch(''); setHsYaw(''); setHsText(''); setHsTargetId('');
      setClickMarker(null);
      fetchHotspots(selectedPanorama.id); showToast('Hotspot added!');
    } catch { showToast('Failed to add hotspot', 'error'); }
    setLoading(false);
  };

  const handleDeleteHotspot = async (id: number) => {
    try {
      await fetch(`${BASE_URL}/api/hotspots/${id}`, { method: 'DELETE' });
      if (selectedPanorama) fetchHotspots(selectedPanorama.id);
      showToast('Hotspot deleted!');
    } catch { showToast('Failed to delete hotspot', 'error'); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e8e6e0', fontFamily: "'DM Mono', 'Courier New', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500& family=Playfair+Display:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0a0f; }
        ::-webkit-scrollbar-thumb { background: #3a6b5a; border-radius: 2px; }
        .panel-header { background: linear-gradient(135deg, #0d1f1a 0%, #0a0a0f 100%); border-bottom: 1px solid #1e3d32; padding: 1.5rem 2.5rem; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
        .logo { font-family: 'Playfair Display', serif; font-size: 1.6rem; font-weight: 900; background: linear-gradient(135deg, #4d9e7f, #a8d5be); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .logo span { font-weight: 300; font-size: 0.9rem; display: block; background: #6b8f82; -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 0.15em; text-transform: uppercase; font-family: 'DM Mono', monospace; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #4d9e7f; display: inline-block; margin-right: 0.5rem; box-shadow: 0 0 8px #4d9e7f; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .status-text { font-size: 0.75rem; color: #4d9e7f; letter-spacing: 0.1em; }
        .main-layout { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - 70px); }
        .sidebar { background: #0d1a16; border-right: 1px solid #1e3d32; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .sidebar-label { font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: #3a6b5a; padding: 0.5rem 0.75rem; margin-top: 0.5rem; }
        .nav-btn { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 8px; border: none; background: transparent; color: #7a9e90; font-family: 'DM Mono', monospace; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; }
        .nav-btn:hover { background: #1a3028; color: #a8d5be; }
        .nav-btn.active { background: #1e3d32; color: #4d9e7f; border-left: 2px solid #4d9e7f; }
        .nav-icon { font-size: 1rem; width: 20px; text-align: center; }
        .content { padding: 2rem 2.5rem; overflow-y: auto; }
        .section-title { font-family: 'Playfair Display', serif; font-size: 1.8rem; font-weight: 700; color: #e8e6e0; margin-bottom: 0.25rem; }
        .section-sub { font-size: 0.75rem; color: #4a7a68; letter-spacing: 0.1em; margin-bottom: 2rem; }
        .card { background: #0d1a16; border: 1px solid #1e3d32; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
        .card-title { font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; color: #4d9e7f; margin-bottom: 1rem; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.5rem; }
        .form-label { font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: #4a7a68; }
        .form-input { background: #0a0a0f; border: 1px solid #1e3d32; border-radius: 8px; padding: 0.65rem 1rem; color: #e8e6e0; font-family: 'DM Mono', monospace; font-size: 0.85rem; outline: none; transition: border-color 0.2s; width: 100%; }
        .form-input:focus { border-color: #4d9e7f; }
        .form-input::placeholder { color: #2a5040; }
        select.form-input option { background: #0a0a0f; }
        .file-input-wrapper { position: relative; background: #0a0a0f; border: 1px dashed #1e3d32; border-radius: 8px; padding: 1rem; text-align: center; cursor: pointer; transition: border-color 0.2s; }
        .file-input-wrapper:hover { border-color: #4d9e7f; }
        .file-input-wrapper input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .file-label { font-size: 0.8rem; color: #4a7a68; }
        .file-label strong { color: #4d9e7f; }
        .btn { padding: 0.65rem 1.5rem; border-radius: 8px; border: none; font-family: 'DM Mono', monospace; font-size: 0.8rem; letter-spacing: 0.1em; cursor: pointer; transition: all 0.2s; }
        .btn-primary { background: #1e3d32; color: #4d9e7f; border: 1px solid #3a6b5a; }
        .btn-primary:hover { background: #2a5040; color: #a8d5be; }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-danger { background: transparent; color: #8b4444; border: 1px solid #4a2222; padding: 0.4rem 0.8rem; font-size: 0.75rem; }
        .btn-danger:hover { background: #2a1010; color: #c47070; border-color: #8b4444; }
        .btn-accent { background: transparent; color: #7a6a2a; border: 1px solid #4a3a10; padding: 0.4rem 0.8rem; font-size: 0.75rem; }
        .btn-accent:hover { background: #1a1500; color: #c4a840; border-color: #8b7030; }
        .btn-accent.on { background: #2a2000; color: #c4a840; border-color: #8b7030; }
        .first-badge { font-size: 0.65rem; background: #2a2000; color: #c4a840; padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 0.1em; }
        .panorama-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; margin-top: 1rem; }
        .panorama-card { background: #0a0a0f; border: 1px solid #1e3d32; border-radius: 10px; overflow: hidden; transition: border-color 0.2s; cursor: pointer; }
        .panorama-card:hover { border-color: #3a6b5a; }
        .panorama-card.selected { border-color: #4d9e7f; }
        .panorama-img { width: 100%; height: 130px; object-fit: cover; display: block; background: #0d1a16; }
        .panorama-info { padding: 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; flex-wrap: wrap; }
        .panorama-title { font-size: 0.8rem; color: #a8c8b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; }
        .hotspot-list { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem; }
        .hotspot-item { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #1e3d32; background: #0a0a0f; font-size: 0.8rem; }
        .hotspot-badge { font-size: 0.65rem; padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 0.1em; }
        .hotspot-badge.scene { background: #1e3d32; color: #4d9e7f; }
        .hotspot-badge.info { background: #1a1030; color: #9d7fd4; }
        .empty-state { text-align: center; padding: 3rem; color: #2a5040; font-size: 0.85rem; }
        .empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
        .toast { position: fixed; bottom: 2rem; right: 2rem; padding: 0.75rem 1.5rem; border-radius: 8px; font-size: 0.8rem; letter-spacing: 0.05em; z-index: 999; animation: slideUp 0.3s ease; }
        .toast.success { background: #1e3d32; color: #4d9e7f; border: 1px solid #3a6b5a; }
        .toast.error { background: #2a1010; color: #c47070; border: 1px solid #4a2222; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: #0d1a16; border: 1px solid #1e3d32; border-radius: 10px; padding: 1rem 1.25rem; }
        .stat-num { font-family: 'Playfair Display', serif; font-size: 2rem; color: #4d9e7f; font-weight: 700; }
        .stat-label { font-size: 0.7rem; color: #4a7a68; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 0.2rem; }
        .info-box { background: #0a0f1a; border: 1px solid #1e2d5a; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.75rem; color: #5a7ab8; margin-bottom: 1rem; line-height: 1.6; }

        /* Click-to-place image styles */
        .click-image-wrapper {
          position: relative;
          width: 100%;
          border-radius: 8px;
          overflow: hidden;
          cursor: crosshair;
          border: 1px solid #1e3d32;
          transition: border-color 0.2s;
          background: #0a0a0f;
          user-select: none;
        }
        .click-image-wrapper:hover { border-color: #4d9e7f; }
        .click-image-wrapper img {
          width: 100%;
          display: block;
          pointer-events: none;
        }
        .click-image-wrapper .crosshair-label {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          pointer-events: none;
          transition: opacity 0.2s;
        }
        .click-image-wrapper:hover .crosshair-label { opacity: 0; }
        .click-marker {
          position: absolute;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 10;
        }
        .click-marker-ring {
          width: 28px;
          height: 28px;
          border: 2px solid #4d9e7f;
          border-radius: 50%;
          animation: markerPop 0.2s ease;
        }
        .click-marker-dot {
          width: 6px;
          height: 6px;
          background: #4d9e7f;
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        @keyframes markerPop {
          from { transform: scale(0.4); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .coord-readout {
          display: flex;
          gap: 1rem;
          margin-top: 0.75rem;
          padding: 0.65rem 1rem;
          background: #0a0a0f;
          border: 1px solid #1e3d32;
          border-radius: 8px;
          font-size: 0.8rem;
          align-items: center;
        }
        .coord-readout .coord-empty {
          color: #2a5040;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }
        .coord-pill {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .coord-pill .coord-key {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: #3a6b5a;
        }
        .coord-pill .coord-val {
          color: #a8d5be;
          font-size: 0.85rem;
        }
        .coord-divider {
          width: 1px;
          height: 14px;
          background: #1e3d32;
        }
      `}</style>

      {/* Header */}
      <header className="panel-header">
        <div className="logo">ViTour <span>Admin Console</span></div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="status-dot" />
          <span className="status-text">ONLINE</span>
        </div>
      </header>

      <div className="main-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-label">Navigation</div>
          <button className={`nav-btn ${activeTab === 'panoramas' ? 'active' : ''}`} onClick={() => setActiveTab('panoramas')}>
            <span className="nav-icon">🌐</span> Panoramas
          </button>
          <button className={`nav-btn ${activeTab === 'hotspots' ? 'active' : ''}`} onClick={() => setActiveTab('hotspots')}>
            <span className="nav-icon">🎯</span> Hotspots
          </button>

          <div className="sidebar-label" style={{ marginTop: '2rem' }}>Selected Panorama</div>
          {selectedPanorama
            ? <div style={{ padding: '0.5rem 1rem', background: '#1a1e3d', borderRadius: '8px', fontSize: '0.8rem', color: '#a8b8d5' }}>🌐 {selectedPanorama.title || `ID: ${selectedPanorama.id}`}</div>
            : <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: '#2a5040' }}>None selected</div>}
        </aside>

        <main className="content">
          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card"><div className="stat-num">{panoramas.length}</div><div className="stat-label">Panoramas</div></div>
            <div className="stat-card"><div className="stat-num">{hotspots.length}</div><div className="stat-label">Hotspots</div></div>
            <div className="stat-card"><div className="stat-num">{panoramas.filter((p: any) => p.is_first_scene).length > 0 ? '✓' : '—'}</div><div className="stat-label">First Scene</div></div>
          </div>
          {!locationId && (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="empty-icon" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📍</div>
              <p style={{ color: '#4a7a68', marginBottom: '1rem' }}>No locations yet. Create one to start adding panoramas.</p>
              <button className="btn btn-primary" onClick={createDefaultLocation}>+ Create Location</button>
            </div>
          )}

          {/* ── PANORAMAS TAB ── */}
          {activeTab === 'panoramas' && (
            <>
              <div className="section-title">Panoramas</div>
              <div className="section-sub">MANAGE 360° SCENES</div>

              <div className="info-box">
                💡 Upload your 360° equirectangular images here. Click <strong style={{ color: '#c4a840' }}>☆ Set First</strong> on the scene where the tour should start. Click a panorama card to add hotspots to it.
              </div>

              <div className="card">
                <div className="card-title">// Upload New Panorama</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <input className="form-input" placeholder="Scene title..." value={panoramaTitle} onChange={e => setPanoramaTitle(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">360° Image</label>
                    <div className="file-input-wrapper">
                      <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                      <div className="file-label">{imageFile ? <strong>{imageFile.name}</strong> : <><strong>Choose file</strong> or drag here</>}</div>
                    </div>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={handleAddPanorama} disabled={loading || !imageFile}>
                  {loading ? 'Uploading...' : '↑ Upload Panorama'}
                </button>
              </div>

              <div className="card">
                <div className="card-title">// All Panoramas ({panoramas.length}) — click a card to edit hotspots</div>
                {panoramas.length === 0
                  ? <div className="empty-state"><div className="empty-icon">🌐</div>No panoramas yet. Upload one above!</div>
                  : <div className="panorama-grid">
                    {panoramas.map((pan: any) => (
                      <div key={pan.id} className={`panorama-card ${selectedPanorama?.id === pan.id ? 'selected' : ''}`}
                        onClick={() => { setSelectedPanorama(pan); setActiveTab('hotspots'); }}>
                        <img className="panorama-img" src={pan.image_url} alt={pan.title}
                          onError={(e: any) => { e.target.src = ''; e.target.style.background = '#1e3d32'; }} />
                        <div className="panorama-info">
                          <span className="panorama-title">{pan.title || 'Untitled'}</span>
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {pan.is_first_scene ? <span className="first-badge">FIRST</span> : null}
                            <button className={`btn btn-accent ${pan.is_first_scene ? 'on' : ''}`}
                              onClick={e => { e.stopPropagation(); handleSetFirstScene(pan.id); }}>
                              {pan.is_first_scene ? '★ First' : '☆ Set First'}
                            </button>
                            <button className="btn btn-danger" onClick={e => { e.stopPropagation(); handleDeletePanorama(pan.id); }}>Del</button>
                          </div>
                        </div>
                        <div style={{ padding: '0 0.75rem 0.5rem', fontSize: '0.65rem', color: '#3a6b5a' }}>ID: {pan.id}</div>
                      </div>
                    ))}
                  </div>}
              </div>
            </>
          )}

          {/* ── HOTSPOTS TAB ── */}
          {activeTab === 'hotspots' && (
            <>
              <div className="section-title">Hotspots</div>
              <div className="section-sub">{selectedPanorama ? `EDITING: ${selectedPanorama.title || `Panorama #${selectedPanorama.id}`}` : 'SELECT A PANORAMA FIRST'}</div>

              {!selectedPanorama
                ? <div className="card"><div className="empty-state"><div className="empty-icon">🎯</div>Go to Panoramas tab and click a panorama card to edit its hotspots.</div></div>
                : <>
                  <div className="card">
                    <div className="card-title">// Step 1 — Click on the image to place a hotspot</div>
                    <div
                      className="click-image-wrapper"
                      ref={imageRef}
                      onClick={handleImageClick}
                    >
                      <img
                        src={selectedPanorama.image_url}
                        alt={selectedPanorama.title}
                        draggable={false}
                        onError={(e: any) => { e.target.style.display = 'none'; }}
                      />
                      {!clickMarker && (
                        <div className="crosshair-label">Click to place hotspot</div>
                      )}
                      {clickMarker && (
                        <div
                          className="click-marker"
                          style={{ left: `${clickMarker.x}%`, top: `${clickMarker.y}%` }}
                        >
                          <div className="click-marker-ring">
                            <div className="click-marker-dot" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Coordinate readout */}
                    <div className="coord-readout">
                      {!clickMarker ? (
                        <span className="coord-empty">↑ Click anywhere on the panorama above to set coordinates</span>
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
                            <button
                              className="btn btn-danger"
                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.7rem' }}
                              onClick={() => { setClickMarker(null); setHsPitch(''); setHsYaw(''); }}
                            >
                              Clear
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-title">// Step 2 — Configure and save the hotspot</div>

                    <div className="info-box" style={{ marginBottom: '1rem' }}>
                      💡 For <strong>scene</strong> type, pick the target panorama from the dropdown. For <strong>info</strong> type, just add a label text.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
                      <div className="form-group">
                        <label className="form-label">Type</label>
                        <select className="form-input" value={hsType} onChange={e => setHsType(e.target.value as 'scene' | 'info')}>
                          <option value="scene">scene (link)</option>
                          <option value="info">info (text)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Label Text</label>
                        <input className="form-input" placeholder="e.g. Go to Lobby" value={hsText} onChange={e => setHsText(e.target.value)} />
                      </div>
                    </div>

                    {hsType === 'scene' && (
                      <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Target Panorama (links to)</label>
                        <select className="form-input" value={hsTargetId} onChange={e => setHsTargetId(e.target.value)}>
                          <option value="">Select target panorama...</option>
                          {panoramas.filter(p => p.id !== selectedPanorama.id).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.title || `Panorama #${p.id}`} (ID: {p.id})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '0.5rem' }}
                      onClick={handleAddHotspot}
                      disabled={loading || !hsPitch || !hsYaw}
                    >
                      {loading ? 'Adding...' : !hsPitch ? '↑ Click image first to set position' : '+ Add Hotspot'}
                    </button>
                  </div>

                  <div className="card">
                    <div className="card-title">// Hotspots ({hotspots.length})</div>
                    {hotspots.length === 0
                      ? <div className="empty-state"><div className="empty-icon">🎯</div>No hotspots yet. Click the image above to place one!</div>
                      : <div className="hotspot-list">
                        {hotspots.map((hs: any) => (
                          <div key={hs.id} className="hotspot-item">
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span className={`hotspot-badge ${hs.type}`}>{hs.type.toUpperCase()}</span>
                              <span style={{ color: '#c8d8d0' }}>{hs.text || '(no label)'}</span>
                              <span style={{ color: '#3a6b5a', fontSize: '0.7rem' }}>pitch: {hs.pitch} | yaw: {hs.yaw}</span>
                              {hs.type === 'scene' && <span style={{ color: '#4a7a68', fontSize: '0.7rem' }}>→ Panorama ID: {hs.target_panorama_id}</span>}
                            </div>
                            <button className="btn btn-danger" onClick={() => handleDeleteHotspot(hs.id)}>Delete</button>
                          </div>
                        ))}
                      </div>}
                  </div>
                </>}
            </>
          )}
        </main>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}