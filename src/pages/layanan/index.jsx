// src/pages/layanan/index.jsx
//
// Halaman katalog /layanan — desain selaras dengan landing detail.
// Menampilkan semua kategori layanan sebagai kartu + section meyakinkan.

import Head from 'next/head';
import Link from 'next/link';
import {
    Instagram, Youtube, Facebook, Send, Play,
    Zap, ShieldCheck, Wallet, Clock, Headphones, TrendingUp,
} from 'lucide-react';
import { LANDING_PAGES, LANDING_SLUGS } from '@/data/seo-landing-pages';

const SITE_URL = 'https://suntiksosmed.store';

// Tentukan icon + warna berdasarkan platform di slug.
function platformVisual(slug) {
    if (slug.includes('instagram')) return { icon: Instagram, color: '#E1306C', label: 'Instagram' };
    if (slug.includes('tiktok')) return { icon: Play, color: '#69C9D0', label: 'TikTok' };
    if (slug.includes('youtube')) return { icon: Youtube, color: '#FF0000', label: 'YouTube' };
    if (slug.includes('facebook')) return { icon: Facebook, color: '#1877F2', label: 'Facebook' };
    if (slug.includes('telegram')) return { icon: Send, color: '#229ED9', label: 'Telegram' };
    return { icon: Zap, color: '#2563EB', label: 'Semua Platform' };
}

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

export default function LayananIndex() {
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
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            </Head>

            <div className="root dark landing-wrap">
                <main className="landing">
                    <nav className="landing-breadcrumb" aria-label="Breadcrumb">
                        <Link href="/">Beranda</Link>
                        <span aria-hidden>/</span>
                        <span>Layanan</span>
                    </nav>

                    <header className="landing-hero">
                        <span className="landing-badge">2.000+ Layanan Tersedia</span>
                        <h1>Daftar Layanan SMM Termurah</h1>
                        <p className="landing-intro">
                            Pilih kategori layanan yang kamu butuhkan. Semua diproses otomatis
                            24 jam dengan harga termurah mulai Rp1/1000 untuk Instagram,
                            TikTok, YouTube, dan platform lainnya.
                        </p>
                        <Link href="/register" className="landing-cta">
                            Order Sekarang
                        </Link>
                    </header>

                    <section className="landing-services" aria-label="Semua layanan">
                        <h2>Semua Kategori Layanan</h2>
                        <div className="landing-grid">
                            {LANDING_SLUGS.map((slug) => {
                                const v = platformVisual(slug);
                                const Icon = v.icon;
                                return (
                                    <Link
                                        key={slug}
                                        href={`/layanan/${slug}`}
                                        className="landing-card landing-cat-card"
                                        style={{ textDecoration: 'none' }}
                                    >
                                        <div className="landing-cat-head">
                                            <span
                                                className="landing-cat-icon"
                                                style={{ color: v.color, background: `${v.color}1A` }}
                                            >
                                                <Icon size={22} />
                                            </span>
                                            <span className="landing-cat-platform">{v.label}</span>
                                        </div>
                                        <h3>{LANDING_PAGES[slug].h1}</h3>
                                        <p className="landing-cat-desc">{LANDING_PAGES[slug].intro}</p>
                                        <span className="landing-card-btn">Lihat Layanan</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>

                    {/* Kenapa SuntikSosmed — versi panjang & meyakinkan */}
                    <section className="landing-why" aria-label="Kenapa SuntikSosmed">
                        <h2>Kenapa Harus Pesan di SuntikSosmed?</h2>
                        <p className="landing-why-lead">
                            SuntikSosmed sudah dipercaya ribuan content creator, selebgram,
                            UMKM, dan reseller di seluruh Indonesia untuk mengembangkan akun
                            sosial media mereka. Kami bukan sekadar tempat beli followers —
                            kami partner pertumbuhan digitalmu dengan layanan yang cepat,
                            aman, dan transparan. Berikut alasan kenapa kamu bisa percaya
                            sepenuhnya kepada kami:
                        </p>

                        <div className="landing-why-grid">
                            {WHY_US.map(({ icon: Icon, title, desc }) => (
                                <div key={title} className="landing-why-card">
                                    <span className="landing-why-icon">
                                        <Icon size={20} />
                                    </span>
                                    <div>
                                        <h3>{title}</h3>
                                        <p>{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="landing-why-cta">
                            <p>
                                Siap mengembangkan akun sosial mediamu? Daftar gratis sekarang,
                                isi saldo lewat QRIS, dan mulai order dalam hitungan menit.
                                Tidak ada biaya tersembunyi — bayar sesuai yang kamu pakai.
                            </p>
                            <Link href="/register" className="landing-cta">
                                Mulai Sekarang
                            </Link>
                        </div>
                    </section>
                </main>
            </div>
        </>
    );
}