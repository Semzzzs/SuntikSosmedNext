/**
 * lib/platforms.jsx — SATU SUMBER KEBENARAN untuk:
 *   - pembersih nama service/kategori (cleanName, cleanCategory)
 *   - daftar platform + icon (PLATFORMS, PlatformIcons)
 *   - deteksi platform per service (detectPlatform)
 *
 * Dipakai bareng ViewNewOrder.jsx & ViewServices.jsx (dan komponen lain) supaya
 * logika kategorisasi nggak beda-beda antar halaman (penyebab "acak-acak").
 *
 * ➕ NAMBAH APK BARU = cukup di SINI, sekali, kepake di semua halaman:
 *   1. Tambah 1 entri di PLATFORMS  (id, label, icon, color, bg, darkBg)
 *   2. Tambah icon-nya di PlatformIcons  (key = id)
 *   3. Tambah kata kunci di PLATFORM_KEYWORDS  (biar service ke-deteksi)
 * Tombol platform yang NOL service otomatis disembunyiin di UI, jadi aman
 * daftarin banyak apk walau belum tentu ada service-nya.
 */

// ── Bersihin nama: buang [tag] + mojibake "��", TAPI emoji valid dibiarkan ──
// Catatan: kita sengaja TIDAK buang emoji asli (🔥⚡💎 dst) karena itu bagian
// tampilan. Yang dibuang cuma replacement char U+FFFD ("��") = emoji yang rusak
// encoding-nya (nggak bisa dirender), plus [tag] dalam kurung siku.
export const cleanName = (name = '') => String(name)
    .replace(/\[.*?\]/g, '')   // buang [tag]/[ID]
    .replace(/\uFFFD/g, '')    // buang mojibake "��" (emoji rusak)
    .replace(/\s+/g, ' ')
    .trim();

// ── Bersihin kategori: ambil segmen paling deskriptif sebelum '|' ──
const KNOWN_PLATFORM_WORDS = [
    'instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'telegram',
    'whatsapp', 'spotify', 'linkedin', 'threads', 'bigo', 'soundcloud',
    'shopee', 'tokopedia', 'discord', 'twitch',
];
export const cleanCategory = (name = '') => {
    const parts = String(name).split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length <= 1) return cleanName(name);
    const meaningful = parts.find(p => p.length > 8 && !KNOWN_PLATFORM_WORDS.includes(p.toLowerCase()));
    return cleanName(meaningful || parts[0]);
};

// ── Deteksi platform: cek KATEGORI dulu (paling andal), baru nama ──
// Urutan penting: brand spesifik dulu, 'website' (kata kunci luas spt 'traffic')
// paling akhir biar nggak nyaut service brand lain.
const PLATFORM_KEYWORDS = [
    ['instagram', ['instagram', 'igtv', 'reels']],
    ['tiktok', ['tiktok', 'tik tok', 'douyin']],
    ['facebook', ['facebook', 'fb ']],
    ['youtube', ['youtube', 'yt ']],
    ['twitter', ['twitter', 'tweet', 'retweet']],
    ['telegram', ['telegram']],
    ['whatsapp', ['whatsapp', 'wa ']],
    ['spotify', ['spotify']],
    ['linkedin', ['linkedin']],
    ['threads', ['threads']],
    ['bigo', ['bigo']],
    ['soundcloud', ['soundcloud', 'sound cloud']],
    ['shopee', ['shopee']],
    ['tokopedia', ['tokopedia', 'tokped']],
    ['discord', ['discord']],
    ['twitch', ['twitch']],
    ['website', ['website', 'web traffic', 'traffic', 'seo', 'visitor', 'backlink']],
];
export function detectPlatform(cleanCat = '', name = '') {
    const c = String(cleanCat).toLowerCase();
    for (const [p, kws] of PLATFORM_KEYWORDS) if (kws.some(k => c.includes(k))) return p;
    const n = String(name || '').toLowerCase();
    for (const [p, kws] of PLATFORM_KEYWORDS) if (kws.some(k => n.includes(k))) return p;
    return 'other'; // IMDB, dll yang nggak kenal -> bucket "Other"
}

// ── Icon per platform — logo asli via SimpleIcons CDN ──
// Catatan penting:
//  1. CDN tidak terima warna #ffffff → 404
//  2. Slug 'linkedin' bug di CDN: URL terpotong jadi /link → pakai SVG inline
//  3. TikTok, X (Twitter), Threads warna brand = hitam → filter invert di dark mode
//  4. onError: sembunyikan img jika CDN tidak bisa diakses
const si = (slug, color, invert = false) => (
    <img
        src={`https://cdn.simpleicons.org/${slug}/${color}`}
        width={18} height={18}
        alt={slug}
        style={{ display: 'block', flexShrink: 0, filter: invert ? 'invert(1)' : 'none' }}
        onError={e => { e.currentTarget.style.display = 'none'; }}
    />
);

export const PlatformIcons = {
    // SVG manual — tidak ada di SimpleIcons atau bug di CDN
    all: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>,
    bigo: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" /></svg>,
    tokopedia: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#03AC0E" strokeWidth="2" strokeLinejoin="round"><path d="M4 9l1.5-4h13L20 9M4 9v10h16V9M4 9h16M9 19v-5h6v5" /></svg>,
    website: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></svg>,
    other: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>,

    // LinkedIn — SVG inline (bug CDN: slug 'linkedin' terpotong jadi '/link' → 404)
    linkedin: <svg viewBox="0 0 24 24" width="18" height="18" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>,

    // Logo asli dari SimpleIcons CDN — warna brand asli
    instagram: si('instagram', 'E1306C'),
    facebook: si('facebook', '1877F2'),
    telegram: si('telegram', '26A5E4'),
    youtube: si('youtube', 'FF0000'),
    whatsapp: si('whatsapp', '25D366'),
    spotify: si('spotify', '1DB954'),
    soundcloud: si('soundcloud', 'FF5500'),
    shopee: si('shopee', 'EE4D2D'),
    discord: si('discord', '5865F2'),
    twitch: si('twitch', '9146FF'),

    // Brand hitam — filter invert agar terlihat di dark mode
    tiktok: si('tiktok', '000000', true),
    twitter: si('x', '000000', true),
    threads: si('threads', '000000', true),
};

// ── Daftar tombol platform. 'All' & 'Other' selalu; sisanya disembunyiin
//    otomatis di UI kalau nggak ada service-nya (lihat visiblePlatforms). ──
export const PLATFORMS = [
    { id: '', label: 'All', icon: 'all', color: '#64748B', bg: '#F1F5F9', darkBg: '#27272A' },
    { id: 'instagram', label: 'Instagram', icon: 'instagram', color: '#E1306C', bg: '#FDF2F8', darkBg: '#3B1520' },
    { id: 'facebook', label: 'Facebook', icon: 'facebook', color: '#1877F2', bg: '#EFF6FF', darkBg: '#1E2D4A' },
    { id: 'telegram', label: 'Telegram', icon: 'telegram', color: '#229ED9', bg: '#E0F7FF', darkBg: '#0E2A38' },
    { id: 'tiktok', label: 'TikTok', icon: 'tiktok', color: '#69C9D0', bg: '#F0FFFE', darkBg: '#0A2A2E' },
    { id: 'twitter', label: 'Twitter', icon: 'twitter', color: '#000000', bg: '#F8FAFC', darkBg: '#1A1A1A' },
    { id: 'youtube', label: 'YouTube', icon: 'youtube', color: '#FF0000', bg: '#FFF0F0', darkBg: '#3B0A0A' },
    { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', color: '#25D366', bg: '#F0FFF4', darkBg: '#0A2E1A' },
    { id: 'spotify', label: 'Spotify', icon: 'spotify', color: '#1DB954', bg: '#F0FFF4', darkBg: '#0A2E1A' },
    { id: 'linkedin', label: 'LinkedIn', icon: 'linkedin', color: '#0A66C2', bg: '#EFF6FF', darkBg: '#0A1F3B' },
    { id: 'threads', label: 'Threads', icon: 'threads', color: '#000000', bg: '#F8FAFC', darkBg: '#1A1A1A' },
    { id: 'bigo', label: 'Bigo', icon: 'bigo', color: '#00AEEF', bg: '#E0F7FF', darkBg: '#0E2A38' },
    { id: 'soundcloud', label: 'SoundCloud', icon: 'soundcloud', color: '#FF5500', bg: '#FFF1EA', darkBg: '#3B1A0A' },
    { id: 'shopee', label: 'Shopee', icon: 'shopee', color: '#EE4D2D', bg: '#FFF1ED', darkBg: '#3B160E' },
    { id: 'tokopedia', label: 'Tokopedia', icon: 'tokopedia', color: '#03AC0E', bg: '#EAFBEA', darkBg: '#0A2E12' },
    { id: 'discord', label: 'Discord', icon: 'discord', color: '#5865F2', bg: '#EEF0FE', darkBg: '#1A1E3B' },
    { id: 'twitch', label: 'Twitch', icon: 'twitch', color: '#9146FF', bg: '#F3EEFE', darkBg: '#22153B' },
    { id: 'website', label: 'Website', icon: 'website', color: '#0EA5E9', bg: '#E0F2FE', darkBg: '#0A2233' },
    { id: 'other', label: 'Other', icon: 'other', color: '#64748B', bg: '#F8FAFC', darkBg: '#1E1E1E' },
];

// Helper: dari daftar service yang udah punya field _platform, balikin
// PLATFORMS yang relevan aja (All + Other selalu, sisanya kalau ada isinya).
export function visiblePlatforms(platformCounts = {}) {
    return PLATFORMS.filter(p => p.id === '' || p.id === 'other' || (platformCounts[p.id] || 0) > 0);
}

// ─────────────────────────────────────────────────────────────
// Alias provider untuk DITAMPILKAN ke user — menyembunyikan nama supplier
// asli (smmsoc/buzzer) supaya tidak bocor ke customer. Kode tetap unik &
// bisa dipakai di Bulk Order. ➕ Provider baru: tambah satu baris di sini.
// ─────────────────────────────────────────────────────────────
export const PROVIDER_ALIAS = { smmsoc: 'A', buzzer: 'B' };
const ALIAS_TO_PROVIDER = Object.fromEntries(
    Object.entries(PROVIDER_ALIAS).map(([prov, code]) => [code.toUpperCase(), prov])
);

// Kode service yang ditampilkan ke user, mis. "B519" (bukan "buzzer:519").
export function serviceCode(svc) {
    const a = PROVIDER_ALIAS[svc?._provider] || 'X';
    return `${a}${svc?._rawId ?? svc?.service ?? ''}`;
}

// Resolve input Bulk -> id internal prefixed yang valid.
// Terima: kode alias ("B519"), id mentah ("519"), atau id internal ("buzzer:519").
// Balikin { id } | { ambiguous: [kodeAlias...] } | { notFound: true }.
export function resolveServiceInput(input, services = []) {
    const raw = String(input || '').trim();
    if (!raw) return { notFound: true };

    // 1) id internal langsung (mis. "buzzer:519") — tetap didukung
    const direct = services.find(s => String(s.service) === raw);
    if (direct) return { id: direct.service };

    // 2) kode alias huruf+angka (mis. "B519")
    const m = raw.match(/^([A-Za-z]+)(\d+)$/);
    if (m) {
        const prov = ALIAS_TO_PROVIDER[m[1].toUpperCase()];
        if (prov) {
            const hit = services.find(s => s._provider === prov && String(s._rawId) === m[2]);
            if (hit) return { id: hit.service };
        }
    }

    // 3) id mentah angka (mis. "519")
    const byRaw = services.filter(s => String(s._rawId ?? s.service) === raw);
    if (byRaw.length === 1) return { id: byRaw[0].service };
    if (byRaw.length > 1) return { ambiguous: byRaw.map(serviceCode) };

    return { notFound: true };
}

// Deteksi layanan "Custom Comments" (user kirim daftar komentar, bukan quantity).
// Lebih toleran dari sekadar cek frasa "custom comment":
//  - SMMSOC (Perfect Panel) punya field type resmi "Custom Comments".
//  - Nama bisa beragam: "Youtube Comments [CUSTOM]", "Custom Comments",
//    "Komentar Custom", dll → cukup ada sinyal "comment/komentar" + "custom".
// Layanan komentar acak biasa (mis. "Instagram Comments" tanpa "custom")
// TIDAK ke-deteksi → tetap pakai quantity. Itu memang yang diinginkan.
export function isCustomCommentsSvc(svc) {
    if (!svc) return false;
    const type = String(svc.type || '').toLowerCase();
    const name = String(svc.name || '').toLowerCase();
    if (type.includes('custom comment')) return true;
    const hasComment = name.includes('comment') || name.includes('komentar');
    const hasCustom = name.includes('custom');
    return hasComment && hasCustom;
}