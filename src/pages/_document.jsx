import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="id">
      <Head>
        {/* ✅ Viewport — tanpa user-scalable=no agar accessible */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* ✅ PWA & Mobile */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SuntikSosmed" />
        <meta name="theme-color" content="#2563EB" />

        {/* ✅ SEO */}
        <meta name="description" content="Platform SMM terbaik & terpercaya di Indonesia. Followers, views, likes untuk Instagram, TikTok, YouTube & lebih." />
        <meta name="robots" content="index, follow" />

        {/* ✅ Open Graph — preview saat dibagikan di WA/Twitter/dll */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SuntikSosmed" />
        <meta property="og:title" content="SuntikSosmed — Platform SMM Terbaik Indonesia" />
        <meta property="og:description" content="2.000+ layanan SMM. Followers, views, likes. Harga mulai Rp 1/K. Pengiriman instan." />
        <meta property="og:image" content="/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SuntikSosmed — Platform SMM Terbaik Indonesia" />
        <meta name="twitter:description" content="2.000+ layanan SMM. Followers, views, likes. Harga mulai Rp 1/K." />

        {/* ✅ Security headers via meta (backup — utamanya di next.config.js) */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />

        {/* ✅ Google Search Console */}
        <meta name="google-site-verification" content="e1LldDJ8ItgQUcLStZOtTdyFfib-7gjgPUDQGK6iGO8" />

        {/* ✅ Favicon */}
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}