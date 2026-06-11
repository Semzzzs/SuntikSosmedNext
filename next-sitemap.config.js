/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: 'https://suntiksosmed.store',
    generateRobotsTxt: true,
    sitemapSize: 7000,
    changefreq: 'daily',
    priority: 0.7,

    // Halaman yang TIDAK perlu diindeks Google (panel, API, auth, dashboard user).
    exclude: [
        '/Voltaraz',
        '/Voltaraz/*',
        '/api/*',
        '/dashboard',
        '/login',
        '/register',
        '/reset-password',
        '/404',
    ],

    // Atur prioritas & changefreq per jenis halaman.
    transform: async (config, path) => {
        // Default
        let priority = config.priority;
        let changefreq = config.changefreq;

        // Homepage — paling penting.
        if (path === '/') {
            priority = 1.0;
            changefreq = 'daily';
        }

        // Halaman landing SEO /layanan/* — target keyword utama, prioritas tinggi.
        if (path.startsWith('/layanan')) {
            priority = 0.9;
            changefreq = 'daily';
        }

        return {
            loc: path,
            changefreq,
            priority,
            lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
        };
    },

    robotsTxtOptions: {
        policies: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/Voltaraz',
                    '/api',
                    '/dashboard',
                    '/login',
                    '/register',
                    '/reset-password',
                ],
            },
        ],
    },
};