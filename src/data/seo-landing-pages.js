// src/data/seo-landing-pages.js
//
// Konfigurasi seluruh halaman SEO landing.
// Setiap entri = 1 halaman di /layanan/[slug]
//
// `filter` dipakai untuk nyaring layanan dari Supabase tabel `services`.
//   - platform : dicocokkan ke kolom kategori/platform (lihat src/lib/landing.js)
//   - type     : dicocokkan ke nama layanan (followers / likes / views / dst)
//
// Title & description = yang dipakai Google. Tulis dengan kata kunci yang
// orang BENERAN ketik (jual / beli / jasa), bukan kata "suntik".

export const LANDING_PAGES = {
    // ---------- TIER 1: kata kunci utama ----------
    'panel-smm': {
        title: 'Panel SMM Termurah Indonesia — Followers, Likes, Views | SuntikSosmed',
        description:
            'SuntikSosmed, panel SMM Indonesia termurah & terpercaya. Jual followers, likes, views Instagram, TikTok, YouTube. Harga mulai Rp1/1000, proses otomatis & instan.',
        h1: 'Panel SMM Indonesia Termurah & Terpercaya',
        intro:
            'SuntikSosmed adalah panel SMM Indonesia dengan 2.000+ layanan followers, likes, dan views untuk Instagram, TikTok, dan YouTube. Proses otomatis, harga mulai Rp1/1000, cocok untuk pengguna pribadi maupun reseller.',
        keyword: 'panel smm termurah indonesia',
        filter: null, // null = tampilkan layanan unggulan dari semua platform
        featured: true,
    },

    'followers-instagram': {
        title: 'Jual Followers Instagram Murah, Real & Aktif | SuntikSosmed',
        description:
            'Beli followers Instagram murah, real & aktif Indonesia di SuntikSosmed. Proses instan, bergaransi, harga mulai Rp1/1000. Order otomatis 24 jam.',
        h1: 'Jual Followers Instagram Murah, Real & Aktif',
        intro:
            'Tambah followers Instagram dengan cepat dan aman. Layanan real aktif Indonesia maupun global, proses instan, bergaransi, dengan harga termurah.',
        keyword: 'jual followers instagram murah',
        filter: { platform: 'instagram', type: 'followers' },
    },

    'followers-tiktok': {
        title: 'Jasa Followers TikTok Murah & Aman | SuntikSosmed',
        description:
            'Jasa tambah followers TikTok murah, aman, dan cepat. Tingkatkan kredibilitas akun & peluang FYP. Proses otomatis, harga mulai Rp1/1000 di SuntikSosmed.',
        h1: 'Jasa Followers TikTok Murah & Aman',
        intro:
            'Tingkatkan followers TikTok-mu untuk memperbesar peluang masuk FYP dan memperkuat branding. Proses cepat, otomatis, dan aman tanpa risiko.',
        keyword: 'jasa followers tiktok',
        filter: { platform: 'tiktok', type: 'followers' },
    },

    'views-tiktok': {
        title: 'Beli Views TikTok Murah, Cepat & Aman | SuntikSosmed',
        description:
            'Beli views TikTok murah untuk dongkrak konten masuk FYP. Proses instan, harga mulai Rp1/1000, 100% aman. Order otomatis di SuntikSosmed.',
        h1: 'Beli Views TikTok Murah & Instan',
        intro:
            'Naikkan jumlah views video TikTok-mu agar terlihat lebih populer dan berpeluang viral. Proses instan dengan harga paling terjangkau.',
        keyword: 'beli views tiktok',
        filter: { platform: 'tiktok', type: 'views' },
    },

    'subscriber-youtube': {
        title: 'Jasa Subscriber YouTube Murah & Real | SuntikSosmed',
        description:
            'Jasa tambah subscriber YouTube murah, real, dan aman untuk syarat monetisasi. Proses bertahap natural, harga terjangkau. Order otomatis di SuntikSosmed.',
        h1: 'Jasa Subscriber YouTube Murah & Real',
        intro:
            'Tambah subscriber YouTube untuk mempercepat syarat monetisasi dan memperkuat kredibilitas channel. Proses natural dan aman.',
        keyword: 'jasa subscriber youtube',
        filter: { platform: 'youtube', type: 'subscriber' },
    },

    'views-youtube': {
        title: 'Beli Views YouTube Murah & Aman | SuntikSosmed',
        description:
            'Beli views YouTube murah untuk meningkatkan visibilitas & kredibilitas video. Proses aman, harga terjangkau. Order otomatis 24 jam di SuntikSosmed.',
        h1: 'Beli Views YouTube Murah & Aman',
        intro:
            'Tingkatkan jumlah views video YouTube-mu untuk mendorong pertumbuhan organik dan keterlibatan audiens.',
        keyword: 'beli views youtube',
        filter: { platform: 'youtube', type: 'views' },
    },

    // ---------- TIER 2: turunan / long-tail ----------
    'likes-instagram': {
        title: 'Jual Likes Instagram Murah & Instan | SuntikSosmed',
        description:
            'Beli likes Instagram murah & instan untuk dongkrak engagement postingan. Harga mulai Rp1/1000, proses otomatis di SuntikSosmed.',
        h1: 'Jual Likes Instagram Murah & Instan',
        intro:
            'Tingkatkan jumlah likes postingan Instagram-mu agar terlihat lebih menarik dan populer. Proses instan dan aman.',
        keyword: 'jual likes instagram murah',
        filter: { platform: 'instagram', type: 'likes' },
    },

    'likes-tiktok': {
        title: 'Beli Likes TikTok Murah & Cepat | SuntikSosmed',
        description:
            'Beli likes TikTok murah untuk buktikan kontenmu disukai banyak orang. Proses cepat & aman, harga terjangkau di SuntikSosmed.',
        h1: 'Beli Likes TikTok Murah & Cepat',
        intro:
            'Tambah likes pada video TikTok-mu untuk memperkuat daya tarik konten dan memperbesar peluang FYP.',
        keyword: 'beli likes tiktok',
        filter: { platform: 'tiktok', type: 'likes' },
    },

    'views-instagram': {
        title: 'Jasa Views Instagram Reels Murah | SuntikSosmed',
        description:
            'Jasa tambah views Instagram Reels & video murah dan instan. Tingkatkan impresi kontenmu. Harga terjangkau, order otomatis di SuntikSosmed.',
        h1: 'Jasa Views Instagram Reels Murah',
        intro:
            'Naikkan jumlah views Reels dan video Instagram untuk meraih lebih banyak impresi dan jangkauan.',
        keyword: 'jasa views instagram reels',
        filter: { platform: 'instagram', type: 'views' },
    },

    'followers-facebook': {
        title: 'Jasa Followers Facebook Murah & Aman | SuntikSosmed',
        description:
            'Jasa tambah followers & like halaman Facebook murah untuk bisnis. Proses aman, harga terjangkau. Order otomatis di SuntikSosmed.',
        h1: 'Jasa Followers Facebook Murah & Aman',
        intro:
            'Perkuat kehadiran bisnismu di Facebook dengan tambahan followers dan like halaman yang aman.',
        keyword: 'jasa followers facebook',
        filter: { platform: 'facebook', type: 'followers' },
    },

    'member-telegram': {
        title: 'Jual Member Telegram Murah & Cepat | SuntikSosmed',
        description:
            'Beli member Telegram murah untuk grup & channel. Proses cepat dan aman, harga terjangkau. Order otomatis 24 jam di SuntikSosmed.',
        h1: 'Jual Member Telegram Murah & Cepat',
        intro:
            'Tingkatkan jumlah member grup atau channel Telegram-mu agar terlihat lebih aktif dan terpercaya.',
        keyword: 'jual member telegram',
        filter: { platform: 'telegram', type: 'member' },
    },
};

// Helper buat getStaticPaths
export const LANDING_SLUGS = Object.keys(LANDING_PAGES);