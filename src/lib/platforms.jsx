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

// ── Icon SVG per platform (key = PLATFORMS.icon) ──
export const PlatformIcons = {
    all: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>,
    instagram: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4.5" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>,
    facebook: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>,
    telegram: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>,
    tiktok: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.73a4.85 4.85 0 0 1-1.01-.04z" /></svg>,
    twitter: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
    youtube: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" /><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white" /></svg>,
    whatsapp: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M11.999 1.999C6.478 1.999 2 6.478 2 12c0 1.818.483 3.522 1.329 4.997L2 22l5.145-1.311A9.956 9.956 0 0 0 12 22c5.522 0 10-4.478 10-10.001C22 6.478 17.522 1.999 11.999 1.999z" /></svg>,
    spotify: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="12" r="10" /><path d="M8 13.5c2.5-1 5.5-.8 7.5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" /><path d="M7 10.5c3-1.3 6.5-1 9 .8" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" /><path d="M6.5 7.5c3.5-1.5 7.5-1.2 10.5 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>,
    linkedin: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>,
    // ── apk tambahan (icon sederhana, silakan refine) ──
    threads: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 12a4 4 0 1 0-3 3.9" /><path d="M15 8.5v4.5a2 2 0 0 0 4 0 7 7 0 1 0-3 5.7" /></svg>,
    bigo: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" /></svg>,
    soundcloud: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 14v-3M8 16V8M12 17V7M16 16v-7M20 15v-5" /></svg>,
    shopee: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 7h12l1 13H5L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>,
    tokopedia: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M4 9l1.5-4h13L20 9M4 9v10h16V9M4 9h16M9 19v-5h6v5" /></svg>,
    discord: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M8 5h8a3 3 0 0 1 3 3v9a2 2 0 0 1-2 2l-1.5-2H8.5L7 19a2 2 0 0 1-2-2V8a3 3 0 0 1 3-3z" /><circle cx="9.5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none" /></svg>,
    twitch: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M4 4h16v10l-4 4h-4l-3 3v-3H4V4z" /><path d="M10 8v4M14 8v4" /></svg>,
    website: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></svg>,
    other: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>,
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