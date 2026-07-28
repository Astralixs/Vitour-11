import { useState } from 'react';
import { supabase } from '../../../services/supabase';

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
      background: '#0a0a0f',
      color: '#e8e6e0',
      fontFamily: "'DM Mono', 'Courier New', monospace",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@700;900&display=swap');
        * { box-sizing: border-box; }

        .login-card {
          width: 100%;
          max-width: 380px;
          background: #0d1a16;
          border: 1px solid #1e3d32;
          border-radius: 14px;
          padding: 2.5rem 2rem;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        }
        .login-logo { font-family: 'Playfair Display', serif; font-size: 1.8rem; font-weight: 900; text-align: center; background: linear-gradient(135deg, #4d9e7f, #a8d5be); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .login-logo span { font-weight: 300; font-size: 0.72rem; display: block; margin-top: 0.35rem; background: #6b8f82; -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 0.2em; text-transform: uppercase; font-family: 'DM Mono', monospace; }

        .login-form { margin-top: 2rem; display: flex; flex-direction: column; gap: 1rem; }
        .login-form-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .login-label { font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; color: #4a7a68; }
        .login-input { background: #0a0a0f; border: 1px solid #1e3d32; border-radius: 8px; padding: 0.75rem 1rem; color: #e8e6e0; font-family: 'DM Mono', monospace; font-size: 0.85rem; outline: none; transition: border-color 0.2s; width: 100%; }
        .login-input:focus { border-color: #4d9e7f; }
        .login-input::placeholder { color: #2a5040; }

        .login-btn { margin-top: 0.5rem; padding: 0.8rem 1.25rem; border-radius: 8px; border: 1px solid #3a6b5a; background: #1e3d32; color: #4d9e7f; font-family: 'DM Mono', monospace; font-size: 0.82rem; letter-spacing: 0.08em; cursor: pointer; transition: all 0.2s; }
        .login-btn:hover:not(:disabled) { background: #2a5040; color: #a8d5be; }
        .login-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .login-error { background: #2a1010; border: 1px solid #4a2222; color: #c47070; border-radius: 8px; padding: 0.65rem 0.9rem; font-size: 0.75rem; text-align: center; }

        .login-footer { margin-top: 1.5rem; text-align: center; font-size: 0.68rem; color: #2a5040; letter-spacing: 0.05em; }
      `}</style>

      <div className="login-card">
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

        <div className="login-footer">RESTRICTED ACCESS — ADMINS ONLY</div>
      </div>
    </div>
  );
}
