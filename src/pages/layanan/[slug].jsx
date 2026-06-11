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
import { LANDING_PAGES, LANDING_SLUGS } from '@/data/seo-landing-pages';
import { getServicesForLanding } from '@/lib/landing';

const SITE_URL = 'https://suntiksosmed.store';

function formatRupiah(n) {
    if (!n && n !== 0) return '-';
    return 'Rp' + Number(n).toLocaleString('id-ID');
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
                        <Link href="/Voltaraz" className="landing-cta">
                            Order Sekarang
                        </Link>
                    </header>

                    <section className="landing-services" aria-label="Daftar layanan">
                        <h2>Pilihan Layanan {page.h1}</h2>

                        {services && services.length > 0 ? (
                            <div className="landing-grid">
                                {services.map((s) => (
                                    <article key={s.id} className="landing-card">
                                        <h3>{s.name}</h3>
                                        <dl className="landing-card-meta">
                                            <div>
                                                <dt>Harga / 1000</dt>
                                                <dd>{formatRupiah(s.price)}</dd>
                                            </div>
                                            {s.min != null && (
                                                <div>
                                                    <dt>Min</dt>
                                                    <dd>{Number(s.min).toLocaleString('id-ID')}</dd>
                                                </div>
                                            )}
                                            {s.max != null && (
                                                <div>
                                                    <dt>Max</dt>
                                                    <dd>{Number(s.max).toLocaleString('id-ID')}</dd>
                                                </div>
                                            )}
                                        </dl>
                                        <Link href="/Voltaraz" className="landing-card-btn">
                                            Pesan
                                        </Link>
                                    </article>
                                ))}
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