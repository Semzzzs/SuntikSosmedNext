/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
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
        ],
      },
    ];
  },
};

module.exports = nextConfig;