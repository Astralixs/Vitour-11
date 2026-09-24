import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../services/supabase';
import type { Session } from '@supabase/supabase-js';
import Login from './Login';
import Panorama from './Panorama';
import Detail from './Detail';

type ThemeMode = 'light' | 'dark';
const THEME_STORAGE_KEY = 'vitour-admin-theme';

export default function AdminPanel() {
  // ── AUTH STATE ──
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [activeTab, setActiveTab] = useState<'panoramas' | 'hotspots' | 'details' | 'data'>('panoramas');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // ── THEME (light/dark) — defaults to light, remembers the choice on this device ──
  const [theme, setTheme] = useState<ThemeMode>('light');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch { /* localStorage unavailable — keep default light */ }
  }, []);
  const toggleTheme = () => {
    setTheme(prev => {
      const next: ThemeMode = prev === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  };

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
        minHeight: '100vh', background: theme === 'dark' ? '#121212' : '#FFFFFF', color: theme === 'dark' ? '#EF5350' : '#1565C0',
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
    <div data-theme={theme} onClick={handleAdminPanelClick} style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-body)', fontFamily: "'DM Mono', 'Courier New', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button, input, select, textarea, a, div[tabindex] { outline: none; -webkit-tap-highlight-color: transparent; }

        /* ── THEME TOKENS — light is the default, [data-theme="dark"] overrides them ── */
        [data-theme] {
          --bg-page: #FFFFFF;
          --bg-panel: #F7F9FB;
          --bg-card: #FFFFFF;
          --bg-surface: #EEF1F4;
          --border-color: #E0E4E8;
          --border-strong: #CBD5DD;
          --text-header: #1565C0;
          --text-subheader: #1A1A1A;
          --text-body: #1A1A1A;
          --text-label: #455A64;
          --text-muted: #78828C;
          --text-faint: #9AA5B1;
          --accent: #1565C0;
          --accent-dark: #0D47A1;
          --accent-soft: #EAF2FF;
          --accent-border: #BBD8FF;
          --accent-contrast: #FFFFFF;
          --danger: #C62828;
          --danger-soft: #FDECEC;
          --danger-border: #F1C0C0;
          --warn-bg: #FFF3CD;
          --warn-text: #8A6D00;
          --scrollbar: #B0BEC5;
        }
        [data-theme="dark"] {
          --bg-page: #121212;
          --bg-panel: #1B1B1D;
          --bg-card: #1E1E1E;
          --bg-surface: #2A2A2A;
          --border-color: #333333;
          --border-strong: #444444;
          --text-header: #EF5350;
          --text-subheader: #FFFFFF;
          --text-body: #FFFFFF;
          --text-label: #D0D0D0;
          --text-muted: #B0B0B0;
          --text-faint: #8A8A8A;
          --accent: #42A5F5;
          --accent-dark: #64B5F6;
          --accent-soft: #23303C;
          --accent-border: #3A5670;
          --accent-contrast: #FFFFFF;
          --danger: #EF5350;
          --danger-soft: #3A2222;
          --danger-border: #5C2B2B;
          --warn-bg: #4A3B12;
          --warn-text: #FFD54F;
          --scrollbar: #4A4A4A;
        }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: var(--bg-page); }
        ::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 2px; }

        .panel-header {
          background: var(--bg-page);
          border-bottom: 1px solid var(--border-color);
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .logo { font-family: 'Playfair Display', serif; font-size: 1.4rem; font-weight: 900; color: var(--accent); }
        .logo span { font-weight: 400; font-size: 0.75rem; display: block; color: var(--text-body); letter-spacing: 0.15em; text-transform: uppercase; font-family: 'DM Mono', monospace; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #2E7D32; display: inline-block; margin-right: 0.5rem; box-shadow: 0 0 8px rgba(46,125,50,0.45); animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .status-text { font-size: 0.7rem; color: var(--text-body); letter-spacing: 0.1em; }
        .logout-btn { background: transparent; border: 1px solid var(--border-strong); color: var(--accent); font-family: 'DM Mono', monospace; font-size: 0.68rem; letter-spacing: 0.08em; padding: 0.4rem 0.7rem; border-radius: 6px; cursor: pointer; margin-left: 0.75rem; transition: all 0.2s; }
        .logout-btn:hover { border-color: var(--accent); background: var(--accent-soft); }

        .theme-toggle-btn {
          position: relative;
          width: 76px;
          height: 36px;
          padding: 0;
          border: none;
          border-radius: 999px;
          cursor: pointer;
          overflow: hidden;
          transition: background 0.3s ease, border-color 0.3s ease;
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          box-sizing: border-box;
        }

        /* Light mode */
        .theme-toggle-btn {
          background: #F1F1F1;
          border: 1px solid #D5D5D5;
        }

        /* Dark mode */
        [data-theme="dark"] .theme-toggle-btn {
          background: #242424;
          border-color: #111111;
        }

        /* Sun / Moon icons */
        .theme-icon {
          position: absolute;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
          transition: opacity 0.25s ease, transform 0.3s ease;
        }

        .theme-icon svg {
          width: 20px;
          height: 20px;
          display: block;
        }

        /* Moon on the left */
        .theme-icon-moon {
          left: 9px;
          color: #171717;
        }

        /* Sun on the right */      
        .theme-icon-sun {
          right: 9px;
          color: #FFFFFF;
        }

        /* Moving circular knob */
        .theme-toggle-knob {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #FFFFFF;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
          z-index: 2;
          transition: transform 0.3s ease, background 0.3s ease;
        }

        /* Dark = knob on left */
        [data-theme="dark"] .theme-toggle-knob {
          transform: translateX(0);
          background: #FFFFFF;
        }

        /* Light = knob on right */
        [data-theme="light"] .theme-toggle-knob {
          transform: translateX(40px);
          background: #242424;
        }

        /* Make the inactive icon slightly faded */
        [data-theme="dark"] .theme-icon-sun {
          opacity: 0.35;
        }

        [data-theme="light"] .theme-icon-moon {
          opacity: 0.35;
        }

        .theme-toggle-btn:hover {
          transform: scale(1.03);
        }

        .theme-toggle-btn:active {
          transform: scale(0.97);
        }

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
          background: var(--accent);
          border-radius: 2px;
          transition: all 0.2s;
        }

        .main-layout { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - 60px); background: var(--bg-page); }

        .sidebar {
          background: var(--bg-panel);
          border-right: 1px solid var(--border-color);
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .sidebar-divider { border: none; border-top: 1px solid var(--border-color); margin: 1.25rem 0.25rem; }
        .sidebar-label { font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-muted); padding: 0.5rem 0.75rem; margin-top: 0.5rem; }
        .nav-btn { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 8px; border: none; background: transparent; color: var(--text-body); font-family: 'DM Mono', monospace; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; }
        .nav-btn:hover { background: var(--accent-soft); color: var(--accent); }
        .nav-btn.active { background: var(--accent); color: var(--accent-contrast); border-left: 2px solid var(--accent-dark); }

        .sidebar {
          background: var(--bg-panel);
          border-right: 1px solid var(--border-color);
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .sidebar-divider {
          border: none;
          border-top: 1px solid var(--border-color);
          margin: 1.25rem 0.25rem;
        }

        .sidebar-label {
          font-size: 0.65rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--text-muted);
          padding: 0.5rem 0.75rem;
          margin-top: 0.5rem;
        }

        .nav-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--text-body);
          font-family: 'DM Mono', monospace;
          font-size: 0.85rem;
          cursor: pointer;
          transition: none;
          text-align: left;
          width: 100%;
        }

        .nav-btn:hover {
          background: var(--accent-soft);
          color: var(--accent);
        }

        .nav-btn.active {
          background: var(--accent);
          color: var(--accent-contrast);
          border-left: 2px solid var(--accent-dark);
        }
          
        .content { padding: 1.5rem; overflow-y: auto; background: var(--bg-page); }

        .section-title { font-family: 'Playfair Display', serif; font-size: 1.6rem; font-weight: 700; color: var(--accent); margin-bottom: 0.25rem; }
        .section-sub { font-size: 0.7rem; color: var(--text-body); letter-spacing: 0.1em; margin-bottom: 1.5rem; }

        .card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        .card-title { font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-label); margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.5rem; }
        .form-label { font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-muted); }
        .form-input { background: var(--bg-card); border: 1px solid var(--border-strong); border-radius: 8px; padding: 0.65rem 1rem; color: var(--text-body); font-family: 'DM Mono', monospace; font-size: 0.85rem; outline: none; transition: border-color 0.2s; width: 100%; }
        .form-input:focus { border-color: var(--accent); }
        .form-input::placeholder { color: var(--text-faint); }
        select.form-input option { background: var(--bg-card); }
        textarea.form-input { resize: vertical; min-height: 80px; font-family: 'DM Mono', monospace; }

        .file-input-wrapper { position: relative; background: var(--bg-panel); border: 1px dashed var(--border-strong); border-radius: 8px; padding: 1rem; text-align: center; cursor: pointer; transition: border-color 0.2s; }
        .file-input-wrapper:hover { border-color: var(--accent); }
        .file-input-wrapper input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .file-label { font-size: 0.8rem; color: var(--text-muted); }
        .file-label strong { color: var(--accent); }

        .btn { padding: 0.65rem 1.25rem; border-radius: 8px; border: none; font-family: 'DM Mono', monospace; font-size: 0.78rem; letter-spacing: 0.08em; cursor: pointer; transition: all 0.2s; }
        .btn-primary { background: var(--accent); color: var(--accent-contrast); border: 1px solid var(--accent); }
        .btn-primary:hover { background: var(--accent-dark); border-color: var(--accent-dark); }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-secondary { background: transparent; color: var(--accent); border: 1px solid var(--border-strong); }
        .btn-secondary:hover { background: var(--accent); color: var(--accent-contrast); }
        .btn-danger { background: transparent; color: var(--danger); border: 1px solid var(--danger-border); padding: 0.4rem 0.7rem; font-size: 0.72rem; }
        .btn-danger:hover { background: var(--danger-soft); border-color: var(--danger); }
        .btn-accent { background: transparent; color: var(--accent); border: 1px solid var(--border-strong); padding: 0.4rem 0.7rem; font-size: 0.72rem; }
        .btn-accent:hover { background: var(--accent-soft); border-color: var(--accent); }
        .btn-accent.on { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
        .btn-edit { background: transparent; color: var(--accent); border: 1px solid var(--border-strong); padding: 0.4rem 0.7rem; font-size: 0.72rem; }
        .btn-edit:hover { background: var(--accent-soft); border-color: var(--accent); }
        .first-badge { font-size: 0.62rem; background: var(--warn-bg); color: var(--warn-text); padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 0.1em; }
        .editing-badge { font-size: 0.62rem; background: var(--accent-soft); color: var(--accent); padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 0.1em; }

        .panorama-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem; }
        .panorama-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; overflow: hidden; transition: border-color 0.2s; cursor: pointer; }
        .panorama-card:hover { border-color: var(--accent); }
        .panorama-card.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
        .panorama-img { width: 100%; height: 120px; object-fit: cover; display: block; background: var(--bg-surface); }
        .panorama-info { padding: 0.65rem 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; flex-wrap: wrap; }
        .panorama-title { font-size: 0.78rem; color: var(--text-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; }

        .hotspot-list { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem; }
        .hotspot-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-panel); font-size: 0.78rem; }
        .hotspot-item-info { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 0; }
        .hotspot-badge { font-size: 0.62rem; padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 0.1em; display: inline-block; }
        .hotspot-badge.scene { background: var(--accent); color: var(--accent-contrast); }
        .hotspot-badge.info { background: var(--bg-surface); color: var(--text-label); }
        .hotspot-badge.linked { background: var(--accent); color: var(--accent-contrast); }
        .hotspot-badge.unlinked { background: var(--bg-surface); color: var(--text-muted); }

        .empty-state { text-align: center; padding: 2.5rem 1rem; color: var(--text-faint); font-size: 0.82rem; }

        .toast { position: fixed; bottom: 1.5rem; right: 1rem; left: 1rem; padding: 0.75rem 1.25rem; border-radius: 8px; font-size: 0.78rem; letter-spacing: 0.05em; z-index: 999; animation: slideUp 0.3s ease; text-align: center; }
        .toast.success { background: var(--accent); color: var(--accent-contrast); border: 1px solid var(--accent-dark); }
        .toast.error { background: var(--danger-soft); color: var(--danger); border: 1px solid var(--danger-border); }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1.5rem; }
        .stat-card { background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.85rem 1rem; }
        .stat-num { font-family: 'Playfair Display', serif; font-size: 1.6rem; color: var(--accent); font-weight: 700; }
        .stat-label { font-size: 0.62rem; color: var(--text-muted); letter-spacing: 0.12em; text-transform: uppercase; margin-top: 0.15rem; }

        /* Info icon + hover tooltip (replaces the old always-visible info box) */
        .info-icon-wrap { display: flex; justify-content: flex-end; margin: -0.75rem 0 1rem; }
        .info-icon { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); border: 1px solid var(--accent-border); font-size: 0.72rem; font-weight: 700; font-family: 'DM Mono', monospace; cursor: help; }
        .info-icon .info-tooltip {
          visibility: hidden;
          opacity: 0;
          position: absolute;
          top: 130%;
          right: 0;
          width: 260px;
          max-width: 70vw;
          background: #1A1A1A;
          color: #FFFFFF;
          font-size: 0.7rem;
          line-height: 1.5;
          letter-spacing: 0.02em;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          text-transform: none;
          font-weight: 400;
          text-align: left;
          z-index: 50;
          transition: opacity 0.15s ease;
          box-shadow: 0 4px 12px rgba(0,0,0,0.18);
        }
        .info-icon .info-tooltip strong { color: #90CAF9; }
        .info-icon:hover .info-tooltip, .info-icon:focus .info-tooltip { visibility: visible; opacity: 1; }

        .click-image-wrapper { position: relative; width: 100%; border-radius: 8px; overflow: hidden; cursor: crosshair; border: 1px solid var(--border-color); transition: border-color 0.2s; background: var(--bg-panel); user-select: none; }
        .click-image-wrapper:hover { border-color: var(--accent); }
        .click-image-wrapper img { width: 100%; display: block; pointer-events: none; }
        .crosshair-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; color: rgba(0,0,0,0.35); letter-spacing: 0.15em; text-transform: uppercase; pointer-events: none; transition: opacity 0.2s; }
        .click-image-wrapper:hover .crosshair-label { opacity: 0; }
        .click-marker { position: absolute; transform: translate(-50%, -50%); pointer-events: none; z-index: 10; }
        .click-marker-ring { width: 28px; height: 28px; border: 2px solid var(--accent); border-radius: 50%; animation: markerPop 0.2s ease; }
        .click-marker-dot { width: 6px; height: 6px; background: var(--accent); border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
        @keyframes markerPop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        /* existing (already-saved) pins shown on the denah while placing/editing a new one */
        .existing-pin { position: absolute; transform: translate(-50%, -50%); z-index: 5; pointer-events: none; }
        .existing-pin-dot { width: 16px; height: 16px; border-radius: 50%; background: var(--accent); border: 2px solid var(--accent-contrast); box-shadow: 0 0 0 2px var(--accent); }

        .coord-readout { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.75rem; padding: 0.65rem 1rem; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.78rem; align-items: center; }
        .coord-empty { color: var(--text-muted); font-size: 0.72rem; letter-spacing: 0.05em; }
        .coord-pill { display: flex; align-items: center; gap: 0.5rem; }
        .coord-key { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.15em; color: var(--text-muted); }
        .coord-val { color: var(--text-body); font-size: 0.82rem; }
        .coord-divider { width: 1px; height: 14px; background: var(--border-color); }

        .room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem; }
        .room-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; overflow: hidden; transition: border-color 0.2s; }
        .room-card:hover { border-color: var(--accent); }
        .room-card.editing { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
        .room-img { width: 100%; height: 120px; object-fit: cover; display: block; background: var(--bg-surface); }
        .room-info { padding: 0.65rem 0.75rem; }
        .room-name { font-size: 0.82rem; color: var(--text-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.3rem; font-weight: 600; }
        .room-meta { font-size: 0.65rem; color: var(--text-muted); margin-bottom: 0.5rem; }
        .room-desc { font-size: 0.7rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 0.6rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .room-actions { display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; }

        .pie-chart-wrap { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; justify-content: center; padding: 0.5rem 0; }
        .pie-legend { display: flex; flex-direction: column; gap: 0.5rem; min-width: 200px; flex: 1; }
        .pie-legend-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; color: var(--text-body); }
        .pie-swatch { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
        .pie-legend-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pie-legend-value { color: var(--text-muted); font-size: 0.72rem; white-space: nowrap; }

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
            background: rgba(0,0,0,0.4);
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
            background: var(--bg-page);
            border-top: 1px solid var(--border-color);
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
            color: var(--text-muted);
            font-family: 'DM Mono', monospace;
            font-size: 0.7rem;
            letter-spacing: 0.08em;
            cursor: pointer;
            transition: color 0.2s;
          }
          .bottom-tab-btn.active { color: var(--accent); border-top: 2px solid var(--accent); }

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
          <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label="Ganti tema terang/gelap"
        >
          {/* Moon */}
          <span className="theme-icon theme-icon-moon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M20.5 15.5C19.2 16.2 17.7 16.6 16.1 16.6C11.3 16.6 7.4 12.7 7.4 7.9C7.4 6.3 7.8 4.8 8.5 3.5C4.9 5 2.5 8.5 2.5 12.5C2.5 17.7 6.7 21.9 11.9 21.9C15.9 21.9 19.4 19.5 20.5 15.5Z"
                fill="currentColor"
              />
              <path
                d="M17.5 3.5V7.5M15.5 5.5H19.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </span>

          {/* Sun */}
          <span className="theme-icon theme-icon-sun">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="4"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>

          {/* Sliding knob */}
          <span className="theme-toggle-knob" />
        </button>
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
            ? <div style={{ padding: '0.5rem 1rem', background: 'var(--accent)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--accent-contrast)' }}>{selectedPanoramaLabel}</div>
            : <div style={{ padding: '0.5rem 1rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Belum dipilih</div>}

          <hr className="sidebar-divider" />

          <div className="sidebar-label">Detail</div>
          <button className={`nav-btn ${activeTab === 'details' ? 'active' : ''}`} onClick={() => { setActiveTab('details'); setSidebarOpen(false); }}>
            Detail Ruangan
          </button>
          <button className={`nav-btn ${activeTab === 'data' ? 'active' : ''}`} onClick={() => { setActiveTab('data'); setSidebarOpen(false); }}>
            Data
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

          {(activeTab === 'details' || activeTab === 'data') && (
            <Detail view={activeTab === 'data' ? 'data' : 'details'} showToast={showToast} />
          )}
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
        <button className={`bottom-tab-btn ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>
          Data
        </button>
      </nav>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}