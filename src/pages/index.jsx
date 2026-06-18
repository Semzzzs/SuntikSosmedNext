import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';
import {
  Target, Moon, Sun, ArrowRight, UserPlus, Wallet, ShoppingCart,
  Instagram, Youtube, Twitter, Facebook, Play, Star, Sparkles,
  ShieldCheck, TrendingUp, CheckCircle, Zap, Globe, Lock, Search, ChevronDown,
  Menu, X, Home, LayoutGrid, HelpCircle,
  Briefcase, Store, Music, Repeat, RefreshCw
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

// ── Easing curves ──────────────────────────────────────────────
const EASE = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',       // expo-out — snappy masuk, smooth keluar
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // spring — sedikit overshoot
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',      // material — halus
};

// ── CountUp: angka berhitung naik saat mount ───────────────────
function CountUp({ end, duration = 2000, decimals = 0, prefix = '', suffix = '' }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Hormati reduced-motion: langsung tampilkan nilai akhir tanpa animasi
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setVal(end); return; }

    let raf, start, hasRun = false;
    const run = () => {
      const step = (ts) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(end * eased);
        if (p < 1) raf = requestAnimationFrame(step);
        else setVal(end);
      };
      raf = requestAnimationFrame(step);
    };

    // Mulai berhitung saat masuk viewport (sekali saja)
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !hasRun) {
        hasRun = true;
        run();
        obs.unobserve(el);
      }
    }, { threshold: 0.4 });
    obs.observe(el);

    return () => { cancelAnimationFrame(raf); obs.disconnect(); };
  }, [end, duration]);
  const display = decimals > 0
    ? val.toFixed(decimals)
    : Math.round(val).toLocaleString('id-ID');
  return <span ref={ref}>{prefix}{display}{suffix}</span>;
}

// ── RevealSection: animasi saat masuk viewport ─────────────────
// variant: 'up' | 'down' | 'left' | 'right' | 'scale' | 'fade'
// stagger: jarak delay antar direct children (ms)
function RevealSection({ children, delay = 0, duration = 850, variant = 'up', stagger = 0, className = '', style = {} }) {
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

    // Reduced motion: tampilkan langsung, lewati semua animasi
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.style.opacity = '1';
      el.style.transform = 'none';
      Array.from(el.children).forEach(c => { c.style.opacity = '1'; c.style.transform = 'none'; });
      return;
    }

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
  { icon: <Globe size={22} />, iconBg: 'var(--blue-l)', iconColor: 'var(--blue)', title: 'Support 24/7', desc: 'Tim kami selalu siap membantu kapanpun, siang maupun malam.' },
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

// ── Data testimoni ──
const TESTI_COLUMNS = [
  {
    speed: 35,
    items: [
      { name: 'Rina Maharani', role: 'Content Creator · Instagram', avatar: 'R', color: '#E1306C', text: 'Followers Instagram saya naik dari 2K ke 15K dalam sebulan. Kualitasnya beneran bagus, engagement juga ikut naik!' },
      { name: 'Budi Santoso', role: 'UMKM Owner · TikTok', avatar: 'B', color: '#000000', text: 'Awalnya ragu, tapi setelah coba TikTok Views hasilnya memuaskan. Video saya jadi masuk FYP dan penjualan naik signifikan.' },
      { name: 'Dewi Permata', role: 'Influencer · YouTube', avatar: 'D', color: '#FF0000', text: 'Subscribe YouTube saya nambah 5000 dalam seminggu. Proses order mudah dan saldo bisa top up via QRIS, praktis!' },
    ],
  },
  {
    speed: 50,
    items: [
      { name: 'Agus Firmansyah', role: 'Digital Marketer · Twitter', avatar: 'A', color: '#1DA1F2', text: 'Retweet dan likes Twitter naik drastis. Client saya senang banget karena campaign mereka jadi viral. Recommended!' },
      { name: 'Sari Indah', role: 'Artis Lokal · Spotify', avatar: 'S', color: '#1DB954', text: 'Plays Spotify lagu saya melonjak setelah pakai SuntikSosmed. Sekarang lagu saya masuk beberapa playlist editorial!' },
      { name: 'Kevin Wijaya', role: 'Startup Founder · LinkedIn', avatar: 'K', color: '#0A66C2', text: 'Dashboard-nya simple dan informatif. Bisa pantau progress order real-time. Customer support juga responsif.' },
      { name: 'Maya Putri', role: 'Beauty Influencer · Instagram', avatar: 'M', color: '#E1306C', text: 'Udah coba beberapa SMM panel, SuntikSosmed yang paling worth it. Harga terjangkau, followers real, dan gak drop!' },
    ],
  },
  {
    speed: 42,
    items: [
      { name: 'Reza Pratama', role: 'Gaming YouTuber', avatar: 'R', color: '#FF0000', text: 'Channel gaming saya dari 500 subscriber sekarang udah 12K. Order gampang, tinggal masukin link dan pilih paket!' },
      { name: 'Fitri Handayani', role: 'Online Shop · Facebook', avatar: 'F', color: '#1877F2', text: 'Page likes toko online saya naik dan otomatis terlihat lebih terpercaya di mata calon pembeli. Penjualan meningkat!' },
      { name: 'Dimas Arya', role: 'Musisi · TikTok & Spotify', avatar: 'D', color: '#000000', text: 'Pakai untuk boost TikTok dan Spotify sekaligus. Hasilnya konsisten dan tidak ada drop sama sekali setelah 2 bulan.' },
    ],
  },
];
// Daftar datar untuk carousel mobile
const TESTI_FLAT = TESTI_COLUMNS.flatMap(c => c.items);

// ── Ikon brand yang tidak ada di lucide ──
const WhatsAppIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9l-5.05.9" />
    <path d="M9 10a.5.5 0 0 0 1 0v-1a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
  </svg>
);
const TikTokIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 7.917v4.034a9.948 9.948 0 0 1-5-1.951v4.5a6.5 6.5 0 1 1-8-6.326v4.326a2.5 2.5 0 1 0 4 2v-11.5h4.083a6.005 6.005 0 0 0 4.917 4.917z" />
  </svg>
);

// ── Akun sosial media ──
const SOCIALS = [
  { id: 'ig', label: 'Instagram', url: 'https://instagram.com/suntiksosmed.storee' },
  { id: 'wa', label: 'WhatsApp', url: 'https://wa.me/6283843306230' },
  { id: 'tt', label: 'TikTok', url: 'https://tiktok.com/@suntiksosmedstore' },
];
const socialIcon = (id, size) =>
  id === 'ig' ? <Instagram size={size} /> : id === 'wa' ? <WhatsAppIcon size={size} /> : <TikTokIcon size={size} />;

const FAQS = [
  { q: 'Apa itu SuntikSosmed?', a: 'SuntikSosmed adalah platform SMM (Social Media Marketing) yang menyediakan layanan tambah followers, likes, views, komentar, dan engagement untuk Instagram, TikTok, YouTube, Facebook, Twitter/X, Telegram, Spotify, dan media sosial lainnya. Harga mulai dari Rp1 per 1.000, dengan lebih dari 2.000 pilihan layanan dan proses otomatis 24 jam.' },
  { q: 'Bagaimana cara order?', a: 'Cukup 4 langkah: (1) Daftar akun gratis, (2) Top up saldo lewat QRIS, (3) Pilih layanan yang kamu mau lalu masukkan link atau username target beserta jumlahnya, (4) Klik order. Pesanan langsung masuk antrian dan diproses otomatis tanpa perlu menunggu konfirmasi manual.' },
  { q: 'Berapa lama pesanan selesai?', a: 'Kecepatan tergantung jenis layanan dan antrian sistem. Sebagian besar pesanan mulai diproses dalam hitungan menit setelah order dibuat, namun ada juga layanan yang butuh waktu lebih lama tergantung jumlah dan jenisnya. Kamu bisa memantau progres pesanan secara real-time di halaman "My Orders".' },
  { q: 'Apakah aman untuk akun saya?', a: 'Aman. Kami tidak pernah meminta password atau akses login ke akun media sosial kamu — cukup link postingan atau username yang bersifat publik. Pastikan akun kamu tidak dalam mode privat saat order agar layanan dapat diproses dengan benar.' },
  { q: 'Metode pembayaran apa saja yang didukung?', a: 'Top up saldo dilakukan lewat QRIS, yang bisa dibayar dari hampir semua bank dan e-wallet di Indonesia: DANA, OVO, GoPay, ShopeePay, LinkAja, BCA, BNI, BRI, Mandiri, dan lainnya. Setelah pembayaran berhasil, saldo masuk otomatis ke akun kamu secara instan.' },
  { q: 'Berapa minimum deposit?', a: 'Minimum deposit sangat terjangkau, mulai dari Rp5.000. Saldo yang kamu top up bisa dipakai untuk order layanan apa saja sesuai kebutuhan, tanpa masa kedaluwarsa.' },
  { q: 'Apakah ada garansi refill?', a: 'Banyak layanan kami dilengkapi garansi refill — artinya jika followers atau likes berkurang (drop) dalam periode garansi, kamu bisa mengajukan refill gratis. Ketersediaan dan durasi garansi tertera jelas di setiap layanan saat kamu memilihnya sebelum order.' },
  { q: 'Apakah followers/likes-nya real?', a: 'Kami menyediakan berbagai kualitas layanan, dari yang reguler hingga premium dengan akun berkualitas tinggi (HQ/real-looking). Kualitas dan karakteristik tiap layanan dijelaskan pada nama dan deskripsi layanan, jadi kamu bisa memilih sesuai kebutuhan dan budget.' },
  { q: 'Bagaimana kalau pesanan bermasalah?', a: 'Jika ada kendala dengan pesanan, kamu bisa menghubungi tim support kami lewat fitur Tickets di dashboard, atau lewat kontak yang tersedia. Kami berusaha merespons dan membantu menyelesaikan setiap kendala secepat mungkin.' },
  { q: 'Apakah bisa untuk reseller?', a: 'Bisa. Dengan harga modal yang murah dan saldo deposit, banyak pengguna kami menjadikan SuntikSosmed sebagai sumber untuk usaha reseller jasa SMM mereka sendiri. Semakin sering order, semakin hemat.' },
];

// ── Kartu testimoni ──
function TestiCard({ t, dark }) {
  return (
    <div className="card" style={{ padding: '22px 20px', position: 'relative', overflow: 'hidden', height: '100%', background: dark ? 'var(--bg2)' : 'var(--white)', border: dark ? '1px solid var(--border2)' : '1px solid var(--border)', borderRadius: 18 }}>
      <div aria-hidden style={{ position: 'absolute', top: 6, right: 16, fontSize: 56, lineHeight: 1, fontFamily: 'Georgia, serif', color: dark ? 'rgba(255,255,255,.05)' : 'rgba(37,99,235,.08)', pointerEvents: 'none' }}>{'\u201D'}</div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
        {[0, 1, 2, 3, 4].map(i => <Star key={i} size={13} fill="#F59E0B" style={{ color: '#F59E0B' }} />)}
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 18, position: 'relative' }}>{t.text}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: t.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{t.avatar}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{t.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t.role}</div>
        </div>
      </div>
    </div>
  );
}

// ── FAQ accordion item ──
function FaqItem({ q, a, dark }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: 'var(--white)', border: `1px solid ${open ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color .2s' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', padding: '18px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: "'Outfit','Plus Jakarta Sans',sans-serif" }}>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{q}</span>
        <ChevronDown size={18} style={{ color: open ? 'var(--blue)' : 'var(--text3)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .25s' }} />
      </button>
      <div style={{ maxHeight: open ? 300 : 0, overflow: 'hidden', transition: 'max-height .3s ease' }}>
        <p style={{ padding: '0 20px 18px', fontSize: 13.5, lineHeight: 1.7, color: 'var(--text2)' }}>{a}</p>
      </div>
    </div>
  );
}

export default function Landing() {
  const router = useRouter();
  const { dark, toggle } = useTheme();

  // ✅ Kalau user udah login dan buka root (/), lempar ke /dashboard.
  //    Landing TETAP di-render (aman buat SSR/SEO) — redirect jalan di useEffect.
  //    User login cuma lihat landing sekejap sebelum ke-redirect (getSession instan).
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (alive && session?.user) router.replace('/dashboard');
    }).catch(() => { });
    return () => { alive = false; };
  }, [router]);

  const navScrolled = useNavbarScroll();
  const [serviceQuery, setServiceQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  // Kunci scroll body saat drawer mobile terbuka
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const NAV_LINKS = [
    { label: 'Beranda', id: 'hero', icon: <Home size={17} /> },
    { label: 'Layanan', id: 'layanan', href: '/layanan', icon: <LayoutGrid size={17} /> },
    { label: 'Panduan', id: 'panduan', icon: <Zap size={17} /> },
    { label: 'Testimoni', id: 'testimoni', icon: <Star size={17} /> },
    { label: 'FAQ', id: 'faq', icon: <HelpCircle size={17} /> },
  ];
  const goTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  // Scroll-spy: tandai section yang sedang dilihat
  const [activeSection, setActiveSection] = useState('hero');
  useEffect(() => {
    const ids = ['hero', 'layanan', 'panduan', 'testimoni', 'faq'];
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); }),
      { rootMargin: '-45% 0px -45% 0px' }
    );
    ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  // ── Spotlight: update posisi glow mengikuti kursor (desktop only) ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(hover: none)').matches) return; // skip di touch device
    let raf = null;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--spot-x', e.clientX + 'px');
        document.documentElement.style.setProperty('--spot-y', e.clientY + 'px');
        raf = null;
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { window.removeEventListener('mousemove', onMove); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // ── Reading progress bar ──
  const [scrollPct, setScrollPct] = useState(0);
  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
        setScrollPct(pct);
        raf = null;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // ── Spotlight per-kartu: set posisi kursor relatif ke tiap kartu ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(hover: none)').matches) return;
    const onMove = (e) => {
      const card = e.target.closest?.('.spotlight-card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('mousemove', onMove, { passive: true });
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  const filteredServices = SERVICES.filter(sv => {
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return true;
    return sv.name.toLowerCase().includes(q) || sv.id.includes(q);
  });

  return (
    <div className={`root${dark ? ' dark' : ''}`} style={{ minHeight: '100vh', overflow: 'hidden' }}>

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: FAQS.map(f => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            }),
          }}
        />
      </Head>

      {/* ── Reading progress bar ── */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 9999, pointerEvents: 'none' }}>
        <div style={{ height: '100%', width: `${scrollPct}%`, background: 'linear-gradient(90deg, var(--blue), #60A5FA)', boxShadow: '0 0 8px rgba(37,99,235,.5)', transition: 'width .1s linear' }} />
      </div>

      {/* ── BLOB BG ── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {/* Light mode: richer gradient base */}
        {!dark && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #EAF1FF 0%, #F4F8FF 45%, #EAF2FF 100%)' }} />}
        {/* Dark mode: central hero glow ala fintech landing — kuat & terpusat di atas */}
        {dark && <div style={{ position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)', width: 1100, height: 700, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(37,99,235,.22) 0%, rgba(37,99,235,.08) 35%, transparent 65%)', filter: 'blur(20px)' }} />}
        <div style={{ position: 'absolute', top: -120, left: -100, width: 600, height: 600, borderRadius: '50%', background: dark ? 'radial-gradient(circle, rgba(37,99,235,.16) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(37,99,235,.18) 0%, transparent 65%)', animation: 'blobFloat 12s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: 200, right: -150, width: 500, height: 500, borderRadius: '50%', background: dark ? 'radial-gradient(circle, rgba(59,130,246,.12) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(59,130,246,.16) 0%, transparent 65%)', animation: 'blobFloat 15s ease-in-out 2s infinite' }} />
        <div style={{ position: 'absolute', bottom: -100, left: '30%', width: 400, height: 400, borderRadius: '50%', background: dark ? 'radial-gradient(circle, rgba(99,102,241,.08) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(59,130,246,.1) 0%, transparent 65%)', animation: 'blobFloat 10s ease-in-out 4s infinite' }} />
        {/* Extra light mode accent blob */}
        {!dark && <div style={{ position: 'absolute', top: '40%', left: '20%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,.1) 0%, transparent 70%)', animation: 'blobFloat 18s ease-in-out 3s infinite' }} />}
        <div className="hero-grid" />
        {/* ── Subtle noise/grain texture — bikin background terasa premium, bukan flat ── */}
        <div className="hero-noise" />
        {/* ── Spotlight mengikuti kursor (desktop) — efek glow halus di belakang konten ── */}
        <div className="hero-spotlight" />
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
          <div className="nav-desktop-only" style={{ alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600 }}>
            {NAV_LINKS.map(({ label, id, href }) => (
              href ? (
                <Link key={label} href={href}
                  style={{ color: 'var(--text2)', textDecoration: 'none', padding: '7px 16px', borderRadius: 50, background: 'transparent', transition: 'background .15s', cursor: 'pointer' }}>{label}</Link>
              ) : (
                <a key={label} href={`#${id}`}
                  onClick={e => { e.preventDefault(); goTo(id); }}
                  style={{ color: 'var(--text2)', textDecoration: 'none', padding: '7px 16px', borderRadius: 50, background: 'transparent', transition: 'background .15s', cursor: 'pointer' }}>{label}</a>
              )
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button onClick={toggle} aria-label="Ganti tema" className="nav-icon-btn" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 11, flexShrink: 0 }}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="nav-desktop-only" style={{ alignItems: 'center', gap: 6 }}>
              <button onClick={() => router.push('/login')} style={{ background: 'none', border: '1.5px solid var(--border)', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: 'var(--text2)', fontFamily: "'Outfit','Plus Jakarta Sans',sans-serif", padding: '6px 12px', borderRadius: 50, whiteSpace: 'nowrap', transition: 'all .15s' }}>
                Masuk
              </button>
              <button onClick={() => router.push('/register')} style={{ background: 'var(--blue)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: '#fff', fontFamily: "'Outfit','Plus Jakarta Sans',sans-serif", padding: '6px 12px', borderRadius: 50, whiteSpace: 'nowrap', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 4 }}>
                Daftar
              </button>
            </div>
            <button className="nav-mobile-only nav-icon-btn" aria-label="Buka menu" onClick={() => setMenuOpen(true)} style={{ background: 'var(--blue-l)', border: '1px solid rgba(37,99,235,.22)', cursor: 'pointer', color: 'var(--blue)', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 11, flexShrink: 0 }}>
              <Menu size={19} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── MOBILE DRAWER ── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: menuOpen ? 'auto' : 'none' }}>
        {/* Backdrop */}
        <div onClick={() => setMenuOpen(false)}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', opacity: menuOpen ? 1 : 0, transition: 'opacity .3s ease' }} />
        {/* Panel */}
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(82vw, 320px)',
          background: 'var(--white)', borderLeft: '1px solid var(--border)',
          transform: menuOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .32s cubic-bezier(0.16,1,0.3,1)',
          display: 'flex', flexDirection: 'column', padding: '16px 14px',
          boxShadow: '-16px 0 48px rgba(0,0,0,.28)',
          paddingTop: 'calc(16px + env(safe-area-inset-top))',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          fontFamily: "'Outfit', sans-serif",
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>
              <img src="/logo.png" alt="SS" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover' }} />
              <span>Suntik<span style={{ color: 'var(--blue)' }}>Sosmed</span></span>
            </div>
            <button onClick={() => setMenuOpen(false)} aria-label="Tutup menu"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)' }}>
              <X size={18} />
            </button>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 14 }}>
            {NAV_LINKS.map(({ label, id, icon, href }) => {
              const active = activeSection === id;
              const inner = (
                <>
                  <span style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: active ? 'var(--blue)' : 'var(--bg2)', color: active ? '#fff' : 'var(--text3)', transition: 'all .18s' }}>{icon}</span>
                  {label}
                  {active && <ArrowRight size={15} style={{ marginLeft: 'auto', color: 'var(--blue)' }} />}
                </>
              );
              const linkStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, textDecoration: 'none', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', transition: 'all .18s', background: active ? 'var(--blue-l)' : 'transparent', color: active ? 'var(--blue)' : 'var(--text2)' };
              return href ? (
                <Link key={label} href={href} onClick={() => setMenuOpen(false)} style={linkStyle}>
                  {inner}
                </Link>
              ) : (
                <a key={label} href={`#${id}`} onClick={e => { e.preventDefault(); goTo(id); }}
                  style={linkStyle}>
                  {inner}
                </a>
              );
            })}
          </div>

          {/* Kartu sosial-proof */}
          <div style={{ marginTop: 16, background: dark ? 'var(--bg2)' : 'linear-gradient(135deg,#EEF4FF,#E0EAFF)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              {[0, 1, 2, 3, 4].map(i => <Star key={i} size={13} fill="#F59E0B" style={{ color: '#F59E0B' }} />)}
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)', marginLeft: 4 }}>4.8/5</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 600, lineHeight: 1.5 }}>Panel SMM otomatis — cepat, aman, & terjangkau untuk semua.</div>
          </div>

          {/* Sosial media */}
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 18 }}>
            {SOCIALS.map(s => (
              <a key={s.id} href={s.url} target="_blank" rel="noreferrer" aria-label={s.label}
                style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', textDecoration: 'none', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--blue)'; e.currentTarget.style.borderColor = 'rgba(37,99,235,.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                {socialIcon(s.id, 16)}
              </a>
            ))}
          </div>

          {/* CTA bawah */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 14, marginTop: 14, borderTop: '1px solid var(--border)' }}>
            <button onClick={() => { setMenuOpen(false); router.push('/login'); }}
              style={{ width: '100%', background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 50, padding: '11px', fontSize: 13.5, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
              Masuk
            </button>
            <button onClick={() => { setMenuOpen(false); router.push('/register'); }}
              style={{ width: '100%', background: 'var(--blue)', border: 'none', borderRadius: 50, padding: '11px', fontSize: 13.5, fontWeight: 800, color: '#fff', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 16px rgba(37,99,235,.35)' }}>
              <UserPlus size={14} /> Daftar Sekarang Gratis
            </button>
          </div>
        </div>
      </div>

      {/* ── HERO ── */}
      <div id="hero" style={{ position: 'relative', zIndex: 10, maxWidth: 1160, margin: '0 auto', padding: '40px 16px 0' }}>

        {/* Center hero text */}
        <div className="fu" style={{ textAlign: 'center', padding: '0', position: 'relative', maxWidth: 700, margin: '0 auto' }}>
          {/* Badge */}
          <div className="hero-badge" style={{
            display: 'inline-flex', alignItems: 'center', gap: 9,
            background: dark
              ? 'linear-gradient(135deg, rgba(37,99,235,.20), rgba(37,99,235,.07))'
              : 'linear-gradient(135deg, #FFFFFF, #EAF1FF)',
            border: dark ? '1px solid rgba(96,165,250,.28)' : '1px solid rgba(37,99,235,.24)',
            borderRadius: 30, padding: '4px 13px 4px 4px',
            fontSize: 12, fontWeight: 700, marginBottom: 24,
            boxShadow: dark
              ? '0 4px 22px rgba(37,99,235,.24), inset 0 1px 0 rgba(255,255,255,.06)'
              : '0 6px 22px rgba(37,99,235,.20), inset 0 1px 0 rgba(255,255,255,.9)',
          }}>
            <span className="badge-shine" aria-hidden />
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              color: '#fff', borderRadius: 30, padding: '4px 11px', fontSize: 11,
              boxShadow: '0 2px 9px rgba(37,99,235,.45), inset 0 1px 0 rgba(255,255,255,.28)',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <span className="badge-dot" aria-hidden />
              Termurah!
            </span>
            <span style={{ color: dark ? '#93C5FD' : 'var(--blue)' }}>Panel SMM Terpercaya</span>
            <ArrowRight className="badge-chevron" size={13} style={{ color: dark ? '#93C5FD' : 'var(--blue)', flexShrink: 0 }} />
          </div>

          <h1 style={{ fontSize: 'clamp(34px, 8.5vw, 56px)', fontWeight: 800, textShadow: dark ? 'none' : '0 2px 8px rgba(37,99,235,.08)', lineHeight: 1.1, color: 'var(--text)', marginBottom: 18, letterSpacing: '-1.5px' }}>
            Bikin Sosmed Kamu<br /><span className="grad-text">Meledak</span> Hari Ini
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 16, lineHeight: 1.7, marginBottom: 28, maxWidth: 480, margin: '0 auto 28px' }}>
            Followers, likes, dan views buat semua media sosial. Proses kilat, harga mulai <b style={{ color: 'var(--text)' }}>Rp 1 Perak</b>, garansi refill &amp; support 24 jam.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 36, flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/register')} className="hero-cta hero-cta-main" style={{ background: 'var(--blue)', border: 'none', borderRadius: 50, padding: '13px 26px', fontSize: 14.5, fontWeight: 800, color: '#fff', cursor: 'pointer', fontFamily: "'Outfit','Plus Jakarta Sans',sans-serif", display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 30px rgba(37,99,235,.5), 0 0 0 1px rgba(59,130,246,.3)', transition: 'transform .2s, box-shadow .2s', width: 'fit-content' }}>
              Daftar Sekarang Gratis! <UserPlus size={15} />
            </button>
            <button onClick={() => router.push('/login')} className="hero-cta-sub" style={{ background: 'var(--white)', border: '1.5px solid var(--border)', borderRadius: 50, padding: '13px 26px', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', color: 'var(--text)', fontFamily: "'Outfit','Plus Jakarta Sans',sans-serif", boxShadow: 'var(--shadow)', width: 'fit-content', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              Masuk
            </button>
          </div>

          {/* Stat counters — fakta platform, bukan klaim volume palsu */}
          <div className="hero-stats" style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(20px, 6vw, 56px)', marginBottom: 36, flexWrap: 'wrap' }}>
            {[
              { val: 2288, decimals: 0, suffix: '+', label: 'Layanan tersedia' },
              { val: 20, decimals: 0, prefix: '', suffix: '', label: 'Platform didukung' },
              { val: 1, decimals: 0, prefix: 'Rp ', suffix: ' Perak', label: 'Harga mulai dari' },
              { val: 24, decimals: 0, suffix: '/7', label: 'Proses & support' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(24px, 5vw, 34px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1.1 }} className="grad-text">
                  <CountUp end={s.val} decimals={s.decimals} prefix={s.prefix || ''} suffix={s.suffix} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Trust row — sinyal kepercayaan yang jujur (tanpa klaim review palsu) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 22, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)', fontWeight: 600 }}>
              <ShieldCheck size={15} style={{ color: 'var(--blue)' }} /> Pembayaran aman QRIS
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)', fontWeight: 600 }}>
              <Zap size={15} style={{ color: '#F59E0B' }} /> Proses otomatis & instan
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)', fontWeight: 600 }}>
              <CheckCircle size={15} style={{ color: '#10B981' }} /> Garansi refill
            </div>
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
          <div className="logo-marquee-wrap" style={{ marginBottom: 48 }}>
            <div className="logo-marquee" style={{ filter: 'grayscale(1)', opacity: 0.4 }}>
              {[...Array(2)].map((_, dup) => (
                <div key={dup} className="logo-marquee-track" aria-hidden={dup === 1}>
                  {[
                    { icon: <Youtube size={20} />, label: 'YouTube' },
                    { icon: <Twitter size={20} />, label: 'Twitter' },
                    { icon: <Instagram size={20} />, label: 'Instagram' },
                    { icon: <Play size={20} fill="currentColor" />, label: 'TikTok' },
                    { icon: <Facebook size={20} />, label: 'Facebook' },
                  ].map(p => (
                    <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>{p.icon} {p.label}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>



      {/* ── FEATURES ── */}
      <RevealSection variant="up" duration={850}>
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 1160, margin: '0 auto', padding: '0 16px 60px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-block', background: 'var(--blue)', border: 'none', borderRadius: 50, padding: '5px 16px', fontSize: 12.5, fontWeight: 700, color: '#fff', marginBottom: 14 }}>KENAPA SUNTIK SOSMED</div>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: 'var(--text)', marginBottom: 10, letterSpacing: '-.5px' }}>Dirancang untuk Pertumbuhan Nyata</h2>
            <p style={{ fontSize: 15, color: 'var(--text2)', maxWidth: 480, margin: '0 auto' }}>Semua yang kamu butuhkan untuk tumbuh — cepat, aman, dan terjangkau.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
            {FEATURES.map((f, i) => (
              <RevealSection key={i} delay={i * 120} variant="scale" duration={900}>
                <div className="feature-card spotlight-card">
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: f.iconBg, color: f.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, boxShadow: '0 6px 20px rgba(0,0,0,.15)' }}>{f.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--text)', marginBottom: 8 }}>{f.title}</div>
                  <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.65 }}>{f.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>

      </RevealSection>

      {/* ── UNTUK SIAPA ── */}
      <RevealSection variant="up" duration={850}>
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 1160, margin: '0 auto', padding: '0 16px 60px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,rgba(139,92,246,.12),rgba(139,92,246,.05))', border: '1px solid rgba(139,92,246,.25)', borderRadius: 50, padding: '5px 16px', fontSize: 12.5, fontWeight: 700, color: '#8B5CF6', marginBottom: 14 }}>UNTUK SIAPA</div>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 10 }}>Cocok untuk Siapa Saja</h2>
            <p style={{ fontSize: 15, color: 'var(--text2)', maxWidth: 480, margin: '0 auto' }}>Dari kreator pemula sampai pebisnis dan reseller — semua bisa tumbuh di sini.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { icon: <Star size={22} />, c: '#E1306C', bg: 'rgba(225,48,108,.1)', title: 'Influencer & Kreator', desc: 'Naikkan followers, likes, dan views biar konten makin dilirik brand dan masuk FYP.' },
              { icon: <Store size={22} />, c: '#10B981', bg: 'rgba(16,185,129,.1)', title: 'UMKM & Bisnis', desc: 'Bangun kredibilitas toko online — akun yang ramai bikin calon pembeli lebih percaya.' },
              { icon: <Repeat size={22} />, c: '#2563EB', bg: 'rgba(37,99,235,.1)', title: 'Reseller', desc: 'Harga modal murah + panel otomatis. Jual lagi ke klien kamu dengan markup sendiri.' },
              { icon: <Music size={22} />, c: '#1DB954', bg: 'rgba(29,185,84,.1)', title: 'Musisi & Artis', desc: 'Dongkrak plays Spotify, views YouTube, dan engagement biar karya makin terdengar.' },
            ].map((b, i) => (
              <RevealSection key={i} delay={i * 100} variant="scale" duration={850}>
                <div className="feature-card spotlight-card" style={{ height: '100%' }}>
                  <div style={{ width: 50, height: 50, borderRadius: 15, background: b.bg, color: b.c, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>{b.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--text)', marginBottom: 8 }}>{b.title}</div>
                  <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.65 }}>{b.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ── RESELLER ── */}
      <RevealSection variant="scale" duration={950}>
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 1160, margin: '0 auto', padding: '0 16px 60px' }}>
          <div className="reseller-card" style={{ position: 'relative', overflow: 'hidden', borderRadius: 28, padding: 'clamp(28px, 5vw, 52px)', background: dark ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' : 'linear-gradient(135deg, #EFF5FF 0%, #DBEAFE 100%)', border: '1px solid var(--border)' }}>
            <div style={{ position: 'absolute', top: -70, right: -50, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, alignItems: 'center', position: 'relative', zIndex: 1 }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--blue)', borderRadius: 50, padding: '5px 14px', fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                  <Briefcase size={13} /> PROGRAM RESELLER
                </div>
                <h2 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 12, lineHeight: 1.2 }}>Jadikan SuntikSosmed Sumber Bisnismu</h2>
                <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 22 }}>Beli dengan harga modal, jual lagi ke klien dengan harga kamu sendiri. Panel otomatis 24 jam, deposit fleksibel, dan ribuan layanan siap dijual. Makin sering order, makin hemat.</p>
                <button onClick={() => router.push('/register')} className="hero-btn-main">
                  Mulai Jadi Reseller <ArrowRight size={16} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { icon: <Wallet size={18} />, t: 'Harga Modal', d: 'Mulai Rp 1/K' },
                  { icon: <Zap size={18} />, t: 'Proses Otomatis', d: '24 jam non-stop' },
                  { icon: <LayoutGrid size={18} />, t: 'Ribuan Layanan', d: '2.000+ pilihan' },
                  { icon: <RefreshCw size={18} />, t: 'Garansi Refill', d: 'Banyak layanan' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 16px' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--blue-l)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>{s.icon}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{s.t}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{s.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </RevealSection>

      {/* ── KENAPA MURAH (bangun trust) ── */}
      <RevealSection variant="up" duration={900}>
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 1160, margin: '0 auto', padding: '0 16px 60px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-block', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 50, padding: '5px 16px', fontSize: 12.5, fontWeight: 700, color: '#10B981', marginBottom: 14 }}>TRANSPARAN</div>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 10 }}>Kenapa Harga Kami Bisa Semurah Ini?</h2>
            <p style={{ fontSize: 15, color: 'var(--text2)', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>Murah bukan berarti murahan. Ini alasan jujur kenapa kami bisa kasih harga terbaik tanpa mengorbankan kualitas.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {[
              { icon: <TrendingUp size={22} />, c: '#2563EB', bg: 'rgba(37,99,235,.1)', title: 'Skala Besar, Harga Efisien', desc: 'Volume order yang besar bikin biaya per layanan jadi lebih rendah — dan hematnya kami teruskan langsung ke kamu.' },
              { icon: <Zap size={22} />, c: '#F59E0B', bg: 'rgba(245,158,11,.1)', title: 'Sistem Otomatis Penuh', desc: 'Order diproses mesin 24 jam tanpa admin manual. Biaya operasional kecil, jadi harga bisa ditekan tanpa korbankan kualitas.' },
              { icon: <ShieldCheck size={22} />, c: '#10B981', bg: 'rgba(16,185,129,.1)', title: 'Tanpa Biaya Tersembunyi', desc: 'Harga yang kamu lihat itu harga final. Tidak ada markup mendadak, tidak ada jebakan saat checkout.' },
            ].map((b, i) => (
              <RevealSection key={i} delay={i * 110} variant="scale" duration={850}>
                <div className="feature-card spotlight-card" style={{ height: '100%' }}>
                  <div style={{ width: 50, height: 50, borderRadius: 15, background: b.bg, color: b.c, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>{b.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--text)', marginBottom: 8 }}>{b.title}</div>
                  <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.65 }}>{b.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </RevealSection>

      <RevealSection variant="fade" duration={800}>
        <div id="panduan" style={{ position: 'relative', zIndex: 10, padding: '48px 16px' }}>
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
                <RevealSection key={i} delay={i * 160} variant="up" duration={950}>
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
      <RevealSection variant="up" duration={950}>
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 1160, margin: '0 auto', padding: '48px 16px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-block', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 50, padding: '5px 16px', fontSize: 12.5, fontWeight: 700, color: '#F59E0B', marginBottom: 14 }}>LAYANAN POPULER</div>
            <h2 id="layanan" style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 10 }}>Jelajahi Layanan Kami</h2>
            <p style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 14 }}>Sekilas layanan terpopuler kami. Harga transparan, tanpa biaya tersembunyi.</p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.22)', borderRadius: 50, padding: '5px 14px', fontSize: 12.5, fontWeight: 700, color: '#10B981' }}>
              <span className="live-dot" /> Sistem online · proses 24 jam
            </div>
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
                        <button onClick={() => router.push('/register')} style={{ background: 'var(--blue-l)', border: 'none', borderRadius: 50, padding: '6px 16px', fontSize: 12.5, fontWeight: 700, color: '#4F46E5', cursor: 'pointer', fontFamily: "'Outfit','Plus Jakarta Sans',sans-serif" }}>Order</button>
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
              <button onClick={() => router.push('/register')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13.5, fontFamily: "'Outfit','Plus Jakarta Sans',sans-serif", display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--blue)' }}>
                <span onClick={() => router.push('/register')} style={{ cursor: 'pointer' }}>Lihat 2.000+ layanan — Daftar gratis <ArrowRight size={14} style={{ color: 'var(--blue)', display: 'inline-block', verticalAlign: 'middle' }} /></span>
              </button>
            </div>
          </div>
        </div>

        {/* ── TESTIMONIALS (Animated Scroll) ── */}
        <div id="testimoni" style={{ position: 'relative', zIndex: 10, padding: '80px 0', overflow: 'hidden' }}>
          {/* Blob decorations */}
          <div style={{ position: 'absolute', top: '10%', left: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,.08) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '40%', right: '-5%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,.07) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '10%', left: '30%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.06) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
          <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px', textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,rgba(37,99,235,.1),rgba(37,99,235,.05))', border: '1px solid rgba(37,99,235,.2)', borderRadius: 50, padding: '5px 16px', fontSize: 12.5, fontWeight: 700, color: 'var(--blue)', marginBottom: 14 }}>TESTIMONI</div>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 10 }}>Apa Kata Pengguna Kami</h2>
            <p style={{ fontSize: 15, color: 'var(--text2)' }}>Ribuan kreator dan bisnis sudah mempercayakan pertumbuhan sosial media mereka ke SuntikSosmed.</p>
          </div>

          {/* DESKTOP: 3 kolom berjalan · MOBILE: carousel geser */}
          <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px' }}>
            <div className="testi-desktop" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, height: 600, overflow: 'hidden', WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)', maskImage: 'linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)' }}>
              {TESTI_COLUMNS.map((col, ci) => (
                <div key={ci} style={{ overflow: 'hidden', height: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: `scrollUp${col.speed} ${col.speed}s linear infinite` }}>
                    {[...col.items, ...col.items].map((t, i) => (
                      <TestiCard key={i} t={t} dark={dark} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="testi-mobile" style={{ overflow: 'hidden', WebkitMaskImage: 'linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)', maskImage: 'linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)' }}>
              <div className="testi-marquee" style={{ display: 'flex', gap: 14, width: 'max-content', animation: 'scrollLeftTesti 42s linear infinite' }}>
                {[...TESTI_FLAT, ...TESTI_FLAT].map((t, i) => (
                  <div key={i} style={{ flex: '0 0 280px', width: 280 }}>
                    <TestiCard t={t} dark={dark} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <style dangerouslySetInnerHTML={{
            __html: `
          @keyframes scrollUp35 { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
          @keyframes scrollUp50 { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
          @keyframes scrollUp42 { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
          @keyframes scrollLeftTesti { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          .testi-marquee:hover, .testi-marquee:active { animation-play-state: paused; }

          /* ── Logo platform marquee — scroll infinite dengan fade di tepi ── */
          .logo-marquee-wrap {
            overflow: hidden; width: 100%;
            -webkit-mask-image: linear-gradient(to right, transparent, #000 12%, #000 88%, transparent);
            mask-image: linear-gradient(to right, transparent, #000 12%, #000 88%, transparent);
          }
          .logo-marquee { display: flex; width: max-content; animation: scrollLeftLogo 22s linear infinite; }
          .logo-marquee-track { display: flex; align-items: center; gap: 40px; padding-right: 40px; flex-shrink: 0; }
          @keyframes scrollLeftLogo { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          .logo-marquee:hover { animation-play-state: paused; }
          @media (prefers-reduced-motion: reduce) {
            .logo-marquee { animation: none; }
            .logo-marquee-wrap { -webkit-mask-image: none; mask-image: none; }
          }
          @keyframes blobFloat {
            0%, 100% { transform: translateY(0) scale(1); }
            33% { transform: translateY(-18px) scale(1.03); }
            66% { transform: translateY(10px) scale(0.97); }
          }
          @media (prefers-reduced-motion: reduce) {
            [style*="blobFloat"] { animation: none !important; }
            .testi-marquee,
            .testi-desktop [style*="scrollUp"] { animation: none !important; }
          }
          html { scroll-behavior: smooth; }
          .root h1, .root h2 { font-family: 'Sora','Plus Jakarta Sans',sans-serif; }
          /* Teks kecil/body landing pakai Outfit (judul tetap Sora di atas) */
          .root { font-family: 'Outfit','Plus Jakarta Sans',sans-serif; }

          /* ── Hero CTA hover ── */
          .hero-cta:hover {
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 12px 38px rgba(37,99,235,.6), 0 0 0 1px rgba(59,130,246,.4) !important;
          }
          .hero-cta:active { transform: translateY(0) scale(.99); }

          /* ── Hero stagger masuk saat load ── */
          @keyframes heroRise {
            from { opacity: 0; transform: translateY(22px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .fu > .hero-badge,
          .fu > h1,
          .fu > p,
          .fu > div {
            opacity: 0;
            animation: heroRise .75s cubic-bezier(0.16,1,0.3,1) forwards;
          }
          .fu > .hero-badge { animation-delay: .05s; }
          .fu > h1          { animation-delay: .15s; }
          .fu > p           { animation-delay: .27s; }
          .fu > div:nth-of-type(1) { animation-delay: .39s; } /* CTA row */
          .fu > div:nth-of-type(2) { animation-delay: .50s; } /* stats */
          .fu > div:nth-of-type(3) { animation-delay: .58s; } /* trust row */
          @media (prefers-reduced-motion: reduce) {
            .fu > .hero-badge, .fu > h1, .fu > p, .fu > div {
              opacity: 1 !important; animation: none !important; transform: none !important;
            }
          }

          /* ── Subtle grid pattern overlay (hero depth) ── */
          .hero-grid {
            position: absolute; inset: 0; pointer-events: none; z-index: 1;
            background-image:
              linear-gradient(to right, rgba(37,99,235,.06) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(37,99,235,.06) 1px, transparent 1px);
            background-size: 56px 56px;
            -webkit-mask-image: radial-gradient(ellipse 70% 55% at 50% 22%, #000 0%, transparent 75%);
            mask-image: radial-gradient(ellipse 70% 55% at 50% 22%, #000 0%, transparent 75%);
          }
          .root.dark .hero-grid {
            background-image:
              linear-gradient(to right, rgba(96,165,250,.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(96,165,250,.08) 1px, transparent 1px);
          }

          /* ── Noise/grain overlay — SVG turbulence (tanpa file gambar, sangat ringan) ── */
          .hero-noise {
            position: absolute; inset: 0; pointer-events: none; z-index: 2;
            opacity: .035;
            mix-blend-mode: multiply;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
            background-size: 200px 200px;
          }
          .root.dark .hero-noise {
            opacity: .04;
            mix-blend-mode: overlay;
          }

          /* ── Spotlight kursor — glow halus yang mengikuti mouse (desktop) ── */
          .hero-spotlight {
            position: fixed; inset: 0; pointer-events: none; z-index: 1;
            background: radial-gradient(
              340px circle at var(--spot-x, 50%) var(--spot-y, 18%),
              rgba(59,130,246,.10), transparent 70%
            );
            transition: background .12s ease-out;
          }
          .root.dark .hero-spotlight {
            background: radial-gradient(
              360px circle at var(--spot-x, 50%) var(--spot-y, 18%),
              rgba(96,165,250,.14), transparent 68%
            );
          }
          @media (hover: none) {
            .hero-spotlight { display: none; }
          }
          @media (prefers-reduced-motion: no-preference) {
            .hero-noise { will-change: auto; }
          }

          /* ── Hero announcement badge ── */
          .hero-badge {
            position: relative; overflow: hidden;
            transition: transform .25s cubic-bezier(0.34,1.56,0.64,1), box-shadow .25s ease, border-color .25s ease;
          }
          .hero-badge:hover {
            transform: translateY(-2px);
            border-color: rgba(37,99,235,.4) !important;
          }
          .hero-badge .badge-shine {
            position: absolute; top: 0; left: 0; width: 35%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(37,99,235,.20), transparent);
            transform: translateX(-130%) skewX(-20deg);
            animation: badgeShine 4.8s ease-in-out infinite; pointer-events: none;
          }
          .root.dark .hero-badge .badge-shine {
            background: linear-gradient(90deg, transparent, rgba(147,197,253,.32), transparent);
          }
          .badge-dot { position: relative; width: 7px; height: 7px; flex-shrink: 0; }
          .badge-dot::before, .badge-dot::after {
            content: ''; position: absolute; inset: 0; border-radius: 50%; background: #fff;
          }
          .badge-dot::before { animation: badgePulse 1.8s ease-in-out infinite; }
          .badge-dot::after  { animation: badgePing 1.8s cubic-bezier(0,0,.2,1) infinite; }
          .badge-chevron { transition: transform .25s ease; }
          .hero-badge:hover .badge-chevron { transform: translateX(3px); }
          @keyframes badgeShine {
            0% { transform: translateX(-130%) skewX(-20deg); }
            55%, 100% { transform: translateX(420%) skewX(-20deg); }
          }
          @keyframes badgePulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(.55); opacity: .6; }
          }
          @keyframes badgePing {
            0% { transform: scale(1); opacity: .55; }
            80%, 100% { transform: scale(2.6); opacity: 0; }
          }
          @media (max-width: 420px) {
            .hero-badge { font-size: 11px !important; gap: 7px !important; padding-right: 11px !important; }
            .hero-badge .badge-chevron { display: none; }
          }
          /* ── Tombol CTA hero — rapi & proporsional di mobile ── */
          @media (max-width: 600px) {
            .hero-cta-main, .hero-cta-sub {
              flex: 0 0 auto !important;
              width: auto !important;
              min-width: 0 !important;
              padding: 9px 16px !important;
              font-size: 12px !important;
              font-weight: 700 !important;
              white-space: nowrap !important;
              box-shadow: 0 4px 14px rgba(37,99,235,.3) !important;
            }
            .hero-cta-sub { box-shadow: none !important; }
            .hero-cta-main { gap: 5px !important; }
            .hero-cta-main svg, .hero-cta-sub svg { width: 12px !important; height: 12px !important; }
          }
          @media (max-width: 360px) {
            .hero-cta-main, .hero-cta-sub {
              padding: 8px 13px !important;
              font-size: 11.5px !important;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .hero-badge .badge-shine, .badge-dot::before, .badge-dot::after { animation: none; }
            .badge-dot::after { display: none; }
          }
          .nav-desktop-only { display: flex; }
          .nav-mobile-only { display: none; }
          .nav-icon-btn { transition: transform .12s ease, border-color .15s ease, background .15s ease; }
          .nav-icon-btn:hover { border-color: rgba(37,99,235,.45); }
          .nav-icon-btn:active { transform: scale(.92); }
          .testi-desktop { display: grid; }
          .testi-mobile { display: none; }
          @media (max-width: 768px) {
            .testi-desktop { display: none; }
            .testi-mobile { display: block; }
          }
          @media (max-width: 820px) {
            .nav-desktop-only { display: none !important; }
            .nav-mobile-only { display: flex !important; }
          }
          .hero-btn-main:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 12px 32px rgba(37,99,235,.45) !important; }
          .feature-card { 
            background: var(--white); border: 1px solid var(--border); border-radius: 20px; padding: 28px 24px;
            transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease, border-color 0.3s ease;
            position: relative;
          }
          /* Gradient border yang berputar saat hover — pakai pseudo-element + mask */
          .feature-card::before {
            content: ''; position: absolute; inset: 0; border-radius: 20px; padding: 1.5px;
            background: conic-gradient(from var(--angle, 0deg), transparent 60%, rgba(59,130,246,.9), rgba(96,165,250,.6), transparent 85%);
            -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            -webkit-mask-composite: xor; mask-composite: exclude;
            opacity: 0; transition: opacity .35s ease; pointer-events: none;
          }
          .feature-card:hover::before { opacity: 1; animation: cardBorderSpin 4s linear infinite; }
          @property --angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
          @keyframes cardBorderSpin { to { --angle: 360deg; } }
          .root.dark .feature-card { background: var(--bg2); border-color: var(--border2); }
          .feature-card:hover { transform: translateY(-6px) scale(1.01); box-shadow: 0 20px 48px rgba(37,99,235,.12); border-color: transparent; }
          @media (prefers-reduced-motion: reduce) {
            .feature-card:hover::before { animation: none; }
          }
          /* Live dot berkedut */
          .live-dot {
            width: 8px; height: 8px; border-radius: 50%; background: #10B981;
            box-shadow: 0 0 0 0 rgba(16,185,129,.6);
            animation: liveDotPulse 1.8s ease-out infinite;
            flex-shrink: 0;
          }
          @keyframes liveDotPulse {
            0% { box-shadow: 0 0 0 0 rgba(16,185,129,.55); }
            70% { box-shadow: 0 0 0 7px rgba(16,185,129,0); }
            100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
          }
          /* Spotlight per-kartu: glow halus mengikuti kursor di dalam kartu */
          .spotlight-card::after {
            content: ''; position: absolute; inset: 0; border-radius: 20px; pointer-events: none;
            opacity: 0; transition: opacity .3s ease;
            background: radial-gradient(220px circle at var(--mx, 50%) var(--my, 50%), rgba(59,130,246,.12), transparent 65%);
          }
          .spotlight-card:hover::after { opacity: 1; }
          @media (prefers-reduced-motion: reduce) {
            .live-dot { animation: none; }
          }
          @media (max-width: 600px) {
            .svc-table th, .svc-table td { padding-left: 10px !important; padding-right: 10px !important; padding-top: 12px !important; padding-bottom: 12px !important; }
            .svc-table td > div { font-size: 12px !important; gap: 8px !important; }
            .svc-table td > div > div { width: 26px !important; height: 26px !important; border-radius: 7px !important; }
            .svc-table td span { font-size: 14px !important; }
          }
        ` }} />
        </div>



      </RevealSection>

      {/* ── METODE PEMBAYARAN ── */}
      <RevealSection variant="up" duration={950}>
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 1160, margin: '0 auto', padding: '56px 16px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,rgba(16,185,129,.1),rgba(5,150,105,.1))', border: '1px solid rgba(16,185,129,.2)', borderRadius: 50, padding: '5px 16px', fontSize: 12.5, fontWeight: 700, color: '#10B981', marginBottom: 14 }}>PEMBAYARAN MUDAH</div>
            <h2 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 10 }}>Bayar Pakai Apa Aja</h2>
            <p style={{ fontSize: 15, color: 'var(--text2)', maxWidth: 520, margin: '0 auto' }}>Top up saldo lewat QRIS — bisa dibayar dari semua bank & e-wallet di Indonesia. Saldo masuk otomatis & instan.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, maxWidth: 760, margin: '0 auto' }}>
            {[
              { file: 'Qris', alt: 'QRIS' },
              { file: 'Dana', alt: 'DANA' },
              { file: 'Ovo', alt: 'OVO' },
              { file: 'Gopay', alt: 'GoPay' },
              { file: 'Shoppe', alt: 'ShopeePay' },
              { file: 'Linkaja', alt: 'LinkAja' },
              { file: 'Bca', alt: 'BCA' },
              { file: 'Bni', alt: 'BNI' },
              { file: 'Bri', alt: 'BRI' },
              { file: 'Mandiri', alt: 'Mandiri' },
            ].map(m => (
              <div key={m.file} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 104, height: 56, padding: '0 16px', background: '#fff', border: '1px solid var(--border)', borderRadius: 12, boxShadow: dark ? 'none' : '0 2px 10px rgba(37,99,235,.06)' }}>
                <img src={`/payments/${m.file}.png`} alt={m.alt} loading="lazy" style={{ maxWidth: '100%', maxHeight: 30, objectFit: 'contain' }} />
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ── FAQ ── */}
      <RevealSection variant="up" duration={950}>
        <div id="faq" style={{ position: 'relative', zIndex: 10, maxWidth: 760, margin: '0 auto', padding: '40px 16px 64px' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,rgba(37,99,235,.1),rgba(37,99,235,.05))', border: '1px solid rgba(37,99,235,.2)', borderRadius: 50, padding: '5px 16px', fontSize: 12.5, fontWeight: 700, color: 'var(--blue)', marginBottom: 14 }}>FAQ</div>
            <h2 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 10 }}>Pertanyaan Umum</h2>
            <p style={{ fontSize: 15, color: 'var(--text2)' }}>Hal-hal yang sering ditanyakan sebelum mulai order.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQS.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} dark={dark} />
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ── CTA PENUTUP ── */}
      <RevealSection variant="scale" delay={50} duration={1000}>
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
              <p style={{ fontSize: 'clamp(13px, 3vw, 16px)', color: 'rgba(255,255,255,.75)', marginBottom: 32, maxWidth: 420, margin: '0 auto 32px', lineHeight: 1.7 }}>Daftar gratis, top up saldo, dan langsung order ribuan layanan SMM dalam hitungan menit.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => router.push('/register')} style={{ background: '#fff', border: 'none', borderRadius: 50, padding: '12px 28px', fontSize: 'clamp(13px, 3vw, 15px)', fontWeight: 800, color: 'var(--blue)', cursor: 'pointer', fontFamily: "'Outfit','Plus Jakarta Sans',sans-serif", display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 32px rgba(0,0,0,.2)', transition: 'transform .2s' }}>
                  Mulai Sekarang <ArrowRight size={16} />
                </button>
                <button onClick={() => router.push('/login')} style={{ background: 'rgba(255,255,255,.15)', border: '1.5px solid rgba(255,255,255,.3)', borderRadius: 50, padding: '12px 24px', fontSize: 'clamp(13px, 3vw, 15px)', fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: "'Outfit','Plus Jakarta Sans',sans-serif", backdropFilter: 'blur(8px)' }}>
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
              {[
                { label: 'Layanan', id: 'layanan', href: '/layanan' },
                { label: 'Cara Kerja', id: 'panduan' },
                { label: 'FAQ', id: 'faq' },
              ].map(({ label, id, href }) => (
                href ? (
                  <Link key={label} href={href}
                    style={{ color: 'var(--text3)', textDecoration: 'none', fontSize: 12, fontWeight: 500, transition: 'color .15s', cursor: 'pointer' }}>{label}</Link>
                ) : (
                  <a key={label} href={`#${id}`}
                    onClick={e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}
                    style={{ color: 'var(--text3)', textDecoration: 'none', fontSize: 12, fontWeight: 500, transition: 'color .15s', cursor: 'pointer' }}>{label}</a>
                )
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <p style={{ color: 'var(--text3)', fontSize: 11.5 }}>© 2026 SuntikSosmed.com. Hak cipta dilindungi.</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {SOCIALS.map(s => (
                <a key={s.id} href={s.url} target="_blank" rel="noreferrer" aria-label={s.label}
                  style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', textDecoration: 'none', cursor: 'pointer' }}>{socialIcon(s.id, 14)}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}