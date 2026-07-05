// API Route: /api/check-blocked
// Dipakai dashboard user untuk mengecek apakah akunnya diblokir admin.
//
// Alur:
//   1. Verifikasi session token user (anon key, via getUser)
//   2. Baca settings.blocked_emails pakai service role (bypass RLS)
//   3. Balas { blocked: true|false }
//
// Endpoint ini sengaja dipisah dari /api/admin-api karena dipanggil oleh
// USER BIASA (bukan admin), jadi tidak butuh admin JWT.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const token = authHeader.split(' ')[1];

        // 1) Verifikasi user dari token (anon key cukup untuk getUser)
        const supaAnon = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
        const { data: { user }, error } = await supaAnon.auth.getUser(token);
        if (error || !user?.email) {
            return res.status(401).json({ error: 'Sesi tidak valid.' });
        }

        // 2) Baca daftar blokir via service role (lolos RLS)
        const supaSvc = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const { data: blk } = await supaSvc
            .from('settings')
            .select('value')
            .eq('key', 'blocked_emails')
            .maybeSingle();
        // ✅ Fix: JSON.parse di-bungkus try/catch sendiri (bukan cuma andelin
        //         catch terluar) + validasi hasil parse harus array. Kalau
        //         value di DB kosong/rusak/bukan array, fallback ke [] —
        //         jangan sampai nge-crash cek blokir gara-gara data kotor.
        let blockedEmails = [];
        if (blk?.value) {
            try {
                const parsed = JSON.parse(blk.value);
                if (Array.isArray(parsed)) blockedEmails = parsed;
            } catch (parseErr) {
                console.error('[check-blocked] gagal parse blocked_emails:', parseErr.message);
            }
        }

        return res.status(200).json({ blocked: blockedEmails.includes(user.email) });
    } catch (e) {
        console.error('[check-blocked] error:', e.message);
        // FAIL-OPEN: kalau cek gagal, jangan kunci user (hindari false-positive logout).
        //            Penegakan utama tetap ada di /api/smm saat order.
        return res.status(200).json({ blocked: false });
    }
}