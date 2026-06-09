/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: 'https://suntiksosmed.store',
    generateRobotsTxt: true,
    sitemapSize: 7000,
    changefreq: 'daily',
    priority: 0.7,
    exclude: ['/Voltaraz', '/Voltaraz/*', '/api/*'],
    robotsTxtOptions: {
        policies: [
            { userAgent: '*', allow: '/', disallow: ['/Voltaraz', '/api'] },
        ],
    },
};