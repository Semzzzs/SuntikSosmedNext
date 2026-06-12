// src/pages/layanan/index.jsx
//
// Halaman katalog /layanan — desain diselaraskan dengan landing page utama.
// Memakai pendekatan inline-style + CSS variable yang sama (bukan class landing-*),
// lengkap dengan navbar, animasi RevealSection saat scroll, blok CTA biru, dan footer.

import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
    Target, Moon, Sun, Menu, X, ArrowRight, ArrowUp, Sparkles,
    CheckCircle, Lock, Instagram, Youtube, Facebook, Send, Play,
    Zap, ShieldCheck, Wallet, Clock, Headphones, TrendingUp,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { LANDING_PAGES, LANDING_SLUGS } from '@/data/seo-landing-pages';

const SITE_URL = 'https://suntiksosmed.store';
const FONT = "'Outfit','Plus Jakarta Sans',sans-serif";

// ── Easing (sama dengan landing) ───────────────────────────────
const EASE = { out: 'cubic-bezier(0.16, 1, 0.3, 1)' };

// ── Data ───────────────────────────────────────────────────────
const NAV_LINKS = [
    { label: 'Beranda', href: '/' },
    { label: 'Layanan', href: '/layanan', active: true },
    { label: 'Cara Kerja', href: '/#panduan' },
    { label: 'FAQ', href: '/#faq' },
];

const STATS = [
    { end: 50000, suffix: '+', label: 'Pengguna aktif' },
    { end: 2000, suffix: '+', label: 'Pilihan layanan' },
    { end: 1, prefix: 'Rp', suffix: '/K', label: 'Harga mulai' },
    { end: 24, suffix: ' jam', label: 'Proses otomatis' },
];

const WHY_US = [
    {
        icon: Wallet,
        title: 'Harga Termurah se-Indonesia',
        desc: 'Harga mulai Rp1 per 1000 dengan sistem reseller. Kami ambil langsung dari provider Tier-1 dunia, jadi kamu dapat tarif paling kompetitif tanpa perantara berlapis.',
    },
    {
        icon: Zap,
        title: 'Proses Otomatis & Instan',
        desc: 'Pesanan diproses otomatis 24 jam nonstop. Sebagian besar layanan mulai berjalan dalam hitungan menit setelah pembayaran, tanpa perlu menunggu admin online.',
    },
    {
        icon: ShieldCheck,
        title: 'Aman & Bergaransi',
        desc: 'Layanan dikerjakan dengan metode yang aman untuk akunmu, tanpa perlu password. Tersedia garansi refill untuk layanan tertentu jika terjadi penurunan.',
    },
    {
        icon: Clock,
        title: 'Pembayaran Mudah lewat QRIS',
        desc: 'Bayar pakai QRIS dari semua e-wallet dan mobile banking — GoPay, OVO, DANA, ShopeePay, hingga m-banking. Saldo masuk otomatis, langsung bisa order.',
    },
    {
        icon: TrendingUp,
        title: '2.000+ Layanan Lengkap',
        desc: 'Dari followers, likes, views, komentar, hingga jam tayang untuk Instagram, TikTok, YouTube, Facebook, dan Telegram. Semua kebutuhan sosial mediamu dalam satu panel.',
    },
    {
        icon: Headphones,
        title: 'Cocok untuk Reseller',
        desc: 'Mau buka bisnis jasa sosial media sendiri? Ambil layanan kami dengan harga reseller dan jual kembali dengan margin yang kamu tentukan. Modal kecil, untung jalan terus.',
    },
];

// TODO: ganti '#' dengan URL sosial media asli kamu.
const SOCIALS = [
    { id: 'instagram', label: 'Instagram', url: '#', Icon: Instagram },
    { id: 'youtube', label: 'YouTube', url: '#', Icon: Youtube },
    { id: 'facebook', label: 'Facebook', url: '#', Icon: Facebook },
    { id: 'telegram', label: 'Telegram', url: '#', Icon: Send },
];

// Tentukan icon + warna berdasarkan platform di slug.
function platformVisual(slug) {
    if (slug.includes('instagram')) return { icon: Instagram, color: '#E1306C', label: 'Instagram' };
    if (slug.includes('tiktok')) return { icon: Play, color: '#69C9D0', label: 'TikTok' };
    if (slug.includes('youtube')) return { icon: Youtube, color: '#FF0000', label: 'YouTube' };
    if (slug.includes('facebook')) return { icon: Facebook, color: '#1877F2', label: 'Facebook' };
    if (slug.includes('telegram')) return { icon: Send, color: '#229ED9', label: 'Telegram' };
    return { icon: Zap, color: '#2563EB', label: 'Semua Platform' };
}

// ── CountUp: angka berhitung naik saat mount (sama dengan landing) ──
function CountUp({ end, duration = 2000, decimals = 0, prefix = '', suffix = '' }) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        let raf, start;
        const step = (ts) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(end * eased);
            if (p < 1) raf = requestAnimationFrame(step);
            else setVal(end);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [end, duration]);
    const display = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString('id-ID');
    return <>{prefix}{display}{suffix}</>;
}

// ── RevealSection: animasi saat masuk viewport (sama dengan landing) ──
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

        const initStyles = getInit().split(';');
        initStyles.forEach((s) => {
            const [prop, val] = s.split(':');
            if (prop && val) el.style[prop.trim()] = val.trim();
        });

        const obs = new IntersectionObserver(([e]) => {
            if (!e.isIntersecting) return;
            obs.unobserve(el);

            if (stagger > 0) {
                const kids = Array.from(el.children);
                kids.forEach((child, i) => {
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
                el.style.opacity = '1';
                el.style.transform = 'none';
            } else {
                el.style.transition = `opacity ${duration}ms ${EASE.out} ${delay}ms, transform ${duration}ms ${EASE.out} ${delay}ms`;
                const finalStyles = getFinal().split(';');
                finalStyles.forEach((s) => {
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

// ── useNavbarScroll: navbar solid saat scroll (sama dengan landing) ──
function useNavbarScroll() {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    return scrolled;
}

// ── Kartu layanan ──────────────────────────────────────────────
function ServiceCard({ slug }) {
    const v = platformVisual(slug);
    const Icon = v.icon;
    const page = LANDING_PAGES[slug];
    return (
        <Link
            href={`/layanan/${slug}`}
            className="svc-card"
            style={{
                display: 'flex', flexDirection: 'column', gap: 12, textDecoration: 'none',
                background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 20,
                padding: 22, transition: 'transform .25s, box-shadow .25s, border-color .25s',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,.10)';
                e.currentTarget.style.borderColor = 'rgba(37,99,235,.45)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = 'var(--border)';
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                    width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: v.color, background: `${v.color}1A`,
                }}>
                    <Icon size={22} />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text3)' }}>{v.label}</span>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.3px', lineHeight: 1.3 }}>
                {page.h1}
            </h3>
            <p style={{
                fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6, margin: 0,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
                {page.intro}
            </p>
            <span style={{
                marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13.5, fontWeight: 700, color: 'var(--blue)',
            }}>
                Lihat Layanan <ArrowRight size={15} />
            </span>
        </Link>
    );
}

export default function LayananIndex() {
    // Asumsi: ThemeContext mengekspor { dark, toggle } — sama seperti landing page.
    // Kalau API context-mu beda namanya, sesuaikan baris ini saja.
    const { dark, toggle } = useTheme() ?? {};
    const scrolled = useNavbarScroll();
    const [menuOpen, setMenuOpen] = useState(false);
    const [showTop, setShowTop] = useState(false);

    useEffect(() => {
        const onScroll = () => setShowTop(window.scrollY > 480);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    const canonical = `${SITE_URL}/layanan`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Daftar Layanan SMM — SuntikSosmed',
        description:
            'Semua layanan SMM SuntikSosmed: followers, likes, views Instagram, TikTok, YouTube, dan lainnya dengan harga termurah.',
        url: canonical,
    };

    return (
        <>
            <Head>
                <title>Daftar Layanan SMM Termurah — Instagram, TikTok, YouTube | SuntikSosmed</title>
                <meta
                    name="description"
                    content="Semua layanan SMM SuntikSosmed dalam satu halaman: jual followers, likes, views Instagram, TikTok, YouTube & lainnya. Harga mulai Rp1/1000, proses otomatis."
                />
                <link rel="canonical" href={canonical} />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="Daftar Layanan SMM Termurah | SuntikSosmed" />
                <meta property="og:url" content={canonical} />
                <meta property="og:site_name" content="SuntikSosmed" />
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            </Head>

            <div
                className={dark ? 'root dark' : 'root'}
                style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT, position: 'relative' }}
            >
                {/* ── NAVBAR ── */}
                <nav style={{
                    position: 'sticky', top: 0, zIndex: 80,
                    background: scrolled ? 'var(--white)' : 'transparent',
                    borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
                    backdropFilter: scrolled ? 'blur(12px)' : 'none',
                    transition: 'background .3s, border-color .3s',
                }}>
                    <div style={{
                        maxWidth: 1160, margin: '0 auto', padding: '12px 16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                    }}>
                        {/* Logo */}
                        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 18, color: 'var(--text)', textDecoration: 'none' }}>
                            <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Target size={15} style={{ color: '#fff' }} strokeWidth={2.5} />
                            </span>
                            Suntik<span style={{ color: 'var(--blue)' }}>Sosmed</span>
                        </Link>

                        {/* Link desktop */}
                        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {NAV_LINKS.map((l) => (
                                <Link
                                    key={l.label}
                                    href={l.href}
                                    style={{
                                        padding: '8px 14px', borderRadius: 50, fontSize: 14, fontWeight: 600,
                                        textDecoration: 'none', transition: 'color .15s, background .15s',
                                        color: l.active ? 'var(--blue)' : 'var(--text2)',
                                        background: l.active ? 'rgba(37,99,235,.10)' : 'transparent',
                                    }}
                                    onMouseEnter={(e) => { if (!l.active) e.currentTarget.style.color = 'var(--text)'; }}
                                    onMouseLeave={(e) => { if (!l.active) e.currentTarget.style.color = 'var(--text2)'; }}
                                >
                                    {l.label}
                                </Link>
                            ))}
                        </div>

                        {/* Aksi kanan */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                                onClick={() => toggle?.()}
                                aria-label="Ganti tema"
                                style={{
                                    width: 38, height: 38, borderRadius: 11, cursor: 'pointer',
                                    border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                {dark ? <Sun size={17} /> : <Moon size={17} />}
                            </button>

                            <Link href="/register" className="nav-cta" style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                background: 'var(--blue)', color: '#fff', textDecoration: 'none',
                                borderRadius: 50, padding: '9px 18px', fontSize: 14, fontWeight: 700,
                            }}>
                                Daftar <ArrowRight size={15} />
                            </Link>

                            <button
                                className="menu-btn"
                                onClick={() => setMenuOpen((v) => !v)}
                                aria-label="Menu"
                                style={{
                                    display: 'none', width: 38, height: 38, borderRadius: 11, cursor: 'pointer',
                                    border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)',
                                    alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                {menuOpen ? <X size={18} /> : <Menu size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Panel menu mobile */}
                    {menuOpen && (
                        <div className="mobile-panel" style={{
                            borderTop: '1px solid var(--border)', background: 'var(--white)',
                            padding: '8px 16px 14px', display: 'flex', flexDirection: 'column', gap: 2,
                        }}>
                            {NAV_LINKS.map((l) => (
                                <Link
                                    key={l.label}
                                    href={l.href}
                                    onClick={() => setMenuOpen(false)}
                                    style={{
                                        padding: '11px 12px', borderRadius: 10, fontSize: 15, fontWeight: 600,
                                        textDecoration: 'none', color: l.active ? 'var(--blue)' : 'var(--text)',
                                        background: l.active ? 'rgba(37,99,235,.10)' : 'transparent',
                                    }}
                                >
                                    {l.label}
                                </Link>
                            ))}
                        </div>
                    )}
                </nav>

                {/* ── BREADCRUMB ── */}
                <div style={{ maxWidth: 1160, margin: '0 auto', padding: '20px 16px 0' }}>
                    <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text3)' }}>
                        <Link href="/" style={{ color: 'var(--text3)', textDecoration: 'none' }}>Beranda</Link>
                        <span aria-hidden>/</span>
                        <span style={{ color: 'var(--text2)', fontWeight: 600 }}>Layanan</span>
                    </nav>
                </div>

                {/* ── HERO ── */}
                <RevealSection variant="up" duration={900}>
                    <header style={{ maxWidth: 760, margin: '0 auto', padding: '36px 16px 8px', textAlign: 'center' }}>
                        <div style={{
                            display: 'inline-block', background: 'linear-gradient(135deg,rgba(37,99,235,.1),rgba(37,99,235,.05))',
                            border: '1px solid rgba(37,99,235,.2)', borderRadius: 50, padding: '5px 16px',
                            fontSize: 12.5, fontWeight: 700, color: 'var(--blue)', marginBottom: 16,
                        }}>
                            2.000+ Layanan Tersedia
                        </div>
                        <h1 style={{ fontSize: 'clamp(28px, 6vw, 46px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.8px', lineHeight: 1.12, marginBottom: 16 }}>
                            Daftar Layanan SMM Termurah
                        </h1>
                        <p style={{ fontSize: 'clamp(14px, 3vw, 16px)', color: 'var(--text2)', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 26px' }}>
                            Pilih kategori layanan yang kamu butuhkan. Semua diproses otomatis 24 jam dengan
                            harga termurah mulai Rp1/1000 untuk Instagram, TikTok, YouTube, dan platform lainnya.
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Link href="/register" style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--blue)', color: '#fff',
                                textDecoration: 'none', borderRadius: 50, padding: '12px 26px', fontSize: 15, fontWeight: 800,
                                boxShadow: '0 8px 28px rgba(37,99,235,.35)',
                            }}>
                                Order Sekarang <ArrowRight size={16} />
                            </Link>
                            <Link href="/login" style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--bg2)',
                                border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none',
                                borderRadius: 50, padding: '12px 24px', fontSize: 15, fontWeight: 700,
                            }}>
                                Sudah punya akun? Masuk
                            </Link>
                        </div>
                    </header>
                </RevealSection>

                {/* ── STATS ── */}
                <RevealSection variant="up" delay={80} stagger={90}>
                    <div style={{
                        maxWidth: 880, margin: '28px auto 0', padding: '0 16px',
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12,
                    }}>
                        {STATS.map((s) => (
                            <div key={s.label} style={{
                                background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 16,
                                padding: '18px 14px', textAlign: 'center',
                            }}>
                                <div style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800, color: 'var(--blue)', letterSpacing: '-.5px' }}>
                                    <CountUp end={s.end} prefix={s.prefix || ''} suffix={s.suffix || ''} />
                                </div>
                                <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </RevealSection>

                {/* ── GRID LAYANAN ── */}
                <RevealSection variant="up" delay={60}>
                    <section aria-label="Semua layanan" style={{ maxWidth: 1160, margin: '0 auto', padding: '56px 16px 8px' }}>
                        <div style={{ textAlign: 'center', marginBottom: 32 }}>
                            <h2 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 10 }}>
                                Semua Kategori Layanan
                            </h2>
                            <p style={{ fontSize: 15, color: 'var(--text2)' }}>Klik kategori untuk melihat detail harga dan jenis layanannya.</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                            {LANDING_SLUGS.map((slug) => (
                                <ServiceCard key={slug} slug={slug} />
                            ))}
                        </div>
                    </section>
                </RevealSection>

                {/* ── KENAPA SUNTIKSOSMED ── */}
                <RevealSection variant="up" delay={50}>
                    <section aria-label="Kenapa SuntikSosmed" style={{ maxWidth: 1160, margin: '0 auto', padding: '64px 16px 8px' }}>
                        <div style={{ textAlign: 'center', marginBottom: 14 }}>
                            <div style={{
                                display: 'inline-block', background: 'linear-gradient(135deg,rgba(37,99,235,.1),rgba(37,99,235,.05))',
                                border: '1px solid rgba(37,99,235,.2)', borderRadius: 50, padding: '5px 16px',
                                fontSize: 12.5, fontWeight: 700, color: 'var(--blue)', marginBottom: 14,
                            }}>
                                Kenapa Kami
                            </div>
                            <h2 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 12 }}>
                                Kenapa Harus Pesan di SuntikSosmed?
                            </h2>
                        </div>
                        <p style={{ fontSize: 15.5, color: 'var(--text2)', lineHeight: 1.8, maxWidth: 720, margin: '0 auto 36px', textAlign: 'center' }}>
                            SuntikSosmed sudah dipercaya ribuan content creator, selebgram, UMKM, dan reseller di
                            seluruh Indonesia untuk mengembangkan akun sosial media mereka. Kami bukan sekadar tempat
                            beli followers — kami partner pertumbuhan digitalmu dengan layanan yang cepat, aman, dan transparan.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                            {WHY_US.map(({ icon: Icon, title, desc }) => (
                                <div key={title} style={{
                                    display: 'flex', gap: 14, background: 'var(--white)', border: '1px solid var(--border)',
                                    borderRadius: 18, padding: 22,
                                }}>
                                    <span style={{
                                        flexShrink: 0, width: 44, height: 44, borderRadius: 12,
                                        background: 'rgba(37,99,235,.10)', color: 'var(--blue)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Icon size={20} />
                                    </span>
                                    <div>
                                        <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 6, letterSpacing: '-.2px' }}>{title}</h3>
                                        <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.65, margin: 0 }}>{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </RevealSection>

                {/* ── CTA PENUTUP (blok biru, sama dengan landing) ── */}
                <RevealSection variant="scale" delay={50} duration={1000}>
                    <div style={{ maxWidth: 1160, margin: '0 auto', padding: '64px 16px 60px' }}>
                        <div style={{ background: 'var(--blue)', borderRadius: 28, padding: 'clamp(32px, 6vw, 64px) clamp(20px, 5vw, 48px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
                            <div style={{ position: 'absolute', bottom: -80, left: -40, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.15)', borderRadius: 50, padding: '5px 14px', fontSize: 11.5, fontWeight: 700, color: '#fff', marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%' }}>
                                    <Sparkles size={12} /> Mulai dari Rp 1/K · Tanpa kontrak · Cancel kapan saja
                                </div>
                                <h2 style={{ fontSize: 'clamp(24px, 6vw, 44px)', fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-.5px', lineHeight: 1.15 }}>
                                    Siap meningkatkan<br />jangkauan kamu?
                                </h2>
                                <p style={{ fontSize: 'clamp(13px, 3vw, 16px)', color: 'rgba(255,255,255,.75)', maxWidth: 420, margin: '0 auto 32px', lineHeight: 1.7 }}>
                                    Daftar gratis, isi saldo lewat QRIS, dan mulai order dalam hitungan menit. Tanpa biaya tersembunyi — bayar sesuai yang kamu pakai.
                                </p>
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <Link href="/register" style={{ background: '#fff', borderRadius: 50, padding: '12px 28px', fontSize: 'clamp(13px, 3vw, 15px)', fontWeight: 800, color: 'var(--blue)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
                                        Mulai Sekarang <ArrowRight size={16} />
                                    </Link>
                                    <Link href="/login" style={{ background: 'rgba(255,255,255,.15)', border: '1.5px solid rgba(255,255,255,.3)', borderRadius: 50, padding: '12px 24px', fontSize: 'clamp(13px, 3vw, 15px)', fontWeight: 700, color: '#fff', textDecoration: 'none', backdropFilter: 'blur(8px)' }}>
                                        Sign In
                                    </Link>
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

                {/* ── FOOTER (selaras dengan landing) ── */}
                <footer style={{ background: 'var(--white)', borderTop: '1px solid var(--border)', padding: '28px 16px 20px' }}>
                    <div style={{ maxWidth: 1160, margin: '0 auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>
                                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Target size={14} style={{ color: '#fff' }} strokeWidth={2.5} />
                                </span>
                                Suntik<span style={{ color: 'var(--blue)' }}>Sosmed</span>
                            </div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                {[
                                    { label: 'Layanan', href: '/layanan' },
                                    { label: 'Cara Kerja', href: '/#panduan' },
                                    { label: 'FAQ', href: '/#faq' },
                                ].map(({ label, href }) => (
                                    <Link key={label} href={href} style={{ color: 'var(--text3)', textDecoration: 'none', fontSize: 12, fontWeight: 500 }}>{label}</Link>
                                ))}
                            </div>
                        </div>
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <p style={{ color: 'var(--text3)', fontSize: 11.5, margin: 0 }}>© 2026 SuntikSosmed.com. Hak cipta dilindungi.</p>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {SOCIALS.map(({ id, label, url, Icon }) => (
                                    <a key={id} href={url} target="_blank" rel="noreferrer" aria-label={label}
                                        style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', textDecoration: 'none' }}>
                                        <Icon size={14} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </footer>

                {/* ── Scroll to top ── */}
                <button
                    onClick={scrollToTop}
                    aria-label="Kembali ke atas"
                    style={{
                        position: 'fixed', bottom: 24, right: 24, zIndex: 90,
                        width: 46, height: 46, borderRadius: 14, border: 'none', cursor: 'pointer',
                        background: 'var(--blue)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(37,99,235,.4)',
                        opacity: showTop ? 1 : 0,
                        transform: showTop ? 'translateY(0) scale(1)' : 'translateY(16px) scale(.9)',
                        pointerEvents: showTop ? 'auto' : 'none',
                        transition: 'opacity .3s ease, transform .3s cubic-bezier(.34,1.56,.64,1)',
                    }}
                >
                    <ArrowUp size={20} />
                </button>

                {/* Responsif: sembunyikan link desktop & tampilkan tombol menu di layar kecil */}
                <style jsx>{`
          @media (max-width: 820px) {
            .nav-links { display: none !important; }
            .menu-btn { display: inline-flex !important; }
          }
        `}</style>
            </div>
        </>
    );
}