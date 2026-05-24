import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Moon, Sun, Mail, Lock, ArrowRight, Eye, EyeOff, User, Zap, Shield, TrendingUp, CheckCircle } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

export default function AuthForm({ type }) {
  const router = useRouter();
  const { dark, toggle } = useTheme();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (window.location.search.includes('registered=1')) {
      setRegisterSuccess(true);
    }
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleReset = async (e) => {
    e.preventDefault();
    if (!resetEmail) return setError('Masukkan email kamu.');
    setResetLoading(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (err) return setError('Gagal mengirim email. Pastikan email terdaftar dan coba lagi.');
    setResetSent(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) return setError('Email dan password wajib diisi.');
    setLoading(true);

    if (type === 'register') {
      if (!form.name.trim()) { setLoading(false); return setError('Nama wajib diisi.'); }
      if (form.password.length < 6) { setLoading(false); return setError('Password minimal 6 karakter.'); }

      try {
        const { data, error: err } = await Promise.race([
          supabase.auth.signUp({
            email: form.email,
            password: form.password,
            options: { data: { name: form.name.trim() } },
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
        ]);

        if (err) {
          setLoading(false);
          const msg = err.message?.toLowerCase();
          if (msg?.includes('already registered') || msg?.includes('already exists') || msg?.includes('user already')) {
            return setError('Email sudah terdaftar. Silakan login.');
          }
          if (msg?.includes('rate limit') || msg?.includes('too many')) {
            return setError('Terlalu banyak percobaan. Tunggu beberapa menit.');
          }
          if (msg?.includes('invalid email')) {
            return setError('Format email tidak valid.');
          }
          if (msg?.includes('weak password') || msg?.includes('password')) {
            return setError('Password terlalu lemah. Gunakan minimal 8 karakter.');
          }
          return setError('Registrasi gagal: ' + err.message);
        }

        const user = data.user || data.session?.user;
        if (!user) {
          setLoading(false);
          return setError('Cek email kamu untuk konfirmasi akun, lalu login.');
        }

        const name = form.name.trim();
        sessionStorage.setItem('user', JSON.stringify({
          name,
          initials: (name[0] + (name.split(' ')[1]?.[0] || '')).toUpperCase(),
        }));

        router.push('/login?registered=1');
      } catch (err) {
        setLoading(false);
        if (err.message === 'timeout') {
          return setError('Koneksi timeout. Periksa internet kamu dan coba lagi.');
        }
        return setError('Registrasi gagal. Periksa koneksi internet kamu.');
      }

    } else {
      // ✅ Fix Critical: blocked check dipindah ke server-side via /api/auth/login
      // Client-side check (query Supabase dari browser) mudah di-bypass lewat DevTools/console
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10 detik timeout
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const loginData = await loginRes.json();

        if (!loginRes.ok) {
          setLoading(false);
          return setError(loginData.error || 'Email atau password salah.');
        }

        // Set Supabase session dari token yang dikembalikan server
        if (loginData.access_token) {
          await supabase.auth.setSession({
            access_token: loginData.access_token,
            refresh_token: loginData.refresh_token,
          });
        }

        const name = loginData.user?.name || form.email.split('@')[0];
        sessionStorage.setItem('user', JSON.stringify({
          name,
          initials: (name[0] + (name.split(' ')[1]?.[0] || '')).toUpperCase(),
        }));

        router.push('/dashboard');
      } catch (err) {
        setLoading(false);
        if (err.name === 'AbortError') {
          return setError('Koneksi timeout. Periksa internet kamu dan coba lagi.');
        }
        return setError('Gagal login. Periksa koneksi internet kamu.');
      }
    }

    setLoading(false);
  };

  const isLogin = type === 'login';

  const features = [
    { icon: <Zap size={16} />, text: 'Order SMM instan & otomatis' },
    { icon: <Shield size={16} />, text: 'Transaksi aman & terenkripsi' },
    { icon: <TrendingUp size={16} />, text: 'Pantau progress real-time' },
  ];

  return (
    <div className={`root${dark ? ' dark' : ''}`} style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Left Panel — hidden on mobile */}
      <div className="auth-left-panel" style={{ flex: 1, background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 40%, #2563eb 70%, #3b82f6 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 56px', position: 'relative', overflow: 'hidden', minHeight: '100vh' }}>
        <div style={{ position: 'absolute', top: -120, right: -120, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', right: 40, width: 180, height: 180, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '42%', right: 50, width: 140, height: 140, borderRadius: '50%', border: '1px solid rgba(255,255,255,.08)', pointerEvents: 'none' }} />

        <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 64, cursor: 'pointer' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,.2)' }}>
            <img src="/logo.png" alt="SuntikSosmed" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-.02em' }}>SuntikSosmed</span>
        </div>

        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 38, fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: 16, letterSpacing: '-.03em' }}>
            {isLogin ? 'Selamat datang\nkembali 👋' : 'Mulai tingkatkan\nsosialmu 🚀'}
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.7)', lineHeight: 1.7, maxWidth: 340 }}>
            {isLogin
              ? 'Masuk dan kelola semua order SMM kamu dari satu dashboard yang powerful.'
              : 'Daftarkan akunmu sekarang dan nikmati layanan SMM terbaik dengan harga terjangkau.'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>{f.icon}</div>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,.85)', fontWeight: 500 }}>{f.text}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 56, display: 'flex', gap: 32 }}>
          {[['10K+', 'Users aktif'], ['500K+', 'Order selesai'], ['99.9%', 'Uptime']].map(([v, l]) => (
            <div key={l}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{v}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', fontWeight: 500 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ flex: 1, background: 'var(--bg)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 48px', position: 'relative', overflowY: 'auto' }}>
        <button onClick={toggle} style={{ position: 'absolute', top: 24, right: 24, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 10px', cursor: 'pointer', color: 'var(--text2)', display: 'flex', boxShadow: 'var(--shadow)' }}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
          <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: 28, padding: 0 }}>
            <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Kembali ke beranda
          </button>

          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 6, letterSpacing: '-.02em' }}>
              {isLogin ? 'Masuk ke akun' : 'Buat akun baru'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text3)' }}>
              {isLogin ? 'Masukkan email dan password kamu' : 'Isi data berikut untuk mendaftar'}
            </p>
            {registerSuccess && (
              <div style={{ marginTop: 14, background: 'var(--green-l)', border: '1.5px solid var(--green)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={15} /> Akun berhasil dibuat! Silakan login.
              </div>
            )}
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!isLogin && (
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Nama Lengkap</label>
                <div style={{ position: 'relative' }}>
                  <User size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                  <input className="inp" style={{ paddingLeft: 38 }} placeholder="Nama kamu" value={form.name} onChange={set('name')} />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="inp" style={{ paddingLeft: 38 }} type="email" placeholder="email@kamu.com" value={form.email} onChange={set('email')} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)' }}>Password</label>
                {isLogin && <span onClick={() => { setShowReset(true); setResetSent(false); setError(''); setResetEmail(form.email || ''); }} style={{ fontSize: 12, color: 'var(--blue)', cursor: 'pointer', fontWeight: 600 }}>Lupa password?</span>}
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="inp" style={{ paddingLeft: 38, paddingRight: 42 }} type={showPw ? 'text' : 'password'} placeholder={isLogin ? '••••••••' : 'Min. 6 karakter'} value={form.password} onChange={set('password')} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 8, WebkitTapHighlightColor: 'transparent' }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: 'var(--red-l)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 9, padding: '10px 13px', fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>{error}</div>
            )}

            <button className="btn btn-blue" type="submit" disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: 11, fontSize: 14.5, marginTop: 4, gap: 8 }}>
              {loading ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', borderRadius: '50%' }} className="spin" /> : isLogin ? 'Masuk' : 'Daftar Sekarang'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>atau</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--text2)' }}>
            {isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '}
            <span onClick={() => router.push(isLogin ? '/register' : '/login')} style={{ color: 'var(--blue)', cursor: 'pointer', fontWeight: 700 }}>
              {isLogin ? 'Daftar sekarang' : 'Masuk'}
            </span>
          </p>

          {/* Reset Password Modal */}
          {showReset && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowReset(false)}>
              <div style={{ background: 'var(--white)', borderRadius: 20, width: 400, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 24px 60px rgba(0,0,0,.2)', padding: 32 }}
                onClick={e => e.stopPropagation()}>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', marginBottom: 6 }}>Reset Password</div>
                <p style={{ fontSize: 13.5, color: 'var(--text3)', marginBottom: 24, lineHeight: 1.6 }}>
                  Masukkan email kamu dan kami akan kirimkan link untuk reset password.
                </p>
                {resetSent ? (
                  <div style={{ background: 'var(--green-l)', border: '1.5px solid var(--green)', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <CheckCircle size={20} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)', marginBottom: 4 }}>Email terkirim!</div>
                      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>Cek inbox <strong>{resetEmail}</strong> dan klik link reset password. Cek juga folder spam.</div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleReset}>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Email</label>
                    <div style={{ position: 'relative', marginBottom: 16 }}>
                      <Mail size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                      <input className="inp" style={{ paddingLeft: 38 }} type="email" placeholder="email@kamu.com" value={resetEmail} onChange={e => setResetEmail(e.target.value)} autoFocus />
                    </div>
                    {error && <div style={{ background: 'var(--red-l)', borderRadius: 9, padding: '10px 13px', fontSize: 13, color: 'var(--red)', fontWeight: 600, marginBottom: 14 }}>{error}</div>}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button type="button" onClick={() => setShowReset(false)} style={{ flex: 1, padding: '11px 0', borderRadius: 11, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Batal</button>
                      <button type="submit" disabled={resetLoading} style={{ flex: 2, padding: '11px 0', borderRadius: 11, border: 'none', background: 'var(--blue)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                        {resetLoading ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', borderRadius: '50%' }} className="spin" /> : 'Kirim Link Reset'}
                      </button>
                    </div>
                  </form>
                )}
                {resetSent && (
                  <button onClick={() => setShowReset(false)} style={{ width: '100%', marginTop: 16, padding: '11px 0', borderRadius: 11, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Tutup</button>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 32 }}>
            {['Aman & Terpercaya', 'Data Terenkripsi', '24/7 Support'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
                <CheckCircle size={11} style={{ color: 'var(--green)', flexShrink: 0 }} /> {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .auth-left-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}