/**
 * API Proxy untuk smmsoc.com
 * - User biasa: wajib Supabase session token
 * - Admin: wajib JWT Bearer token (di-sign pakai ADMIN_SECRET)
 *
 * PERUBAHAN:
 *   1. Admin auth dulu pakai x-admin-secret = ADMIN_SECRET mentah.
 *      Sekarang pakai Authorization: Bearer <JWT> — sama seperti /api/admin-api.
 *      index.jsx sudah mengirim JWT via adminFetch(), tidak perlu ubah di sana.
 *   2. SMM_API_KEY dan SMM_API_URL dihapus prefix NEXT_PUBLIC_.
 *      Update juga di .env.local: NEXT_PUBLIC_SMM_API_KEY -> SMM_API_KEY
 *                                 NEXT_PUBLIC_SMM_API_URL -> SMM_API_URL
 */
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// ✅ Verifikasi JWT admin — sama persis dengan verifyAdminToken di admin-api.js
function verifyAdminJWT(authHeader) {
    if (!authHeader?.startsWith('Bearer ')) return false;
    const token = authHeader.split(' ')[1];
    const secret = process.env.ADMIN_SECRET;
    if (!secret) return false;
    try {
        const payload = jwt.verify(token, secret, { issuer: 'smm-admin' });
        return payload.role === 'admin';
    } catch {
        return false;
    }
}

export default async function handler(req, res) {
    const authHeader = req.headers.authorization;

    // ✅ Admin: verifikasi JWT (bukan raw ADMIN_SECRET)
    const isAdmin = verifyAdminJWT(authHeader);

    // ✅ Kalau bukan admin, cek Supabase user token
    // Kecuali action=services — boleh tanpa login (untuk landing page)
    const publicAction = req.query.action === 'services';
    if (!isAdmin && !publicAction) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized. Silakan login terlebih dahulu.' });
        }

        const token = authHeader.split(' ')[1];
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Sesi tidak valid. Silakan login ulang.' });
        }
    }

    // ✅ Tanpa NEXT_PUBLIC_ — key tidak masuk ke browser bundle
    const apiUrl = process.env.SMM_API_URL || 'https://smmsoc.com';
    const apiKey = process.env.SMM_API_KEY;

    if (!apiKey) {
        return res.status(400).json({ error: 'API Key belum dikonfigurasi.' });
    }

    try {
        const body = new URLSearchParams({
            key: apiKey,
            ...req.query,
        });

        const response = await fetch(`${apiUrl}/api/v2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            return res.status(200).json(data);
        } catch {
            return res.status(response.status).send(text);
        }
    } catch (err) {
        return res.status(500).json({ error: `Proxy error: ${err.message}` });
    }
}