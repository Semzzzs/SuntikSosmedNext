import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import {
  Target, Moon, Sun, ArrowRight, UserPlus, Wallet, ShoppingCart,
  Instagram, Youtube, Twitter, Facebook, Play, Star, Sparkles,
  ShieldCheck, TrendingUp, CheckCircle, Zap, Globe, Lock, Search
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

// ── Easing curves ──────────────────────────────────────────────
const EASE = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',       // expo-out — snappy masuk, smooth keluar
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // spring — sedikit overshoot
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',      // material — halus
};

// ── RevealSection: animasi saat masuk viewport ─────────────────
// variant: 'up' | 'down' | 'left' | 'right' | 'scale' | 'fade'
// stagger: jarak delay antar direct children (ms)
function RevealSection({ children, delay = 0, duration = 700, variant = 'up', stagger = 0, className = '', style = {} }) {
  const ref = useRef(null);

  const getInit = () => {
    switch (variant) {
      case 'up': return 'opacity:0;transform:translateY(36px)';
      case 'down': return 'opacity:0;transform:translateY(-24px)';
      case 'left': return 'opacity:0;transform:translateX(40px)';
      case 'right': return 'opacity:0;transform:translateX(-40px)';
      case 'scale': return 'opacity:0;transform:scale(0.92)';
      case 'fade': return 'opacity:0';
      default: return 'opacity:0;transform:translateY(36px)';
    }
  };
  const getFinal = () => variant === 'scale' ? 'opacity:1;transform:scale(1)' : 'opacity:1;transform:none';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Set initial state
    const initStyles = getInit().split(';');
    initStyles.forEach(s => {
      const [prop, val] = s.split(':');
      if (prop && val) el.style[prop.trim()] = val.trim();
    });

    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.unobserve(el);

      if (stagger > 0) {
        // Stagger animasi per child langsung
        const children = Array.from(el.children);
        children.forEach((child, i) => {
          const childDelay = delay + i * stagger;
          child.style.opacity = '0';
          child.style.transform = variant === 'left' ? 'translateX(30px)'
            : variant === 'right' ? 'translateX(-30px)'
              : variant === 'scale' ? 'scale(0.93)'
                : 'translateY(28px)';
          child.style.transition = `opacity ${duration}ms ${EASE.out} ${childDelay}ms, transform ${duration}ms ${EASE.out} ${childDelay}ms`;
          requestAnimationFrame(() => {
            child.style.opacity = '1';
            child.style.transform = 'none';
          });
        });
        // Reset parent
        el.style.opacity = '1';
        el.style.transform = 'none';
      } else {
        el.style.transition = `opacity ${duration}ms ${EASE.out} ${delay}ms, transform ${duration}ms ${EASE.out} ${delay}ms`;
        const finalStyles = getFinal().split(';');
        finalStyles.forEach(s => {
          const [prop, val] = s.split(':');
          if (prop && val) el.style[prop.trim()] = val.trim();
        });
      }
    }, { threshold: 0.06, rootMargin: '0px 0px -40px 0px' });

    obs.observe(el);
    return () => obs.disconnect();
  }, [delay, duration, variant, stagger]);

  return <div ref={ref} className={className} style={style}>{children}</div>;
}

// ── useNavbarScroll: navbar solid saat scroll ──────────────────
function useNavbarScroll() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return scrolled;
}

const SERVICES = [
  { id: '197', icon: <Instagram size={16} style={{ color: '#E1306C' }} />, iconBg: 'rgba(225,48,108,.1)', name: 'Instagram Followers — High Quality / Instant', min: '10', max: '10,000', price: 'Rp 875' },
  { id: '302', icon: <Play size={16} fill="#000" style={{ color: '#000' }} />, iconBg: 'rgba(0,0,0,.07)', name: 'TikTok Views — Ultra Fast Delivery', min: '100', max: '1,000,000', price: 'Rp 12' },
  { id: '415', icon: <Youtube size={16} style={{ color: '#FF0000' }} />, iconBg: 'rgba(255,0,0,.1)', name: 'YouTube Subscribers — Real & Active', min: '50', max: '5,000', price: 'Rp 4.375' },
  { id: '550', icon: <Twitter size={16} style={{ color: '#1DA1F2' }} />, iconBg: 'rgba(29,161,242,.1)', name: 'Twitter Retweets — Non Drop Guaranteed', min: '20', max: '20,000', price: 'Rp 875' },
  { id: '711', icon: <Facebook size={16} style={{ color: '#1877F2' }} />, iconBg: 'rgba(24,119,242,.1)', name: 'Facebook Page Likes — Real Users', min: '50', max: '50,000', price: 'Rp 1.750' },
];

const FEATURES = [
  { icon: <Star size={22} />, iconBg: 'var(--yellow-l)', iconColor: 'var(--yellow)', title: 'Kualitas Premium', desc: 'Engagement berkualitas tinggi dari akun nyata di seluruh dunia.' },
  { icon: <ShieldCheck size={22} />, iconBg: 'var(--green-l)', iconColor: 'var(--green)', title: 'Aman & Terpercaya', desc: 'Metode 100% aman, tidak perlu password. Perlindungan terjamin.' },
  { icon: <Zap size={22} />, iconBg: 'rgba(139,92,246,.1)', iconColor: 'var(--purple)', title: 'Pengiriman Instan', desc: 'Order mulai diproses dalam hitungan menit. Super cepat.' },
  { icon: <Globe size={22} />, grad: 'var(--blue)', title: 'Support 24/7', desc: 'Tim kami selalu siap membantu kapanpun, siang maupun malam.' },
];

const STEPS = [
  {
    icon: <UserPlus size={32} />,
    title: 'Buat Akun Gratis',
    desc: 'Daftar dalam kurang dari 1 menit. Tidak perlu kartu kredit atau verifikasi rumit — cukup email dan password.',
    bullets: ['Email & password saja', 'Verifikasi instan', 'Akses langsung ke dashboard', 'Tanpa biaya pendaftaran'],
    color: 'var(--blue)',
    bg: 'var(--blue-l)',
  },
  {
    icon: <Wallet size={32} />,
    title: 'Top Up Saldo',
    desc: 'Tambah saldo dengan mudah dan aman. Kami mendukung QRIS yang bisa dibayar dari semua bank dan e-wallet Indonesia.',
    bullets: ['QRIS (semua bank & e-wallet)', 'Crypto BTC, ETH, USDT (segera)', 'Minimum deposit Rp 5.000', 'Saldo masuk instan'],
    color: '#10B981',
    bg: 'var(--green-l)',
  },
  {
    icon: <ShoppingCart size={32} />,
    title: 'Pilih & Buat Order',
    desc: 'Pilih layanan dari 2.000+ opsi, masukkan link atau username target, tentukan jumlah, dan lihat pertumbuhanmu melesat.',
    bullets: ['2.000+ layanan tersedia', 'Instagram, TikTok, YouTube & lebih', 'Pantau progress real-time', 'Garansi refill jika drop'],
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,.1)',
  },
];

export default function Landing() {
  const router = useRouter();
  const { dark, toggle } = useTheme();
  const navScrolled = useNavbarScroll();
  const [serviceQuery, setServiceQuery] = useState('');

  const filteredServices = SERVICES.filter(sv => {
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return true;
    return sv.name.toLowerCase().includes(q) || sv.id.includes(q);
  });

  return (
    <div className={`root${dark ? ' dark' : ''}`} style={{ minHeight: '100vh', overflow: 'hidden' }}>

      {/* ── BLOB BG ── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {/* Light mode: richer gradient base */}
        {!dark && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #EEF4FF 0%, #F8FAFF 40%, #F0F7FF 100%)' }} />}
        <div style={{ position: 'absolute', top: -120, left: -100, width: 600, height: 600, borderRadius: '50%', background: dark ? 'radial-gradient(circle, rgba(37,99,235,.13) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(37,99,235,.18) 0%, transparent 65%)', animation: 'blobFloat 12s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: 200, right: -150, width: 500, height: 500, borderRadius: '50%', background: dark ? 'radial-gradient(circle, rgba(37,99,235,.08) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(99,102,241,.12) 0%, transparent 65%)', animation: 'blobFloat 15s ease-in-out 2s infinite' }} />
        <div style={{ position: 'absolute', bottom: -100, left: '30%', width: 400, height: 400, borderRadius: '50%', background: dark ? 'radial-gradient(circle, rgba(37,99,235,.05) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(59,130,246,.1) 0%, transparent 65%)', animation: 'blobFloat 10s ease-in-out 4s infinite' }} />
        {/* Extra light mode accent blob */}
        {!dark && <div style={{ position: 'absolute', top: '40%', left: '20%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.07) 0%, transparent 70%)', animation: 'blobFloat 18s ease-in-out 3s infinite' }} />}
      </div>

      {/* ── NAVBAR ── */}
      <nav style={{ position: 'relative', zIndex: 50, maxWidth: 1160, margin: '0 auto', padding: '18px 24px 0' }}>
        <div style={{
          background: dark ? 'rgba(15,15,20,.97)' : 'rgba(255,255,255,.96)',
          backdropFilter: 'blur(20px)',
          border: dark ? '1px solid var(--border)' : '1px solid rgba(37,99,235,.12)',
          borderRadius: 14,
          padding: '8px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          overflow: 'hidden',
          boxShadow: navScrolled
            ? (dark ? '0 8px 32px rgba(0,0,0,.4)' : '0 8px 40px rgba(37,99,235,.18), 0 1px 0 rgba(255,255,255,.8)')
            : (dark ? '0 4px 24px rgba(37,99,235,.08)' : '0 4px 24px rgba(37,99,235,.12), 0 1px 0 rgba(255,255,255,.8)'),
          transition: 'box-shadow 0.3s ease, background 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 800, fontSize: 16, color: 'var(--text)', flexShrink: 0 }}>
            <img src="/logo.png" alt="SS" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            <span>Suntik<span style={{ background: 'var(--blue)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Sosmed</span></span>
          </div>
          <div className="hide-mobile" style={{ display: 'flex', gap: 4, fontSize: 14, fontWeight: 600 }}>
            {[
              { label: 'Beranda', id: 'hero' },
              { label: 'Layanan', id: 'layanan' },
              { label: 'Panduan', id: 'panduan' },
              { label: 'Testimoni', id: 'testimoni' },
            ].map(({ label, id }) => (
              <a key={label} href={`#${id}`}
                onClick={e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}
                style={{ color: 'var(--text2)', textDecoration: 'none', padding: '7px 14px', borderRadius: 9, background: 'transparent', transition: 'background .15s', cursor: 'pointer' }}>{label}</a>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex', padding: '4px', flexShrink: 0 }}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => router.push('/login')} style={{ background: 'none', border: '1.5px solid var(--border)', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: 'var(--text2)', fontFamily: "'Plus Jakarta Sans',sans-serif", padding: '6px 12px', borderRadius: 9, whiteSpace: 'nowrap', transition: 'all .15s' }}>
              Masuk
            </button>
            <button onClick={() => router.push('/register')} style={{ background: 'var(--blue)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: '#fff', fontFamily: "'Plus Jakarta Sans',sans-serif", padding: '6px 12px', borderRadius: 9, whiteSpace: 'nowrap', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 4 }}>
              Daftar
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div id="hero" style={{ position: 'relative', zIndex: 10, maxWidth: 1160, margin: '0 auto', padding: '40px 16px 0' }}>

        {/* Floating LEFT widget - hidden on mobile */}
        <div className="fltA hide-mobile" style={{ position: 'absolute', left: 24, top: 80, width: 240, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Notif pill */}
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 50, padding: '8px 16px 8px 8px', boxShadow: '0 8px 32px rgba(37,99,235,.12)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🔥</div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>+12.500 followers hari ini!</span>
          </div>
          {/* Stats card */}
          <div className="card" style={{ padding: '18px 20px', boxShadow: '0 8px 32px rgba(37,99,235,.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 700 }}>Pertumbuhan Akun</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', background: 'var(--green-l)', padding: '2px 8px', borderRadius: 20 }}>↑ 38%</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>1.250.000</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>Total followers didapat</div>
            {/* Mini bar chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 }}>
              {[30, 45, 35, 60, 50, 75, 85].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '3px 3px 0 0', background: i === 6 ? 'var(--blue)' : 'var(--blue-l2)', transition: 'height .3s' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>
              {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => <span key={d}>{d}</span>)}
            </div>
          </div>
        </div>

        {/* Floating RIGHT widget - hidden on mobile */}
        <div className="fltB hide-mobile" style={{ position: 'absolute', right: 24, top: 60, width: 220, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Active orders */}
          <div className="card" style={{ padding: '14px 16px', boxShadow: '0 8px 32px rgba(37,99,235,.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>Order Aktif</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', background: 'var(--blue-l)', padding: '2px 8px', borderRadius: 20 }}>3 berjalan</span>
            </div>
            {[
              { avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&h=60&fit=crop', name: '@budi.creator', progress: 75, label: 'IG Followers' },
              { avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop', name: '@sari.id', progress: 40, label: 'TikTok Views' },
            ].map((u, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: i === 0 ? 10 : 0 }}>
                <img src={u.avatar} loading="lazy" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0, marginLeft: 4 }}>{u.progress}%</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${u.progress}%`, background: 'linear-gradient(90deg, var(--blue), #60a5fa)', borderRadius: 10 }} />
                  </div>
                  <span style={{ fontSize: 9.5, color: 'var(--text3)', marginTop: 2, display: 'block' }}>{u.label}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Satisfied user */}
          <div className="card" style={{ padding: '14px 16px', boxShadow: '0 8px 32px rgba(37,99,235,.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <img src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=60&h=60&fit=crop" loading="lazy" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} alt="" />
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>Rahmat W.</div>
                <div style={{ display: 'flex', gap: 1 }}>
                  {[1, 2, 3, 4, 5].map(s => <span key={s} style={{ color: '#F59E0B', fontSize: 11 }}>★</span>)}
                </div>
              </div>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.6, fontStyle: 'italic' }}>"Order selesai dalam 10 menit, kualitas followers top banget!"</p>
          </div>
        </div>

        {/* Center hero text */}
        <div className="fu" style={{ textAlign: 'center', padding: '0', position: 'relative', maxWidth: 700, margin: '0 auto' }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: dark ? 'var(--blue-l)' : 'linear-gradient(135deg, #EEF4FF, #E0EAFF)', border: '1px solid rgba(37,99,235,.15)', borderRadius: 20, padding: '5px 14px 5px 5px', fontSize: 12, fontWeight: 700, marginBottom: 24, boxShadow: dark ? 'none' : '0 2px 12px rgba(37,99,235,.1)' }}>
            <span style={{ background: 'var(--blue)', color: '#fff', borderRadius: 16, padding: '2px 10px', fontSize: 11 }}>Update Terbaru!</span>
            <span style={{ color: 'var(--blue)' }}>SuntikSosmed v2.0 Sudah Hadir!</span>
          </div>

          <h1 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, textShadow: dark ? 'none' : '0 2px 8px rgba(37,99,235,.08)', lineHeight: 1.12, color: 'var(--text)', marginBottom: 18, letterSpacing: '-1.5px' }}>
            <span className="grad-text">SuntikSosmed</span> — Platform SMM<br /><span className="grad-text">Terbaik &amp; Terpercaya</span> di Indonesia
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.7, marginBottom: 28, maxWidth: 460, margin: '0 auto 28px' }}>
            Tingkatkan followers, likes, dan views di semua media sosial. Proses cepat, harga mulai Rp 1/K, dengan garansi refill &amp; support 24 jam.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/register')} style={{ background: 'var(--blue)', border: 'none', borderRadius: 50, padding: '10px 20px', fontSize: 13.5, fontWeight: 800, color: '#fff', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: '0 8px 24px rgba(37,99,235,.35)', transition: 'transform .2s, box-shadow .2s', width: 'fit-content' }}>
              Daftar Sekarang Gratis! <UserPlus size={13} />
            </button>
            <button onClick={() => router.push('/login')} style={{ background: 'var(--white)', border: '1.5px solid var(--border)', borderRadius: 50, padding: '10px 20px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', color: 'var(--text)', fontFamily: "'Plus Jakarta Sans',sans-serif", boxShadow: 'var(--shadow)', width: 'fit-content', display: 'inline-flex', alignItems: 'center' }}>
              Masuk
            </button>
          </div>

          {/* Avatars + rating */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 22 }}>
            <div style={{ display: 'flex' }}>
              {[
                { t: 'A', bg: '#2563EB' },
                { t: 'R', bg: '#7C3AED' },
                { t: 'D', bg: '#059669' },
              ].map((a, i) => (
                <div key={i} style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--white)', marginRight: -10, background: a.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{a.t}</div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 16 }}>
              <Star size={14} fill="#F59E0B" style={{ color: '#F59E0B' }} />
              <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>4.8 / 5</span>
            </div>
            <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>dari 500+ ulasan</span>
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 44 }}>
            {['Mulai dari Rp 1/K', 'Non-drop services', 'Garansi Refill', 'Support 24/7'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, background: dark ? 'var(--white)' : 'rgba(255,255,255,.9)', border: dark ? '1px solid var(--border)' : '1px solid rgba(37,99,235,.12)', borderRadius: 20, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, color: 'var(--text)', boxShadow: dark ? 'var(--shadow)' : '0 2px 12px rgba(37,99,235,.08), 0 1px 0 rgba(255,255,255,.9)' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--blue-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={10} style={{ color: 'var(--blue)' }} />
                </div>
                {t}
              </div>
            ))}
          </div>

          {/* Platform logos greyscale */}
          <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 16 }}>Tersedia untuk platform terbaik</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '12px 24px', opacity: 0.35, filter: 'grayscale(1)', marginBottom: 48 }}>
            {[
              { icon: <Youtube size={20} />, label: 'YouTube' },
              { icon: <Twitter size={20} />, label: 'Twitter' },
              { icon: <Instagram size={20} />, label: 'Instagram' },
              { icon: <Play size={20} fill="currentColor" />, label: 'TikTok' },
              { icon: <Facebook size={20} />, label: 'Facebook' },
            ].map(p => (
              <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 14 }}>{p.icon} {p.label}</div>
            ))}
          </div>
        </div>
      </div>



      {/* ── FEATURES ── */}
      <RevealSection variant="up" duration={600}>
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 1160, margin: '0 auto', padding: '0 16px 60px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', background: 'var(--blue)', border: 'none', borderRadius: 50, padding: '5px 16px', fontSize: 12.5, fontWeight: 700, color: '#fff', marginBottom: 14 }}>KENAPA SUNTIK SOSMED</div>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: 'var(--text)', marginBottom: 10, letterSpacing: '-.5px' }}>Dirancang untuk Pertumbuhan Nyata</h2>
            <p style={{ fontSize: 15, color: 'var(--text2)', maxWidth: 480, margin: '0 auto' }}>Semua yang kamu butuhkan untuk tumbuh — cepat, aman, dan terjangkau.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
            {FEATURES.map((f, i) => (
              <RevealSection key={i} delay={i * 120} variant="scale" duration={650}>
                <div className="feature-card">
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: f.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, boxShadow: '0 6px 20px rgba(0,0,0,.15)' }}>{f.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--text)', marginBottom: 8 }}>{f.title}</div>
                  <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.65 }}>{f.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>

      </RevealSection>

      <RevealSection variant="fade" duration={500}>
        <div id="panduan" style={{ position: 'relative', zIndex: 10, background: dark ? 'rgba(255,255,255,.02)' : 'rgba(37,99,235,.03)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '48px 16px' }}>
          <div style={{ maxWidth: 1160, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,rgba(16,185,129,.1),rgba(5,150,105,.1))', border: '1px solid rgba(16,185,129,.2)', borderRadius: 50, padding: '5px 16px', fontSize: 12.5, fontWeight: 700, color: '#10B981', marginBottom: 14 }}>CARA KERJA</div>
              <h2 style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 10 }}>Mulai dalam 3 Langkah Mudah</h2>
              <p style={{ fontSize: 15, color: 'var(--text2)' }}>Dari daftar hingga layanan berjalan — semua bisa selesai dalam 2 menit.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, position: 'relative' }}>
              {/* connector line */}
              <div style={{ position: 'absolute', top: 44, left: '18%', right: '18%', height: 2, background: `linear-gradient(90deg, var(--blue), #10B981, #8B5CF6)`, borderRadius: 2, zIndex: 0, opacity: 0.3 }} />
              {STEPS.map((s, i) => (
                <RevealSection key={i} delay={i * 160} variant="up" duration={680}>
                  <div style={{ background: 'var(--white)', border: `1.5px solid ${s.color}22`, borderRadius: 22, padding: '32px 26px', position: 'relative', zIndex: 1, boxShadow: 'var(--shadow)', transition: 'transform .2s, box-shadow .2s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}>
                    {/* Step number badge */}
                    <div style={{ position: 'absolute', top: -14, left: 26, width: 28, height: 28, borderRadius: '50%', background: s.color, color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${s.color}55` }}>{i + 1}</div>
                    {/* Icon */}
                    <div style={{ width: 68, height: 68, borderRadius: 18, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, marginBottom: 20 }}>{s.icon}</div>
                    {/* Title */}
                    <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', marginBottom: 10 }}>{s.title}</div>
                    {/* Description */}
                    <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 20 }}>{s.desc}</p>
                    {/* Bullets */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {s.bullets.map((b, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5L8 3" stroke={s.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          {b}
                        </div>
                      ))}
                    </div>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>


      {/* ── SERVICES TABLE ── */}
      <RevealSection variant="up" duration={700}>
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 1160, margin: '0 auto', padding: '48px 16px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-block', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 50, padding: '5px 16px', fontSize: 12.5, fontWeight: 700, color: '#F59E0B', marginBottom: 14 }}>LAYANAN POPULER</div>
            <h2 id="layanan" style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 10 }}>Jelajahi Layanan Kami</h2>
            <p style={{ fontSize: 15, color: 'var(--text2)' }}>Sekilas layanan terpopuler kami. Harga transparan, tanpa biaya tersembunyi.</p>
          </div>
          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input className="inp" style={{ paddingLeft: 42, borderRadius: 12 }} placeholder="Cari layanan..." value={serviceQuery} onChange={e => setServiceQuery(e.target.value)} />
          </div>
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 22, overflow: 'hidden', boxShadow: 'var(--shadow2)' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="svc-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: dark ? 'rgba(255,255,255,.03)' : 'var(--bg2)' }}>
                    <th className="hide-mobile" style={{ padding: '16px 20px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}>ID</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}>SERVICE</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}>MIN / MAX</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}>MULAI DARI</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((sv, i) => (
                    <tr key={sv.id} className="service-row" style={{ borderBottom: i < filteredServices.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td className="hide-mobile" style={{ padding: '15px 20px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>#{sv.id}</td>
                      <td style={{ padding: '15px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: sv.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{sv.icon}</div>
                          {sv.name}
                        </div>
                      </td>
                      <td style={{ padding: '15px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>{sv.min} / {sv.max}</td>
                      <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: 16, background: 'var(--blue)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{sv.price}</span>
                      </td>
                      <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                        <button onClick={() => router.push('/register')} style={{ background: 'var(--blue-l)', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, color: '#1D4ED8', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Order</button>
                      </td>
                    </tr>
                  ))}
                  {filteredServices.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13.5 }}>
                        Tidak ada layanan yang cocok dengan "{serviceQuery}". Coba kata kunci lain — total ada 2.000+ layanan setelah daftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => router.push('/register')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13.5, fontFamily: "'Plus Jakarta Sans',sans-serif", display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--blue)' }}>
                <span onClick={() => router.push('/register')} style={{ cursor: 'pointer' }}>Lihat 2.000+ layanan — Daftar gratis <ArrowRight size={14} style={{ color: 'var(--blue)', display: 'inline-block', verticalAlign: 'middle' }} /></span>
              </button>
            </div>
          </div>
        </div>

        {/* ── TESTIMONIALS (Animated Scroll) ── */}
        <div id="testimoni" style={{ position: 'relative', zIndex: 10, padding: '80px 0', background: 'var(--white)', overflow: 'hidden' }}>
          {/* Blob decorations */}
          <div style={{ position: 'absolute', top: '10%', left: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,.08) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '40%', right: '-5%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,.07) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '10%', left: '30%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.06) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
          {/* Top & bottom fade masks */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to bottom, var(--white), transparent)', zIndex: 2, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to top, var(--white), transparent)', zIndex: 2, pointerEvents: 'none' }} />

          <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px', textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,rgba(37,99,235,.1),rgba(37,99,235,.05))', border: '1px solid rgba(37,99,235,.2)', borderRadius: 50, padding: '5px 16px', fontSize: 12.5, fontWeight: 700, color: 'var(--blue)', marginBottom: 14 }}>TESTIMONI</div>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 10 }}>Apa Kata Pengguna Kami</h2>
            <p style={{ fontSize: 15, color: 'var(--text2)' }}>Ribuan kreator dan bisnis sudah mempercayakan pertumbuhan sosial media mereka ke SuntikSosmed.</p>
          </div>

          {/* 3 scrolling columns */}
          <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, height: 600, overflow: 'hidden' }}>
              {[
                {
                  speed: 35,
                  items: [
                    { name: 'Rina Maharani', role: 'Content Creator · Instagram', avatar: 'R', color: '#E1306C', text: 'Followers Instagram saya naik dari 2K ke 15K dalam sebulan. Kualitasnya beneran bagus, engagement juga ikut naik!' },
                    { name: 'Budi Santoso', role: 'UMKM Owner · TikTok', avatar: 'B', color: '#000000', text: 'Awalnya ragu, tapi setelah coba TikTok Views hasilnya memuaskan. Video saya jadi masuk FYP dan penjualan naik signifikan.' },
                    { name: 'Dewi Permata', role: 'Influencer · YouTube', avatar: 'D', color: '#FF0000', text: 'Subscribe YouTube saya nambah 5000 dalam seminggu. Proses order mudah dan saldo bisa top up via QRIS, praktis!' },
                    { name: 'Rina Maharani', role: 'Content Creator · Instagram', avatar: 'R', color: '#E1306C', text: 'Followers Instagram saya naik dari 2K ke 15K dalam sebulan. Kualitasnya beneran bagus, engagement juga ikut naik!' },
                    { name: 'Budi Santoso', role: 'UMKM Owner · TikTok', avatar: 'B', color: '#000000', text: 'Awalnya ragu, tapi setelah coba TikTok Views hasilnya memuaskan. Video saya jadi masuk FYP dan penjualan naik signifikan.' },
                    { name: 'Dewi Permata', role: 'Influencer · YouTube', avatar: 'D', color: '#FF0000', text: 'Subscribe YouTube saya nambah 5000 dalam seminggu. Proses order mudah dan saldo bisa top up via QRIS, praktis!' },
                  ]
                },
                {
                  speed: 50,
                  items: [
                    { name: 'Agus Firmansyah', role: 'Digital Marketer · Twitter', avatar: 'A', color: '#1DA1F2', text: 'Retweet dan likes Twitter naik drastis. Client saya senang banget karena campaign mereka jadi viral. Recommended!' },
                    { name: 'Sari Indah', role: 'Artis Lokal · Spotify', avatar: 'S', color: '#1DB954', text: 'Plays Spotify lagu saya melonjak setelah pakai SuntikSosmed. Sekarang lagu saya masuk beberapa playlist editorial!' },
                    { name: 'Kevin Wijaya', role: 'Startup Founder · LinkedIn', avatar: 'K', color: '#0A66C2', text: 'Dashboard-nya simple dan informatif. Bisa pantau progress order real-time. Customer support juga responsif.' },
                    { name: 'Maya Putri', role: 'Beauty Influencer · Instagram', avatar: 'M', color: '#E1306C', text: 'Udah coba beberapa SMM panel, SuntikSosmed yang paling worth it. Harga terjangkau, followers real, dan gak drop!' },
                    { name: 'Agus Firmansyah', role: 'Digital Marketer · Twitter', avatar: 'A', color: '#1DA1F2', text: 'Retweet dan likes Twitter naik drastis. Client saya senang banget karena campaign mereka jadi viral. Recommended!' },
                    { name: 'Sari Indah', role: 'Artis Lokal · Spotify', avatar: 'S', color: '#1DB954', text: 'Plays Spotify lagu saya melonjak setelah pakai SuntikSosmed. Sekarang lagu saya masuk beberapa playlist editorial!' },
                  ]
                },
                {
                  speed: 42,
                  items: [
                    { name: 'Reza Pratama', role: 'Gaming YouTuber', avatar: 'R', color: '#FF0000', text: 'Channel gaming saya dari 500 subscriber sekarang udah 12K. Order gampang, tinggal masukin link dan pilih paket!' },
                    { name: 'Fitri Handayani', role: 'Online Shop · Facebook', avatar: 'F', color: '#1877F2', text: 'Page likes toko online saya naik dan otomatis terlihat lebih terpercaya di mata calon pembeli. Penjualan meningkat!' },
                    { name: 'Dimas Arya', role: 'Musisi · TikTok & Spotify', avatar: 'D', color: '#000000', text: 'Pakai untuk boost TikTok dan Spotify sekaligus. Hasilnya konsisten dan tidak ada drop sama sekali setelah 2 bulan.' },
                    { name: 'Reza Pratama', role: 'Gaming YouTuber', avatar: 'R', color: '#FF0000', text: 'Channel gaming saya dari 500 subscriber sekarang udah 12K. Order gampang, tinggal masukin link dan pilih paket!' },
                    { name: 'Fitri Handayani', role: 'Online Shop · Facebook', avatar: 'F', color: '#1877F2', text: 'Page likes toko online saya naik dan otomatis terlihat lebih terpercaya di mata calon pembeli. Penjualan meningkat!' },
                    { name: 'Dimas Arya', role: 'Musisi · TikTok & Spotify', avatar: 'D', color: '#000000', text: 'Pakai untuk boost TikTok dan Spotify sekaligus. Hasilnya konsisten dan tidak ada drop sama sekali setelah 2 bulan.' },
                  ]
                }
              ].map((col, ci) => (
                <div key={ci} className={ci > 0 ? 'hide-mobile' : ''} style={{ overflow: 'hidden', height: '100%' }}>
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 14,
                    animation: `scrollUp${col.speed} ${col.speed}s linear infinite`,
                  }}>
                    {col.items.map((t, i) => (
                      <div key={i} className="card" style={{ padding: '20px 18px', flexShrink: 0 }}>
                        {/* Text first */}
                        <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 16 }}>{t.text}</p>
                        {/* Avatar bottom */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{t.avatar}</div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{t.name}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t.role}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

          </div>
          <style dangerouslySetInnerHTML={{
            __html: `
          @keyframes scrollUp35 { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
          @keyframes scrollUp50 { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
          @keyframes scrollUp42 { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
          @keyframes blobFloat {
            0%, 100% { transform: translateY(0) scale(1); }
            33% { transform: translateY(-18px) scale(1.03); }
            66% { transform: translateY(10px) scale(0.97); }
          }
          html { scroll-behavior: smooth; }
          .hero-btn-main:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 12px 32px rgba(37,99,235,.45) !important; }
          .feature-card { 
            background: var(--white); border: 1px solid var(--border); border-radius: 20px; padding: 28px 24px;
            transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease, border-color 0.3s ease;
          }
          .feature-card:hover { transform: translateY(-6px) scale(1.01); box-shadow: 0 20px 48px rgba(37,99,235,.12); border-color: rgba(37,99,235,.2); }
          @media (max-width: 600px) {
            .svc-table th, .svc-table td { padding-left: 10px !important; padding-right: 10px !important; padding-top: 12px !important; padding-bottom: 12px !important; }
            .svc-table td > div { font-size: 12px !important; gap: 8px !important; }
            .svc-table td > div > div { width: 26px !important; height: 26px !important; border-radius: 7px !important; }
            .svc-table td span { font-size: 14px !important; }
          }
        ` }} />
        </div>



      </RevealSection>

      <RevealSection variant="scale" delay={50} duration={750}>
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 1160, margin: '0 auto', padding: '0 16px 60px' }}>
          <div style={{ background: 'var(--blue)', borderRadius: 28, padding: 'clamp(32px, 6vw, 64px) clamp(20px, 5vw, 48px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            {/* inner deco */}
            <div style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -80, left: -40, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.15)', borderRadius: 50, padding: '5px 14px', fontSize: 11.5, fontWeight: 700, color: '#fff', marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%' }}>
                <Sparkles size={12} /> Mulai dari Rp 1/K · Tanpa kontrak · Cancel kapan saja
              </div>
              <h2 style={{ fontSize: 'clamp(24px, 6vw, 44px)', fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-.5px', lineHeight: 1.15 }}>Siap meningkatkan<br />jangkauan kamu?</h2>
              <p style={{ fontSize: 'clamp(13px, 3vw, 16px)', color: 'rgba(255,255,255,.75)', marginBottom: 32, maxWidth: 420, margin: '0 auto 32px', lineHeight: 1.7 }}>Bergabung dengan 50.000+ kreator yang sudah menggunakan SuntikSosmed setiap hari.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => router.push('/register')} style={{ background: '#fff', border: 'none', borderRadius: 50, padding: '12px 28px', fontSize: 'clamp(13px, 3vw, 15px)', fontWeight: 800, color: 'var(--blue)', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 32px rgba(0,0,0,.2)', transition: 'transform .2s' }}>
                  Mulai Sekarang <ArrowRight size={16} />
                </button>
                <button onClick={() => router.push('/login')} style={{ background: 'rgba(255,255,255,.15)', border: '1.5px solid rgba(255,255,255,.3)', borderRadius: 50, padding: '12px 24px', fontSize: 'clamp(13px, 3vw, 15px)', fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", backdropFilter: 'blur(8px)' }}>
                  Sign In
                </button>
              </div>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
                {[<CheckCircle key="a" size={13} />, <CheckCircle key="b" size={13} />, <Lock key="c" size={13} />].map((ic, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,.75)', fontWeight: 600 }}>
                    {ic} {['Tanpa kontrak', 'Pengiriman instan', '100% aman'][i]}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </RevealSection>

      {/* ── FOOTER ── */}
      <footer id="footer" style={{ background: 'var(--white)', borderTop: '1px solid var(--border)', padding: '28px 16px 20px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={14} style={{ color: '#fff' }} strokeWidth={2.5} />
              </div>
              Suntik<span style={{ color: 'var(--blue)' }}>Sosmed</span>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {/* TODO: ganti id target / href ke halaman asli kalau sudah ada (Syarat, Privasi, Docs API) */}
              {['Syarat Layanan', 'Kebijakan Privasi', 'Dokumentasi API'].map(t => (
                <a key={t} href="#panduan"
                  onClick={e => { e.preventDefault(); document.getElementById('panduan')?.scrollIntoView({ behavior: 'smooth' }); }}
                  style={{ color: 'var(--text3)', textDecoration: 'none', fontSize: 12, fontWeight: 500, transition: 'color .15s', cursor: 'pointer' }}>{t}</a>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <p style={{ color: 'var(--text3)', fontSize: 11.5 }}>© 2026 SuntikSosmed.com. Hak cipta dilindungi.</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {/* TODO: isi URL sosial media asli di bawah ini */}
              {[
                { ic: <Instagram key="ig" size={14} />, url: '' },
                { ic: <Youtube key="yt" size={14} />, url: '' },
                { ic: <Twitter key="tw" size={14} />, url: '' },
                { ic: <Facebook key="fb" size={14} />, url: '' },
              ].map(({ ic, url }, i) => (
                <a key={i} href={url || undefined} target={url ? '_blank' : undefined} rel={url ? 'noreferrer' : undefined}
                  onClick={e => { if (!url) e.preventDefault(); }}
                  style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', textDecoration: 'none', cursor: url ? 'pointer' : 'default' }}>{ic}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}