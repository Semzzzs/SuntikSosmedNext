/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Sembunyikan X-Powered-By: Next.js
  webpack(config) {
    config.resolve.alias['@'] = path.join(__dirname, 'src');
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Cegah clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Cegah MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Cegah referrer bocor ke site lain
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Matikan akses kamera/mic/GPS
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Paksa HTTPS selama 1 tahun (HSTS)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Cegah XSS & injection (CSP) - sesuaikan jika pakai CDN eksternal
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-src 'none';" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;