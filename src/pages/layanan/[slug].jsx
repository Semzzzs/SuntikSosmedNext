// src/pages/layanan/[slug].jsx
//
// Dynamic route untuk semua halaman SEO landing.
// URL: /layanan/followers-instagram , /layanan/panel-smm , dst.
//
// - getStaticPaths : generate semua slug dari config (SSG, cepat & SEO-friendly)
// - getStaticProps : ambil layanan dari Supabase saat build, ISR revalidate
// - JSON-LD        : structured data (Service + Breadcrumb) untuk rich result

import Head from 'next/head';
import Link from 'next/link';
import {
    Instagram, Youtube, Facebook, Send, Play, Twitter, Zap,
} from 'lucide-react';
import { LANDING_PAGES, LANDING_SLUGS } from '@/data/seo-landing-pages';
import { getServicesForLanding } from '@/lib/landing';

const SITE_URL = 'https://suntiksosmed.store';

function formatRupiah(n) {
    if (!n && n !== 0) return '-';
    return 'Rp' + Number(n).toLocaleString('id-ID');
}

// Angka "Max" raksasa (mis. 2.147.483.647 = int max) tampil sebagai "Unlimited".
function formatMax(n) {
    if (n == null) return '-';
    const num = Number(n);
    if (num >= 2_000_000_000) return 'Unlimited';
    return num.toLocaleString('id-ID');
}

// Tentukan ikon + warna platform berdasarkan nama layanan.
function serviceVisual(name = '') {
    const n = name.toLowerCase();
    if (n.includes('instagram')) return { icon: Instagram, color: '#E1306C', label: 'Instagram' };
    if (n.includes('tiktok')) return { icon: Play, color: '#69C9D0', label: 'TikTok' };
    if (n.includes('youtube')) return { icon: Youtube, color: '#FF0000', label: 'YouTube' };
    if (n.includes('facebook')) return { icon: Facebook, color: '#1877F2', label: 'Facebook' };
    if (n.includes('telegram')) return { icon: Send, color: '#229ED9', label: 'Telegram' };
    if (n.includes('twitter') || n.includes('tweet')) return { icon: Twitter, color: '#1DA1F2', label: 'Twitter/X' };
    return { icon: Zap, color: '#3B82F6', label: 'Sosmed' };
}

// Ambil maksimal 3 tag penting dari nama layanan → ditampilkan sebagai pill.
// tone: green (bagus) | red (peringatan) | yellow | blue | gray
function serviceTags(name = '') {
    const n = name.toLowerCase();
    const out = [];
    const push = (label, tone) => {
        if (out.length < 3 && !out.some((t) => t.label === label)) out.push({ label, tone });
    };

    if (n.includes('instant')) push('Instant Start', 'green');
    if (n.includes('non drop') || n.includes('no drop')) push('Non Drop', 'green');
    if (n.includes('no refill')) push('No Refill', 'red');
    else if (n.includes('refill')) push('Refill', 'green');
    if (n.includes('high drop')) push('High Drop', 'red');
    if (n.includes('no warranty')) push('No Warranty', 'yellow');
    if (/\breal\b/.test(n)) push('Real', 'green');
    if (/\bhq\b/.test(n) || n.includes('high quality')) push('HQ', 'blue');
    if (n.includes('cancel')) push('Cancel Enable', 'gray');

    return out;
}

export default function LandingPage({ slug, page, services }) {
    if (!page) return null;

    const canonical = `${SITE_URL}/layanan/${slug}`;

    const cheapest =
        services && services.length
            ? services.reduce((m, s) => (s.price < m ? s.price : m), services[0].price)
            : null;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Service',
                name: page.h1,
                description: page.description,
                provider: {
                    '@type': 'Organization',
                    name: 'SuntikSosmed',
                    url: SITE_URL,
                },
                areaServed: { '@type': 'Country', name: 'Indonesia' },
                url: canonical,
                ...(cheapest != null && {
                    offers: {
                        '@type': 'Offer',
                        priceCurrency: 'IDR',
                        price: cheapest,
                        availability: 'https://schema.org/InStock',
                    },
                }),
            },
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Beranda', item: SITE_URL },
                    {
                        '@type': 'ListItem',
                        position: 2,
                        name: 'Layanan',
                        item: `${SITE_URL}/layanan`,
                    },
                    {
                        '@type': 'ListItem',
                        position: 3,
                        name: page.h1,
                        item: canonical,
                    },
                ],
            },
        ],
    };

    return (
        <>
            <Head>
                <title>{page.title}</title>
                <meta name="description" content={page.description} />
                <link rel="canonical" href={canonical} />

                <meta property="og:type" content="website" />
                <meta property="og:title" content={page.title} />
                <meta property="og:description" content={page.description} />
                <meta property="og:url" content={canonical} />
                <meta property="og:site_name" content="SuntikSosmed" />

                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={page.title} />
                <meta name="twitter:description" content={page.description} />

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
                        <Link href="/layanan">Layanan</Link>
                        <span aria-hidden>/</span>
                        <span>{page.h1}</span>
                    </nav>

                    <header className="landing-hero">
                        <h1>{page.h1}</h1>
                        <p className="landing-intro">{page.intro}</p>
                        {cheapest != null && (
                            <p className="landing-price-hint">
                                Harga mulai <strong>{formatRupiah(cheapest)}</strong> / 1000
                            </p>
                        )}
                        <Link href="/register" className="landing-cta">
                            Order Sekarang
                        </Link>
                    </header>

                    <section className="landing-services" aria-label="Daftar layanan">
                        <h2>Pilihan Layanan {page.h1}</h2>

                        {services && services.length > 0 ? (
                            <div className="landing-grid">
                                {services.map((s) => {
                                    const v = serviceVisual(s.name);
                                    const Icon = v.icon;
                                    const tags = serviceTags(s.name);
                                    return (
                                        <article key={s.id} className="landing-card landing-svc-card">
                                            <div className="landing-svc-head">
                                                <span
                                                    className="landing-svc-icon"
                                                    style={{ color: v.color, background: `${v.color}1A` }}
                                                >
                                                    <Icon size={19} />
                                                </span>
                                                <span className="landing-svc-platform">{v.label}</span>
                                            </div>

                                            <h3>{s.name}</h3>

                                            {tags.length > 0 && (
                                                <div className="landing-svc-tags">
                                                    {tags.map((t) => (
                                                        <span
                                                            key={t.label}
                                                            className={`landing-svc-tag tone-${t.tone}`}
                                                        >
                                                            {t.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="landing-svc-price">
                                                <span className="landing-svc-price-val">
                                                    {formatRupiah(s.price)}
                                                </span>
                                                <span className="landing-svc-price-unit">/ 1000</span>
                                            </div>

                                            <dl className="landing-card-meta">
                                                <div>
                                                    <dt>Min</dt>
                                                    <dd>
                                                        {s.min != null
                                                            ? Number(s.min).toLocaleString('id-ID')
                                                            : '-'}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt>Max</dt>
                                                    <dd>{formatMax(s.max)}</dd>
                                                </div>
                                            </dl>

                                            <Link href="/register" className="landing-card-btn">
                                                Pesan Sekarang
                                            </Link>
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="landing-empty">
                                Layanan sedang diperbarui. Silakan cek panel untuk daftar
                                lengkap.
                            </p>
                        )}
                    </section>

                    <section className="landing-related" aria-label="Layanan lainnya">
                        <h2>Layanan Lainnya</h2>
                        <ul className="landing-related-list">
                            {LANDING_SLUGS.filter((s) => s !== slug).map((s) => (
                                <li key={s}>
                                    <Link href={`/layanan/${s}`}>{LANDING_PAGES[s].h1}</Link>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="landing-about">
                        <h2>Kenapa Pesan di SuntikSosmed?</h2>
                        <p>
                            SuntikSosmed adalah panel SMM Indonesia dengan proses otomatis 24
                            jam, harga termurah mulai Rp1/1000, dan ribuan layanan untuk
                            Instagram, TikTok, dan YouTube. Pembayaran mudah lewat QRIS,
                            pesanan diproses instan, dan tersedia garansi untuk layanan
                            tertentu.
                        </p>
                    </section>
                </main>
            </div>
        </>
    );
}

// ---- Static generation ----

export async function getStaticPaths() {
    return {
        paths: LANDING_SLUGS.map((slug) => ({ params: { slug } })),
        fallback: 'blocking',
    };
}

export async function getStaticProps({ params }) {
    const { slug } = params;
    const page = LANDING_PAGES[slug];

    if (!page) {
        return { notFound: true };
    }

    let services = [];
    try {
        const result = await getServicesForLanding(page.filter, 24);
        services = result.services || [];
    } catch (e) {
        console.error('[getStaticProps] gagal ambil services:', e.message);
    }

    return {
        props: { slug, page, services },
        revalidate: 3600,
    };
}