import { useState } from 'react';
import { supabase } from '../../services/supabase';
interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message === 'Invalid login credentials'
          ? 'Email atau password salah.'
          : signInError.message);
        return;
      }

      onLoginSuccess();
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      color: '#e8e6e0',
      fontFamily: "'DM Mono', 'Courier New', monospace",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '2.5rem 1.5rem',
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: '#0a1420', // fallback while the image loads / if it fails

    }}>
      <img
        src="bg3.jpeg"
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'fill',
        }}
      />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@700;900&display=swap');
        * { box-sizing: border-box; }
        button, input, a { outline: none; -webkit-tap-highlight-color: transparent; }

        .login-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(45deg, rgba(0,71,133,0.9) 0%, rgba(0,119,204,0.55) 22%, rgba(10,20,32,0.15) 45%, transparent 65%);
        }

        .login-content {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 380px;
        }

        .login-logo { font-family: 'Playfair Display', serif; font-size: 1.8rem; font-weight: 900; text-align: center; background: linear-gradient(135deg, #00b8ff, #a0e0ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; -webkit-text-stroke: 0.px white; }
        .login-logo span { font-weight: 300; font-size: 0.72rem; display: block; margin-top: 0.35rem; background: #5dd0ff; -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 0.2em; text-transform: uppercase; font-family: 'DM Mono', monospace; -webkit-text-stroke: 0.5px white; }

        .login-form { margin-top: 2rem; display: flex; flex-direction: column; gap: 1rem; }
        .login-form-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .login-label { font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; color: #0095e8; }
        .login-input { background: rgba(10,20,32,0.75); border: 1px solid #0077cc; border-radius: 8px; padding: 0.75rem 1rem; color: #e8e6e0; font-family: 'DM Mono', monospace; font-size: 0.85rem; outline: none; transition: border-color 0.2s; width: 100%; }
        .login-input:focus { border-color: #00b8ff; }
        .login-input::placeholder { color: #075985; }

        .login-btn { margin-top: 0.5rem; padding: 0.8rem 1.25rem; border-radius: 8px; border: 1px solid #0095e8; background: #0077cc; color: #00b8ff; font-family: 'DM Mono', monospace; font-size: 0.82rem; letter-spacing: 0.08em; cursor: pointer; transition: all 0.2s; }
        .login-btn:hover:not(:disabled) { background: #00507a; color: #a0e0ff; }
        .login-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .login-error { background: #2a1010; border: 1px solid #4a2222; color: #c47070; border-radius: 8px; padding: 0.65rem 0.9rem; font-size: 0.75rem; text-align: center; }

        .login-footer { margin-top: 1.5rem; text-align: center; font-size: 0.68rem; color: #0095e8; letter-spacing: 0.05em; }
      `}</style>

      <div className="login-overlay" />

      <div className="login-content">
        <div className="login-logo">
          ViTour
          <span>Admin Console</span>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          {error && <div className="login-error">{error}</div>}

          <div className="login-form-group">
            <label className="login-label">Email</label>
            <input
              className="login-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="login-form-group">
            <label className="login-label">Password</label>
            <input
              className="login-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : '→ Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
}