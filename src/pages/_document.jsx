import { Html, Head, Main, NextScript } from 'next/document';

// ✅ Anti-flash tema: script ini di-inject sebagai inline <script> mentah,
// dieksekusi sinkron oleh browser SEBELUM React/Next.js mulai hydrate.
// Ia membaca localStorage dan langsung menambahkan class "dark" ke <html>
// kalau perlu — sehingga begitu pertama kali browser melukis (paint),
// tema yang benar sudah aktif. Tidak ada lagi kedipan terang→gelap.
//
// Catatan penting: STORAGE_KEY di sini harus selalu sama persis dengan
// `storageKey` yang dipakai di <ThemeProvider storageKey="..."> pada _app.jsx.
// Kalau kamu mengubah salah satunya, ubah juga yang lain.
const STORAGE_KEY = 'theme_preference';

const noFlashScript = `
(function() {
  try {
    var stored = window.localStorage.getItem('${STORAGE_KEY}');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    // localStorage tidak tersedia (private mode dsb) — biarkan default light,
    // ThemeProvider akan tetap berjalan normal tanpa crash.
  }
})();
`;

export default function Document() {
  return (
    <Html lang="id">
      <Head>
        {/* ✅ Anti-flash tema — HARUS paling atas, jalan sebelum CSS/font lain dimuat */}
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />

        {/* ❌ Viewport DIPINDAH ke _app.jsx (next/head).
            Next.js melarang <meta name="viewport"> di _document.js */}

        {/* ✅ PWA & Mobile */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SuntikSosmed" />
        <meta name="theme-color" content="#2563EB" />

        {/* ✅ SEO statis (sitewide, tidak berubah per-halaman) */}
        <meta name="keywords" content="jasa smm, panel smm, beli followers, followers murah, tambah followers instagram, jasa followers tiktok, views youtube, smm panel indonesia, suntiksosmed" />
        <meta name="robots" content="index, follow" />
        {/* ❌ description, canonical, og:url, og:image, twitter:* DIPINDAH ke _app.jsx (dinamis per-halaman).
            Kalau ditulis statis di sini, SEMUA halaman (login, register, layanan, dst) bakal
            ngaku canonical-nya = homepage — Google bisa anggap halaman lain duplikat & skip index-nya. */}

        {/* ✅ Open Graph — bagian yang memang sitewide/konstan */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SuntikSosmed" />
        <meta name="twitter:card" content="summary_large_image" />

        {/* ✅ Security headers via meta (backup — utamanya di next.config.js) */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />

        {/* ✅ Google Search Console */}
        <meta name="google-site-verification" content="e1LldDJ8ItgQUcLStZOtTdyFfib-7gjgPUDQGK6iGO8" />

        {/* ✅ Fonts — Sora untuk headline (body tetap Plus Jakarta Sans) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&display=swap" rel="stylesheet" />

        {/* ✅ Favicon — pakai file yang ada di /public (favicon.ico sudah ≥48px) */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}