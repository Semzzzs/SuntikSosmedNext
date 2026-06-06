// API Route: /api/admin-auth
// .env.local: ADMIN_USERNAME=xxx  ADMIN_PASSWORD=xxx  ADMIN_SECRET=random_string_panjang
//
// DEPENDENCY: npm install jsonwebtoken
// PERUBAHAN:  Sebelumnya mengembalikan ADMIN_SECRET mentah sebagai token.
//             Sekarang mengembalikan JWT ber-expiry (8 jam) yang di-sign pakai ADMIN_SECRET.
//             ADMIN_SECRET tidak pernah dikirim ke client.

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Verifikasi password scrypt (format sama dengan admin-api.js)
function verifyPassword(password, stored) {
    try {
        const [scheme, saltHex, hashHex] = String(stored).split('$');
        if (scheme !== 'scrypt') return false;
        const salt = Buffer.from(saltHex, 'hex');
        const expected = Buffer.from(hashHex, 'hex');
        const actual = crypto.scryptSync(String(password), salt, expected.length);
        return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
    } catch {
        return false;
    }
}

// ── Rate limiting sederhana in-memory ──────────────────────────────────────
// Untuk production pakai @upstash/ratelimit agar persist di-across serverless instances.
const failMap = new Map(); // ip -> { count, resetAt }
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 menit

function isRateLimited(ip) {
    const now = Date.now();
    const entry = failMap.get(ip);
    if (!entry || now > entry.resetAt) {
        failMap.set(ip, { count: 0, resetAt: now + WINDOW_MS });
        return false;
    }
    return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip) {
    const now = Date.now();
    const entry = failMap.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
    entry.count += 1;
    failMap.set(ip, entry);
}

function resetFailures(ip) {
    failMap.delete(ip);
}

// ──────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const correctUser = process.env.ADMIN_USERNAME;
    const correctPass = process.env.ADMIN_PASSWORD;
    const secret = process.env.ADMIN_SECRET;

    if (!correctUser || !correctPass || !secret) {
        console.error('[admin-auth] ADMIN env variables not set!');
        return res.status(500).json({ ok: false, error: 'Server misconfigured.' });
    }

    // Ambil IP untuk rate limiting (support behind proxy/Vercel)
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
        .split(',')[0].trim();

    if (isRateLimited(ip)) {
        return res.status(429).json({ ok: false, error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ ok: false, error: 'Username dan password wajib diisi.' });
    }

    // ✅ Verifikasi password: pakai hash di settings kalau ada, fallback ke ADMIN_PASSWORD env.
    // Lupa password? Hapus row settings key='admin_password_hash' → env password aktif lagi.
    let passOk = false;
    if (username === correctUser) {
        try {
            const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const { data: hashData } = await supabase.from('settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
            passOk = hashData?.value ? verifyPassword(password, hashData.value) : (password === correctPass);
        } catch {
            passOk = (password === correctPass); // DB error → fail-safe ke env
        }
    }

    if (passOk) {
        resetFailures(ip);

        // ✅ Return JWT — bukan ADMIN_SECRET mentah
        // Payload minimal: role saja. Tidak perlu data sensitif di payload.
        const token = jwt.sign(
            { role: 'admin' },
            secret,
            { expiresIn: '8h', issuer: 'smm-admin' }
        );

        return res.status(200).json({ ok: true, token });
    }

    // Login gagal
    recordFailure(ip);

    // Tambah sedikit delay konstan (bukan setTimeout async) — cukup untuk cegah timing oracle
    const start = Date.now();
    while (Date.now() - start < 300) { /* busy wait 300ms */ }

    return res.status(401).json({ ok: false, error: 'Username atau password salah.' });
}