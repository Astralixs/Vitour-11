import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../services/supabase';
import type { Session } from '@supabase/supabase-js';
import Login from './Login';
import Panorama from './Panorama';
import Detail from './Detail';

export default function AdminPanel() {
  // ── AUTH STATE ──
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [activeTab, setActiveTab] = useState<'panoramas' | 'hotspots' | 'details'>('panoramas');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Label of the panorama currently selected inside <Panorama>, shown in the sidebar.
  const [selectedPanoramaLabel, setSelectedPanoramaLabel] = useState<string | null>(null);

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

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── LIVE SESSION CHECK: detect if this user's account was deleted/disabled server-side ──
  const validateSession = async (source: string = 'interval') => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      console.warn(`[validateSession:${source}] Account no longer valid, logging out.`, error);
      await supabase.auth.signOut();
      setSession(null);
      showToast('Sesi kamu telah berakhir — akun sudah tidak ada atau telah keluar.', 'error');
    }
  };

  useEffect(() => {
    if (!session) return;

    validateSession('interval');
    const intervalId = setInterval(() => validateSession('interval'), 30000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') validateSession('visibility');
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [session]);

  const handleAdminPanelClick = () => {
    if (!session) return;
    const now = Date.now();
    if (now - lastCheckRef.current < 3000) return;
    lastCheckRef.current = now;
    validateSession('click');
  };

  // ── AUTH GATES ──
  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a1420', color: '#00b8ff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Mono', 'Courier New', monospace", fontSize: '0.85rem', letterSpacing: '0.1em',
      }}>
        MEMUAT...
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={() => { /* session updates via onAuthStateChange */ }} />;
  }

  return (
    <div onClick={handleAdminPanelClick} style={{ minHeight: '100vh', background: '#0a1420', color: '#e8e6e0', fontFamily: "'DM Mono', 'Courier New', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button, input, select, textarea, a, div[tabindex] { outline: none; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a1420; }
        ::-webkit-scrollbar-thumb { background: #0095e8; border-radius: 2px; }

        .panel-header {
          background: linear-gradient(135deg, #152538 0%, #0a1420 100%);
          border-bottom: 1px solid #0077cc;
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .logo { font-family: 'Playfair Display', serif; font-size: 1.4rem; font-weight: 900; background: linear-gradient(135deg, #00b8ff, #a0e0ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .logo span { font-weight: 300; font-size: 0.75rem; display: block; background: #5dd0ff; -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 0.15em; text-transform: uppercase; font-family: 'DM Mono', monospace; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #00b8ff; display: inline-block; margin-right: 0.5rem; box-shadow: 0 0 8px #00b8ff; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .status-text { font-size: 0.7rem; color: #00b8ff; letter-spacing: 0.1em; }
        .logout-btn { background: transparent; border: 1px solid #0077cc; color: #0095e8; font-family: 'DM Mono', monospace; font-size: 0.68rem; letter-spacing: 0.08em; padding: 0.4rem 0.7rem; border-radius: 6px; cursor: pointer; margin-left: 0.75rem; transition: all 0.2s; }
        .logout-btn:hover { border-color: #8b4444; color: #c47070; }

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
          background: #00b8ff;
          border-radius: 2px;
          transition: all 0.2s;
        }

        .main-layout { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - 60px); }

        .sidebar {
          background: #0d1b2e;
          border-right: 1px solid #0077cc;
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .sidebar-divider { border: none; border-top: 1px solid #0077cc; margin: 1.25rem 0.25rem; }
        .sidebar-label { font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: #0095e8; padding: 0.5rem 0.75rem; margin-top: 0.5rem; }
        .nav-btn { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 8px; border: none; background: transparent; color: #5dd0ff; font-family: 'DM Mono', monospace; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; }
        .nav-btn:hover { background: #0369a1; color: #a0e0ff; }
        .nav-btn.active { background: #0077cc; color: #00b8ff; border-left: 2px solid #00b8ff; }

        .content { padding: 1.5rem; overflow-y: auto; }

        .section-title { font-family: 'Playfair Display', serif; font-size: 1.6rem; font-weight: 700; color: #e8e6e0; margin-bottom: 0.25rem; }
        .section-sub { font-size: 0.7rem; color: #0095e8; letter-spacing: 0.1em; margin-bottom: 1.5rem; }

        .card { background: #0d1b2e; border: 1px solid #0077cc; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem; }
        .card-title { font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: #00b8ff; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.5rem; }
        .form-label { font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; color: #0095e8; }
        .form-input { background: #0a1420; border: 1px solid #0077cc; border-radius: 8px; padding: 0.65rem 1rem; color: #e8e6e0; font-family: 'DM Mono', monospace; font-size: 0.85rem; outline: none; transition: border-color 0.2s; width: 100%; }
        .form-input:focus { border-color: #00b8ff; }
        .form-input::placeholder { color: #075985; }
        select.form-input option { background: #0a1420; }
        textarea.form-input { resize: vertical; min-height: 80px; font-family: 'DM Mono', monospace; }

        .file-input-wrapper { position: relative; background: #0a1420; border: 1px dashed #0077cc; border-radius: 8px; padding: 1rem; text-align: center; cursor: pointer; transition: border-color 0.2s; }
        .file-input-wrapper:hover { border-color: #00b8ff; }
        .file-input-wrapper input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .file-label { font-size: 0.8rem; color: #0095e8; }
        .file-label strong { color: #00b8ff; }

        .btn { padding: 0.65rem 1.25rem; border-radius: 8px; border: none; font-family: 'DM Mono', monospace; font-size: 0.78rem; letter-spacing: 0.08em; cursor: pointer; transition: all 0.2s; }
        .btn-primary { background: #0077cc; color: #00b8ff; border: 1px solid #0095e8; }
        .btn-primary:hover { background: #075985; color: #a0e0ff; }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-secondary { background: transparent; color: #5dd0ff; border: 1px solid #0077cc; }
        .btn-secondary:hover { background: #0369a1; color: #a0e0ff; }
        .btn-danger { background: transparent; color: #8b4444; border: 1px solid #4a2222; padding: 0.4rem 0.7rem; font-size: 0.72rem; }
        .btn-danger:hover { background: #2a1010; color: #c47070; border-color: #8b4444; }
        .btn-accent { background: transparent; color: #7a6a2a; border: 1px solid #4a3a10; padding: 0.4rem 0.7rem; font-size: 0.72rem; }
        .btn-accent:hover { background: #1a1500; color: #c4a840; border-color: #8b7030; }
        .btn-accent.on { background: #2a2000; color: #c4a840; border-color: #8b7030; }
        .btn-edit { background: transparent; color: #4a6a9e; border: 1px solid #22344a; padding: 0.4rem 0.7rem; font-size: 0.72rem; }
        .btn-edit:hover { background: #101a2a; color: #7098c4; border-color: #4468a4; }
        .first-badge { font-size: 0.62rem; background: #2a2000; color: #c4a840; padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 0.1em; }
        .editing-badge { font-size: 0.62rem; background: #1a1030; color: #9d7fd4; padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 0.1em; }

        .panorama-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem; }
        .panorama-card { background: #0a1420; border: 1px solid #0077cc; border-radius: 10px; overflow: hidden; transition: border-color 0.2s; cursor: pointer; }
        .panorama-card:hover { border-color: #0095e8; }
        .panorama-card.selected { border-color: #00b8ff; }
        .panorama-img { width: 100%; height: 120px; object-fit: cover; display: block; background: #0d1b2e; }
        .panorama-info { padding: 0.65rem 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; flex-wrap: wrap; }
        .panorama-title { font-size: 0.78rem; color: #5dd0ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; }

        .hotspot-list { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem; }
        .hotspot-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; padding: 0.75rem; border-radius: 8px; border: 1px solid #0077cc; background: #0a1420; font-size: 0.78rem; }
        .hotspot-item-info { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 0; }
        .hotspot-badge { font-size: 0.62rem; padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 0.1em; display: inline-block; }
        .hotspot-badge.scene { background: #0077cc; color: #00b8ff; }
        .hotspot-badge.info { background: #1a1030; color: #9d7fd4; }
        .hotspot-badge.linked { background: #0077cc; color: #00b8ff; }
        .hotspot-badge.unlinked { background: #2a1010; color: #c47070; }

        .empty-state { text-align: center; padding: 2.5rem 1rem; color: #075985; font-size: 0.82rem; }

        .toast { position: fixed; bottom: 1.5rem; right: 1rem; left: 1rem; padding: 0.75rem 1.25rem; border-radius: 8px; font-size: 0.78rem; letter-spacing: 0.05em; z-index: 999; animation: slideUp 0.3s ease; text-align: center; }
        .toast.success { background: #0077cc; color: #00b8ff; border: 1px solid #0095e8; }
        .toast.error { background: #2a1010; color: #c47070; border: 1px solid #4a2222; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1.5rem; }
        .stat-card { background: #0d1b2e; border: 1px solid #0077cc; border-radius: 10px; padding: 0.85rem 1rem; }
        .stat-num { font-family: 'Playfair Display', serif; font-size: 1.6rem; color: #00b8ff; font-weight: 700; }
        .stat-label { font-size: 0.62rem; color: #0095e8; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 0.15rem; }

        .info-box { background: #0a0f1a; border: 1px solid #0077cc; border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.73rem; color: #00b8ff; margin-bottom: 1rem; line-height: 1.6; }

        .click-image-wrapper { position: relative; width: 100%; border-radius: 8px; overflow: hidden; cursor: crosshair; border: 1px solid #0077cc; transition: border-color 0.2s; background: #0a1420; user-select: none; }
        .click-image-wrapper:hover { border-color: #00b8ff; }
        .click-image-wrapper img { width: 100%; display: block; pointer-events: none; }
        .crosshair-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; color: rgba(255,255,255,0.35); letter-spacing: 0.15em; text-transform: uppercase; pointer-events: none; transition: opacity 0.2s; }
        .click-image-wrapper:hover .crosshair-label { opacity: 0; }
        .click-marker { position: absolute; transform: translate(-50%, -50%); pointer-events: none; z-index: 10; }
        .click-marker-ring { width: 28px; height: 28px; border: 2px solid #00b8ff; border-radius: 50%; animation: markerPop 0.2s ease; }
        .click-marker-dot { width: 6px; height: 6px; background: #00b8ff; border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
        @keyframes markerPop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        /* existing (already-saved) pins shown on the denah while placing/editing a new one */
        .existing-pin { position: absolute; transform: translate(-50%, -50%); z-index: 5; pointer-events: none; }
        .existing-pin-dot { width: 16px; height: 16px; border-radius: 50%; background: #c4a840; border: 2px solid #0a1420; box-shadow: 0 0 0 2px #c4a840; }

        .coord-readout { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.75rem; padding: 0.65rem 1rem; background: #0a1420; border: 1px solid #0077cc; border-radius: 8px; font-size: 0.78rem; align-items: center; }
        .coord-empty { color: #075985; font-size: 0.72rem; letter-spacing: 0.05em; }
        .coord-pill { display: flex; align-items: center; gap: 0.5rem; }
        .coord-key { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.15em; color: #0095e8; }
        .coord-val { color: #a0e0ff; font-size: 0.82rem; }
        .coord-divider { width: 1px; height: 14px; background: #0077cc; }

        .room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem; }
        .room-card { background: #0a1420; border: 1px solid #0077cc; border-radius: 10px; overflow: hidden; transition: border-color 0.2s; }
        .room-card:hover { border-color: #0095e8; }
        .room-card.editing { border-color: #4a6a9e; }
        .room-img { width: 100%; height: 120px; object-fit: cover; display: block; background: #0d1b2e; }
        .room-info { padding: 0.65rem 0.75rem; }
        .room-name { font-size: 0.82rem; color: #5dd0ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.3rem; }
        .room-meta { font-size: 0.65rem; color: #0095e8; margin-bottom: 0.5rem; }
        .room-desc { font-size: 0.7rem; color: #5dd0ff; line-height: 1.5; margin-bottom: 0.6rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .room-actions { display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; }

        .bottom-tab-bar { display: none; }

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

          .bottom-tab-bar {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #0d1b2e;
            border-top: 1px solid #0077cc;
            z-index: 80;
          }
          .bottom-tab-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.9rem 0.5rem;
            background: transparent;
            border: none;
            color: #0095e8;
            font-family: 'DM Mono', monospace;
            font-size: 0.7rem;
            letter-spacing: 0.08em;
            cursor: pointer;
            transition: color 0.2s;
          }
          .bottom-tab-btn.active { color: #00b8ff; border-top: 2px solid #00b8ff; }

          .form-row { grid-template-columns: 1fr; }
          .stats-row { gap: 0.5rem; }
          .stat-num { font-size: 1.3rem; }
          .stat-label { font-size: 0.58rem; }

          .panorama-grid, .room-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.75rem; }
          .panorama-img, .room-img { height: 100px; }

          .hotspot-item { flex-direction: column; gap: 0.5rem; }
          .toast { left: 1rem; right: 1rem; bottom: 5rem; }
        }

        @media (max-width: 400px) {
          .panorama-grid, .room-grid { grid-template-columns: 1fr 1fr; }
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
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="main-layout">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-label">Tour Virtual</div>
          <button className={`nav-btn ${activeTab === 'panoramas' ? 'active' : ''}`} onClick={() => { setActiveTab('panoramas'); setSidebarOpen(false); }}>
            Panorama
          </button>
          <button className={`nav-btn ${activeTab === 'hotspots' ? 'active' : ''}`} onClick={() => { setActiveTab('hotspots'); setSidebarOpen(false); }}>
            Hotspot
          </button>

          <div className="sidebar-label" style={{ marginTop: '2rem' }}>Panorama Terpilih</div>
          {selectedPanoramaLabel
            ? <div style={{ padding: '0.5rem 1rem', background: '#0c4a6e', borderRadius: '8px', fontSize: '0.78rem', color: '#5dd0ff' }}>{selectedPanoramaLabel}</div>
            : <div style={{ padding: '0.5rem 1rem', fontSize: '0.72rem', color: '#075985' }}>Belum dipilih</div>}

          <hr className="sidebar-divider" />

          <div className="sidebar-label">Detail</div>
          <button className={`nav-btn ${activeTab === 'details' ? 'active' : ''}`} onClick={() => { setActiveTab('details'); setSidebarOpen(false); }}>
            Detail Ruangan
          </button>
        </aside>

        <main className="content">
          {(activeTab === 'panoramas' || activeTab === 'hotspots') && (
            <Panorama
              view={activeTab}
              showToast={showToast}
              onRequestHotspotView={() => setActiveTab('hotspots')}
              onSelectedPanoramaChange={setSelectedPanoramaLabel}
            />
          )}

          {activeTab === 'details' && <Detail showToast={showToast} />}
        </main>
      </div>

      {/* Bottom tab bar (mobile only) */}
      <nav className="bottom-tab-bar">
        <button className={`bottom-tab-btn ${activeTab === 'panoramas' ? 'active' : ''}`} onClick={() => setActiveTab('panoramas')}>
          Panorama
        </button>
        <button className={`bottom-tab-btn ${activeTab === 'hotspots' ? 'active' : ''}`} onClick={() => setActiveTab('hotspots')}>
          Hotspot
        </button>
        <button className={`bottom-tab-btn ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>
          Detail
        </button>
      </nav>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}