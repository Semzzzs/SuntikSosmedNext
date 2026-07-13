import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Component } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { ApiProvider } from '@/context/ApiContext';
import { AuthProvider } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import '@/styles/globals.css';

// ✅ Structured Data (JSON-LD) — bantu Google paham brand & munculin sitelinks
const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'SuntikSosmed',
  url: 'https://suntiksosmed.store',
  logo: 'https://suntiksosmed.store/logo.png',
  description:
    'Platform SMM #1 Indonesia. 2.000+ layanan followers, likes, views Instagram, TikTok, YouTube. Harga mulai Rp1/1000, proses instan, aman & terpercaya.',
  sameAs: [],
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'SuntikSosmed',
  url: 'https://suntiksosmed.store',
};

// ✅ Error Boundary — cegah seluruh app crash saat satu view error
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Outfit',sans-serif", padding: 24, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 28 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 8 }}>Terjadi kesalahan</div>
          <div style={{ fontSize: 13.5, color: '#6B7280', marginBottom: 24, maxWidth: 360 }}>
            Halaman mengalami error. Coba refresh atau kembali ke beranda.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => window.location.reload()}
              style={{ padding: '9px 20px', borderRadius: 10, background: '#2563EB', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
              Refresh
            </button>
            <button onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
              style={{ padding: '9px 20px', borderRadius: 10, background: '#F3F4F6', color: '#374151', border: 'none', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
              Ke Beranda
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const isAdmin = router.pathname.startsWith('/Voltaraz');

  // ✅ Auto-bersihin sesi lokal yang korup. "Invalid Refresh Token: Refresh
  // Token Not Found" muncul kalau localStorage masih nyimpen sesi lama yang
  // refresh token-nya udah gak valid (mis. rotate karena login di tab/device
  // lain, atau server cabut sesi). Tanpa ini, error itu numpuk tiap reload
  // sampai user manual clear localStorage. `scope: 'local'` cuma bersihin
  // browser ini — TIDAK ikut nge-logout sesi user di device lain.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        supabase.auth.signOut({ scope: 'local' }).catch(() => { });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ✅ URL kanonik & og:url dinamis — ikut halaman aktif, bukan selalu homepage.
  // Page individual masih bisa override title/description sendiri lewat <Head> di komponennya;
  // next/head otomatis dedupe tag dengan key yang sama (ambil yang dirender paling akhir/dalam).
  const canonicalUrl = `https://suntiksosmed.store${router.asPath.split('?')[0]}`;
  const ogImageUrl = 'https://suntiksosmed.store/og-image.png';

  return (
    <ErrorBoundary>
      <Head>
        {/* ✅ Viewport — lokasi yang benar (next/head), bukan _document.
            viewport-fit=cover agar safe-area iPhone aktif. Tanpa user-scalable=no = accessible. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        {/* ✅ Title & description default — bisa di-override per halaman.
            Inilah yang tampil sebagai judul di hasil pencarian Google. */}
        <title>SuntikSosmed — Jasa SMM Termurah & Tercepat di Indonesia</title>
        <meta
          name="description"
          content="SuntikSosmed — platform SMM #1 Indonesia. 2.000+ layanan followers, likes, views Instagram, TikTok, YouTube. Harga mulai Rp1/1000, proses instan, aman & terpercaya."
        />
        {/* ✅ Canonical & og:url — dinamis ikut halaman aktif (bukan hardcode homepage),
            supaya Google nggak nganggap /login, /register, /layanan dll sebagai duplikat homepage. */}
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content="SuntikSosmed — Jasa SMM Termurah & Tercepat di Indonesia" />
        <meta property="og:description" content="2.000+ layanan SMM. Followers, likes, views Instagram, TikTok, YouTube. Mulai Rp1/1000 — proses instan, aman & terpercaya." />
        <meta property="og:image" content={ogImageUrl} />
        <meta name="twitter:title" content="SuntikSosmed — Jasa SMM Termurah & Tercepat di Indonesia" />
        <meta name="twitter:description" content="2.000+ layanan SMM. Followers, likes, views. Mulai Rp1/1000 — proses instan, aman & terpercaya." />
        <meta name="twitter:image" content={ogImageUrl} />
        {/* ✅ JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </Head>
      <AuthProvider>
        <ApiProvider>
          <ThemeProvider
            key={isAdmin ? 'admin' : 'user'}
            storageKey={isAdmin ? 'admin_theme' : 'user_theme'}
          >
            <ErrorBoundary>
              <Component {...pageProps} />
            </ErrorBoundary>
          </ThemeProvider>
        </ApiProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}