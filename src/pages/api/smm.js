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

    // ✅ Whitelist params — cegah override 'key' atau inject param arbitrary
    const ALLOWED = new Set(['action', 'service', 'link', 'quantity', 'order', 'orders']);
    const safeQuery = Object.fromEntries(
        Object.entries(req.query).filter(([k]) => ALLOWED.has(k))
    );

    // ✅ Validasi saldo server-side saat action=add (user biasa, bukan admin)
    if (safeQuery.action === 'add' && !isAdmin) {
        try {
            const token = authHeader.split(' ')[1];
            const supabaseCheck = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            const { data: { user: u } } = await supabaseCheck.auth.getUser(token);
            if (u?.email) {
                const { data: txs } = await supabaseCheck
                    .from('transactions')
                    .select('type, amount, status')
                    .eq('email', u.email);

                const masuk = (txs || []).filter(t => ['deposit', 'bonus', 'refund'].includes(t.type) && t.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
                const keluar = (txs || []).filter(t => t.type === 'order' && t.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
                const balance = Math.max(0, masuk - keluar);

                // Ambil rate USD->IDR
                let rate = 17689;
                try {
                    const rateRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/rate`);
                    const rateData = await rateRes.json();
                    if (rateData.rate) rate = rateData.rate;
                } catch { }

                // Ambil markup
                let markup = 1;
                try {
                    const { data: mkData } = await supabaseCheck.from('settings').select('value').eq('key', 'markup').maybeSingle();
                    if (mkData?.value) markup = parseFloat(mkData.value);
                } catch { }

                // Ambil harga service dari SMMSOC
                const svcRes = await fetch(`${apiUrl}/api/v2`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ key: apiKey, action: 'services' }).toString(),
                });
                const svcData = await svcRes.json();
                const svc = Array.isArray(svcData) ? svcData.find(s => String(s.service) === String(safeQuery.service)) : null;

                if (svc) {
                    const qty = parseInt(safeQuery.quantity) || 0;
                    const totalIDR = Math.round(qty * parseFloat(svc.rate || 0) / 1000 * rate * markup);
                    if (totalIDR > balance) {
                        return res.status(402).json({ error: `Saldo tidak cukup. Saldo: Rp ${Math.round(balance).toLocaleString('id-ID')}, Dibutuhkan: Rp ${totalIDR.toLocaleString('id-ID')}` });
                    }
                }
            }
        } catch (e) {
            console.error('[smm] Balance check error:', e.message);
            // Fail open — jangan block order kalau balance check error
        }
    }

    try {
        const body = new URLSearchParams({
            key: apiKey,
            ...safeQuery,
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