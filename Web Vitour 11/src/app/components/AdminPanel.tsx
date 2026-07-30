import { useState, useEffect, useRef } from 'react';
import { createPanorama, getPanoramas, deletePanorama } from '../../services/api';
import { supabase } from '../../services/supabase';
import type { Session } from '@supabase/supabase-js';
import Login from './Login';

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

export default function AdminPanel() {
  // ── AUTH STATE ──
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const imageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastCheckRef = useRef<number>(0);

  // ── AUTH: check session on mount + listen for changes ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // ── LIVE SESSION CHECK: detect if this user's account was deleted/disabled server-side ──
  // getSession() only reads the locally cached token and won't notice a deleted account
  // until it naturally expires. getUser() actually validates against Supabase's servers.
  const validateSession = async (source: string = 'interval') => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      console.warn(`[validateSession:${source}] Account no longer valid, logging out.`, error);
      await supabase.auth.signOut();
      setSession(null);
      showToast('Your session has ended — account no longer exists or was signed out.', 'error');
    }
  };

  useEffect(() => {
    if (!session) return;

    // Check immediately, then poll every 30 seconds
    validateSession('interval');
    const intervalId = setInterval(() => validateSession('interval'), 30000);

    // Also re-check whenever the tab regains focus / becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') validateSession('visibility');
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [session]);

  // Runs a (throttled) session check on every click inside the admin panel,
  // so a deleted/invalidated account gets caught as soon as the user tries to do anything.
  const handleAdminPanelClick = () => {
    if (!session) return;
    const now = Date.now();
    if (now - lastCheckRef.current < 3000) return; // throttle: skip if checked <3s ago
    lastCheckRef.current = now;
    validateSession('click');
  };

  useEffect(() => {
    if (!session) return;
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
          showToast('No location found in database!', 'error');
        }
      })
      .catch(err => {
        console.error('[fetchLocations] FULL ERROR:', err);
        showToast(`Failed to fetch locations: ${err.message}`, 'error');
      });
  }, [session]);

  useEffect(() => { if (locationId) fetchPanoramas(locationId); }, [locationId]);
  useEffect(() => {
    if (selectedPanorama) {
      fetchHotspots(selectedPanorama.id);
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
      if (!res.ok) throw new Error(`Create location failed: ${res.status} ${res.statusText}`);
      const loc = await res.json();
      setLocationId(loc.id);
      showToast('Location created!');
    } catch (err: any) {
      console.error('[createDefaultLocation] FULL ERROR:', err);
      showToast(`Failed to create location: ${err.message}`, 'error');
    }
  };

  const fetchPanoramas = async (id: number) => {
    try {
      setPanoramas(await getPanoramas(id));
    } catch (err: any) {
      console.error('[fetchPanoramas] FULL ERROR:', err);
      showToast(`Failed to fetch panoramas: ${err.message}`, 'error');
    }
  };

  const fetchHotspots = async (panorama_id: number) => {
    try {
      const res = await fetch(`${BASE_URL}/api/hotspots?panorama_id=${panorama_id}`);
      if (!res.ok) throw new Error(`Hotspots fetch failed: ${res.status} ${res.statusText}`);
      setHotspots(await res.json());
    } catch (err: any) {
      console.error('[fetchHotspots] FULL ERROR:', err);
      showToast(`Failed to fetch hotspots: ${err.message}`, 'error');
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
    if (!imageFile) { showToast('Please select an image', 'error'); return; }
    if (!locationId) { showToast('No location found — create one first', 'error'); return; }
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
      showToast('Panorama uploaded!');
    } catch (err: any) {
      console.error('[handleAddPanorama] FULL ERROR:', err);
      showToast(`Failed to upload panorama: ${err.message || err}`, 'error');
    }
    setLoading(false);
  };

  const handleDeletePanorama = async (id: number) => {
    try {
      const panoToDelete = panoramas.find((p: any) => p.id === id);

      // 1) Delete the image file from Supabase Storage
      if (panoToDelete?.image_url) {
        try {
          // Extract the storage file path from the public URL
          // e.g. https://<project>.supabase.co/storage/v1/object/public/panoramas/169999-abc.jpg
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
              // Don't throw here — still proceed to delete DB records even if the file is already gone
            }
          } else {
            console.warn('[handleDeletePanorama] could not parse file path from image_url:', panoToDelete.image_url);
          }
        } catch (storageErr) {
          console.error('[handleDeletePanorama] storage cleanup failed:', storageErr);
        }
      }

      // 2) Delete this panorama's own hotspots
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

      // 3) Delete any hotspots on OTHER panoramas that target this one (avoid dangling links)
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

      // 4) Finally, delete the panorama record itself
      await deletePanorama(id);

      if (selectedPanorama?.id === id) { setSelectedPanorama(null); setHotspots([]); }
      if (locationId) fetchPanoramas(locationId);
      showToast('Panorama, image, and related hotspots deleted!');
    } catch (err: any) {
      console.error('[handleDeletePanorama] FULL ERROR:', err);
      showToast(`Failed to delete panorama: ${err.message}`, 'error');
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
      showToast('First scene updated!');
    } catch (err: any) {
      console.error('[handleSetFirstScene] FULL ERROR:', err);
      showToast(`Failed to set first scene: ${err.message}`, 'error');
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
      showToast('Hotspot added!');
    } catch (err: any) {
      console.error('[handleAddHotspot] FULL ERROR:', err);
      showToast(`Failed to add hotspot: ${err.message}`, 'error');
    }
    setLoading(false);
  };

  const handleDeleteHotspot = async (id: number) => {
    try {
      const res = await fetch(`${BASE_URL}/api/hotspots/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete hotspot failed: ${res.status} ${res.statusText}`);
      if (selectedPanorama) fetchHotspots(selectedPanorama.id);
      showToast('Hotspot deleted!');
    } catch (err: any) {
      console.error('[handleDeleteHotspot] FULL ERROR:', err);
      showToast(`Failed to delete hotspot: ${err.message}`, 'error');
    }
  };

  // ── AUTH GATES ──
  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0f', color: '#4d9e7f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Mono', 'Courier New', monospace", fontSize: '0.85rem', letterSpacing: '0.1em',
      }}>
        LOADING...
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={() => { /* session updates via onAuthStateChange */ }} />;
  }

  return (
    <div onClick={handleAdminPanelClick} style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e8e6e0', fontFamily: "'DM Mono', 'Courier New', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0a0f; }
        ::-webkit-scrollbar-thumb { background: #3a6b5a; border-radius: 2px; }

        .panel-header {
          background: linear-gradient(135deg, #0d1f1a 0%, #0a0a0f 100%);
          border-bottom: 1px solid #1e3d32;
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .logo { font-family: 'Playfair Display', serif; font-size: 1.4rem; font-weight: 900; background: linear-gradient(135deg, #4d9e7f, #a8d5be); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .logo span { font-weight: 300; font-size: 0.75rem; display: block; background: #6b8f82; -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 0.15em; text-transform: uppercase; font-family: 'DM Mono', monospace; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #4d9e7f; display: inline-block; margin-right: 0.5rem; box-shadow: 0 0 8px #4d9e7f; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .status-text { font-size: 0.7rem; color: #4d9e7f; letter-spacing: 0.1em; }
        .logout-btn { background: transparent; border: 1px solid #1e3d32; color: #4a7a68; font-family: 'DM Mono', monospace; font-size: 0.68rem; letter-spacing: 0.08em; padding: 0.4rem 0.7rem; border-radius: 6px; cursor: pointer; margin-left: 0.75rem; transition: all 0.2s; }
        .logout-btn:hover { border-color: #8b4444; color: #c47070; }

        /* hamburger */
        .hamburger {
          display: none;
          flex-direction: column;
          gap: 5px;
          cursor: pointer;
          padding: 4px;
          background: transparent;
          border: none;
        }
        .hamburger span {
          display: block;
          width: 22px;
          height: 2px;
          background: #4d9e7f;
          border-radius: 2px;
          transition: all 0.2s;
        }

        /* layout */
        .main-layout { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - 60px); }

        /* sidebar */
        .sidebar {
          background: #0d1a16;
          border-right: 1px solid #1e3d32;
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .sidebar-label { font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: #3a6b5a; padding: 0.5rem 0.75rem; margin-top: 0.5rem; }
        .nav-btn { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 8px; border: none; background: transparent; color: #7a9e90; font-family: 'DM Mono', monospace; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; }
        .nav-btn:hover { background: #1a3028; color: #a8d5be; }
        .nav-btn.active { background: #1e3d32; color: #4d9e7f; border-left: 2px solid #4d9e7f; }
        .nav-icon { font-size: 1rem; width: 20px; text-align: center; }

        /* content */
        .content { padding: 1.5rem; overflow-y: auto; }

        .section-title { font-family: 'Playfair Display', serif; font-size: 1.6rem; font-weight: 700; color: #e8e6e0; margin-bottom: 0.25rem; }
        .section-sub { font-size: 0.7rem; color: #4a7a68; letter-spacing: 0.1em; margin-bottom: 1.5rem; }

        .card { background: #0d1a16; border: 1px solid #1e3d32; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem; }
        .card-title { font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: #4d9e7f; margin-bottom: 1rem; }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.5rem; }
        .form-label { font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; color: #4a7a68; }
        .form-input { background: #0a0a0f; border: 1px solid #1e3d32; border-radius: 8px; padding: 0.65rem 1rem; color: #e8e6e0; font-family: 'DM Mono', monospace; font-size: 0.85rem; outline: none; transition: border-color 0.2s; width: 100%; }
        .form-input:focus { border-color: #4d9e7f; }
        .form-input::placeholder { color: #2a5040; }
        select.form-input option { background: #0a0a0f; }

        .file-input-wrapper { position: relative; background: #0a0a0f; border: 1px dashed #1e3d32; border-radius: 8px; padding: 1rem; text-align: center; cursor: pointer; transition: border-color 0.2s; }
        .file-input-wrapper:hover { border-color: #4d9e7f; }
        .file-input-wrapper input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .file-label { font-size: 0.8rem; color: #4a7a68; }
        .file-label strong { color: #4d9e7f; }

        .btn { padding: 0.65rem 1.25rem; border-radius: 8px; border: none; font-family: 'DM Mono', monospace; font-size: 0.78rem; letter-spacing: 0.08em; cursor: pointer; transition: all 0.2s; }
        .btn-primary { background: #1e3d32; color: #4d9e7f; border: 1px solid #3a6b5a; }
        .btn-primary:hover { background: #2a5040; color: #a8d5be; }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-danger { background: transparent; color: #8b4444; border: 1px solid #4a2222; padding: 0.4rem 0.7rem; font-size: 0.72rem; }
        .btn-danger:hover { background: #2a1010; color: #c47070; border-color: #8b4444; }
        .btn-accent { background: transparent; color: #7a6a2a; border: 1px solid #4a3a10; padding: 0.4rem 0.7rem; font-size: 0.72rem; }
        .btn-accent:hover { background: #1a1500; color: #c4a840; border-color: #8b7030; }
        .btn-accent.on { background: #2a2000; color: #c4a840; border-color: #8b7030; }
        .first-badge { font-size: 0.62rem; background: #2a2000; color: #c4a840; padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 0.1em; }

        .panorama-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem; }
        .panorama-card { background: #0a0a0f; border: 1px solid #1e3d32; border-radius: 10px; overflow: hidden; transition: border-color 0.2s; cursor: pointer; }
        .panorama-card:hover { border-color: #3a6b5a; }
        .panorama-card.selected { border-color: #4d9e7f; }
        .panorama-img { width: 100%; height: 120px; object-fit: cover; display: block; background: #0d1a16; }
        .panorama-info { padding: 0.65rem 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; flex-wrap: wrap; }
        .panorama-title { font-size: 0.78rem; color: #a8c8b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; }

        .hotspot-list { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem; }
        .hotspot-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; padding: 0.75rem; border-radius: 8px; border: 1px solid #1e3d32; background: #0a0a0f; font-size: 0.78rem; }
        .hotspot-item-info { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 0; }
        .hotspot-badge { font-size: 0.62rem; padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 0.1em; display: inline-block; }
        .hotspot-badge.scene { background: #1e3d32; color: #4d9e7f; }
        .hotspot-badge.info { background: #1a1030; color: #9d7fd4; }

        .empty-state { text-align: center; padding: 2.5rem 1rem; color: #2a5040; font-size: 0.82rem; }
        .empty-icon { font-size: 2rem; margin-bottom: 0.75rem; }

        .toast { position: fixed; bottom: 1.5rem; right: 1rem; left: 1rem; padding: 0.75rem 1.25rem; border-radius: 8px; font-size: 0.78rem; letter-spacing: 0.05em; z-index: 999; animation: slideUp 0.3s ease; text-align: center; }
        .toast.success { background: #1e3d32; color: #4d9e7f; border: 1px solid #3a6b5a; }
        .toast.error { background: #2a1010; color: #c47070; border: 1px solid #4a2222; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1.5rem; }
        .stat-card { background: #0d1a16; border: 1px solid #1e3d32; border-radius: 10px; padding: 0.85rem 1rem; }
        .stat-num { font-family: 'Playfair Display', serif; font-size: 1.6rem; color: #4d9e7f; font-weight: 700; }
        .stat-label { font-size: 0.62rem; color: #4a7a68; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 0.15rem; }

        .info-box { background: #0a0f1a; border: 1px solid #1e2d5a; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.73rem; color: #5a7ab8; margin-bottom: 1rem; line-height: 1.6; }

        /* click-to-place */
        .click-image-wrapper { position: relative; width: 100%; border-radius: 8px; overflow: hidden; cursor: crosshair; border: 1px solid #1e3d32; transition: border-color 0.2s; background: #0a0a0f; user-select: none; }
        .click-image-wrapper:hover { border-color: #4d9e7f; }
        .click-image-wrapper img { width: 100%; display: block; pointer-events: none; }
        .crosshair-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; color: rgba(255,255,255,0.35); letter-spacing: 0.15em; text-transform: uppercase; pointer-events: none; transition: opacity 0.2s; }
        .click-image-wrapper:hover .crosshair-label { opacity: 0; }
        .click-marker { position: absolute; transform: translate(-50%, -50%); pointer-events: none; z-index: 10; }
        .click-marker-ring { width: 28px; height: 28px; border: 2px solid #4d9e7f; border-radius: 50%; animation: markerPop 0.2s ease; }
        .click-marker-dot { width: 6px; height: 6px; background: #4d9e7f; border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
        @keyframes markerPop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .coord-readout { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.75rem; padding: 0.65rem 1rem; background: #0a0a0f; border: 1px solid #1e3d32; border-radius: 8px; font-size: 0.78rem; align-items: center; }
        .coord-empty { color: #2a5040; font-size: 0.72rem; letter-spacing: 0.05em; }
        .coord-pill { display: flex; align-items: center; gap: 0.5rem; }
        .coord-key { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.15em; color: #3a6b5a; }
        .coord-val { color: #a8d5be; font-size: 0.82rem; }
        .coord-divider { width: 1px; height: 14px; background: #1e3d32; }

        /* bottom tab bar for mobile */
        .bottom-tab-bar { display: none; }

        /* ── MOBILE ── */
        @media (max-width: 768px) {
          .hamburger { display: flex; }

          .main-layout { grid-template-columns: 1fr; }

          .sidebar {
            display: none;
            position: fixed;
            top: 60px;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 90;
            overflow-y: auto;
            padding: 1rem;
          }
          .sidebar.open { display: flex; }

          /* overlay when sidebar open */
          .sidebar-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            z-index: 89;
          }
          .sidebar-overlay.open { display: block; }

          .content { padding: 1rem; padding-bottom: 5rem; }

          .section-title { font-size: 1.3rem; }

          /* bottom nav bar */
          .bottom-tab-bar {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #0d1a16;
            border-top: 1px solid #1e3d32;
            z-index: 80;
          }
          .bottom-tab-btn {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 0.65rem 0.5rem;
            background: transparent;
            border: none;
            color: #4a7a68;
            font-family: 'DM Mono', monospace;
            font-size: 0.65rem;
            letter-spacing: 0.08em;
            cursor: pointer;
            transition: color 0.2s;
          }
          .bottom-tab-btn.active { color: #4d9e7f; border-top: 2px solid #4d9e7f; }
          .bottom-tab-icon { font-size: 1.2rem; }

          .form-row { grid-template-columns: 1fr; }

          .stats-row { gap: 0.5rem; }
          .stat-num { font-size: 1.3rem; }
          .stat-label { font-size: 0.58rem; }

          .panorama-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.75rem; }
          .panorama-img { height: 100px; }

          .hotspot-item { flex-direction: column; gap: 0.5rem; }

          .toast { left: 1rem; right: 1rem; bottom: 5rem; }
        }

        @media (max-width: 400px) {
          .panorama-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      {/* Header */}
      <header className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">
            <span /><span /><span />
          </button>
          <div className="logo">ViTour <span>Admin Console</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="status-dot" />
          <span className="status-text">ONLINE</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* Sidebar overlay (mobile) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="main-layout">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-label">Navigation</div>
          <button className={`nav-btn ${activeTab === 'panoramas' ? 'active' : ''}`} onClick={() => { setActiveTab('panoramas'); setSidebarOpen(false); }}>
            <span className="nav-icon">🌐</span> Panoramas
          </button>
          <button className={`nav-btn ${activeTab === 'hotspots' ? 'active' : ''}`} onClick={() => { setActiveTab('hotspots'); setSidebarOpen(false); }}>
            <span className="nav-icon">🎯</span> Hotspots
          </button>

          <div className="sidebar-label" style={{ marginTop: '2rem' }}>Selected Panorama</div>
          {selectedPanorama
            ? <div style={{ padding: '0.5rem 1rem', background: '#1a1e3d', borderRadius: '8px', fontSize: '0.78rem', color: '#a8b8d5' }}>🌐 {selectedPanorama.title || `ID: ${selectedPanorama.id}`}</div>
            : <div style={{ padding: '0.5rem 1rem', fontSize: '0.72rem', color: '#2a5040' }}>None selected</div>}
        </aside>

        <main className="content">
          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card"><div className="stat-num">{panoramas.length}</div><div className="stat-label">Panoramas</div></div>
            <div className="stat-card"><div className="stat-num">{hotspots.length}</div><div className="stat-label">Hotspots</div></div>
            <div className="stat-card"><div className="stat-num">{panoramas.filter((p: any) => p.is_first_scene).length > 0 ? '✓' : '—'}</div><div className="stat-label">First Scene</div></div>
          </div>

          {!locationId && (
            <div className="card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div className="empty-icon" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📍</div>
              <p style={{ color: '#4a7a68', marginBottom: '1rem', fontSize: '0.82rem' }}>No locations yet. Create one to start adding panoramas.</p>
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

                    {/* Ganti file-input-wrapper jadi begini */}
                    <div
                      className="file-input-wrapper"
                      onClick={() => fileInputRef.current?.click()}
                    >
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
                  {loading ? 'Uploading...' : '↑ Upload Panorama'}
                </button>
              </div>

              <div className="card">
                <div className="card-title">// All Panoramas ({panoramas.length}) — tap a card to edit hotspots</div>
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
                              {pan.is_first_scene ? '★' : '☆'}
                            </button>
                            <button className="btn btn-danger" onClick={e => { e.stopPropagation(); handleDeletePanorama(pan.id); }}>Del</button>
                          </div>
                        </div>
                        <div style={{ padding: '0 0.75rem 0.5rem', fontSize: '0.62rem', color: '#3a6b5a' }}>ID: {pan.id}</div>
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
                ? <div className="card"><div className="empty-state"><div className="empty-icon">🎯</div>Go to Panoramas tab and tap a panorama card to edit its hotspots.</div></div>
                : <>
                  <div className="card">
                    <div className="card-title">// Step 1 — Tap on the image to place a hotspot</div>
                    <div className="click-image-wrapper" ref={imageRef} onClick={handleImageClick}>
                      <img src={selectedPanorama.image_url} alt={selectedPanorama.title} draggable={false}
                        onError={(e: any) => { e.target.style.display = 'none'; }} />
                      {!clickMarker && <div className="crosshair-label">Tap to place hotspot</div>}
                      {clickMarker && (
                        <div className="click-marker" style={{ left: `${clickMarker.x}%`, top: `${clickMarker.y}%` }}>
                          <div className="click-marker-ring"><div className="click-marker-dot" /></div>
                        </div>
                      )}
                    </div>

                    <div className="coord-readout">
                      {!clickMarker ? (
                        <span className="coord-empty">↑ Tap anywhere on the panorama to set coordinates</span>
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
                              Clear
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-title">// Step 2 — Configure and save the hotspot</div>
                    <div className="info-box">
                      💡 For <strong>scene</strong> type, pick the target panorama from the dropdown. For <strong>info</strong> type, just add a label text.
                    </div>

                    <div className="form-row" style={{ marginBottom: '0.5rem' }}>
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

                    <button className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%' }}
                      onClick={handleAddHotspot} disabled={loading || !hsPitch || !hsYaw}>
                      {loading ? 'Adding...' : !hsPitch ? '↑ Tap image first to set position' : '+ Add Hotspot'}
                    </button>
                  </div>

                  <div className="card">
                    <div className="card-title">// Hotspots ({hotspots.length})</div>
                    {hotspots.length === 0
                      ? <div className="empty-state"><div className="empty-icon">🎯</div>No hotspots yet. Tap the image above to place one!</div>
                      : <div className="hotspot-list">
                        {hotspots.map((hs: any) => (
                          <div key={hs.id} className="hotspot-item">
                            <div className="hotspot-item-info">
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span className={`hotspot-badge ${hs.type}`}>{hs.type.toUpperCase()}</span>
                                <span style={{ color: '#c8d8d0', fontSize: '0.8rem' }}>{hs.text || '(no label)'}</span>
                              </div>
                              <span style={{ color: '#3a6b5a', fontSize: '0.68rem' }}>pitch: {hs.pitch} | yaw: {hs.yaw}</span>
                              {hs.type === 'scene' && <span style={{ color: '#4a7a68', fontSize: '0.68rem' }}>→ Panorama ID: {hs.target_panorama_id}</span>}
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

      {/* Bottom tab bar (mobile only) */}
      <nav className="bottom-tab-bar">
        <button className={`bottom-tab-btn ${activeTab === 'panoramas' ? 'active' : ''}`} onClick={() => setActiveTab('panoramas')}>
          <span className="bottom-tab-icon">🌐</span>
          Panoramas
        </button>
        <button className={`bottom-tab-btn ${activeTab === 'hotspots' ? 'active' : ''}`} onClick={() => setActiveTab('hotspots')}>
          <span className="bottom-tab-icon">🎯</span>
          Hotspots
        </button>
      </nav>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}