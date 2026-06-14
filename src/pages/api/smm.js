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

    // ✅ Endpoint publik: baca markup global + rules (pakai service role agar lolos RLS).
    //    Dipakai user page untuk menampilkan harga yang benar tanpa akses langsung ke tabel settings.
    if (req.query.action === 'get_public_markup') {
        try {
            const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const { data: mk } = await supa.from('settings').select('value').eq('key', 'markup').maybeSingle();
            const { data: rl } = await supa.from('settings').select('value').eq('key', 'markup_rules').maybeSingle();
            let markup = mk?.value ? parseFloat(mk.value) : 1;
            if (isNaN(markup) || markup < 1) markup = 1;
            let rules = { categories: {}, services: {} };
            try { if (rl?.value) { const p = JSON.parse(rl.value); rules = { categories: p.categories || {}, services: p.services || {} }; } } catch { }
            return res.status(200).json({ markup, rules });
        } catch (e) {
            return res.status(200).json({ markup: 1, rules: { categories: {}, services: {} } });
        }
    }

    // ✅ Endpoint publik: estimasi durasi per service (dari worker poller).
    //    Dipakai halaman Services untuk menampilkan estimasi berbasis order asli.
    if (req.query.action === 'service_stats') {
        try {
            const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const { data } = await supa.from('service_stats').select('service_id, avg_seconds, sample_count');
            const stats = {};
            for (const r of (data || [])) {
                stats[String(r.service_id)] = { avg_seconds: r.avg_seconds, sample_count: r.sample_count };
            }
            return res.status(200).json(stats);
        } catch (e) {
            return res.status(200).json({});
        }
    }

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
    const ALLOWED = new Set(['action', 'service', 'link', 'quantity', 'order', 'orders', 'comments']);
    const safeQuery = Object.fromEntries(
        Object.entries(req.query).filter(([k]) => ALLOWED.has(k))
    );

    // ✅ Validasi + pemotongan saldo ATOMIC saat action=add (user biasa, bukan admin).
    //
    //    Versi lama: cuma BACA saldo (sum ledger) lalu bandingkan, dan pemotongan
    //    di-insert CLIENT-SIDE setelah sukses. Itu bocor total:
    //      - client bisa skip pemotongan  -> order tak terbatas
    //      - bulk/multi-tab baca saldo sama -> over-spend (race)
    //      - catch fail-open               -> error = order tetap jalan
    //
    //    Versi ini: biaya dihitung server-side (FAIL-CLOSED), lalu di-debit lewat
    //    RPC `debit_user_balance` yang ngecek + insert debit dalam SATU transaksi DB
    //    dengan lock per-user. Tiap request bener-bener motong saldo sebelum request
    //    berikutnya dicek, jadi bulk otomatis aman tanpa penanganan khusus.
    //
    //    PENTING: client TIDAK BOLEH lagi insert transaksi 'order' sendiri (lihat catatan
    //    di ViewNewOrder) — kalau masih, saldo kepotong dobel.
    let debitInfo = null; // { email, amount, tx_id } -> dipakai buat refund kalau provider gagal
    if (safeQuery.action === 'add' && !isAdmin) {
        const supabaseSvc = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 1) Hitung biaya order server-side. FAIL-CLOSED: kalau biaya tak bisa
        //    ditentukan (service tak ketemu / harga gagal diambil), TOLAK order.
        let totalIDR = null;
        let userEmail = null;
        let svcName = null;
        let svcRate = null;
        try {
            const token = authHeader.split(' ')[1];
            const { data: { user: u } } = await supabaseSvc.auth.getUser(token);
            userEmail = u?.email || null;
            if (!userEmail) return res.status(401).json({ error: 'Sesi tidak valid. Silakan login ulang.' });

            // Rate USD->IDR
            let rate = 17689;
            try {
                const { data: rOverride } = await supabaseSvc.from('settings').select('value').eq('key', 'rate_override').maybeSingle();
                const ov = rOverride?.value ? parseInt(rOverride.value, 10) : 0;
                if (ov && ov >= 1000) {
                    rate = ov;
                } else {
                    const rr = await fetch('https://open.er-api.com/v6/latest/USD');
                    const rd = await rr.json();
                    if (rd?.result === 'success' && rd?.rates?.IDR) rate = Math.round(rd.rates.IDR);
                }
            } catch { }

            // Markup global + rules per-kategori/per-service
            let markup = 1;
            let markupRules = { categories: {}, services: {} };
            try {
                const { data: mkData } = await supabaseSvc.from('settings').select('value').eq('key', 'markup').maybeSingle();
                if (mkData?.value) markup = parseFloat(mkData.value);
                const { data: rulesData } = await supabaseSvc.from('settings').select('value').eq('key', 'markup_rules').maybeSingle();
                if (rulesData?.value) { const p = JSON.parse(rulesData.value); markupRules = { categories: p.categories || {}, services: p.services || {} }; }
            } catch { }

            // Harga service dari SMMSOC
            const svcRes = await fetch(`${apiUrl}/api/v2`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ key: apiKey, action: 'services' }).toString(),
            });
            const svcData = await svcRes.json();
            const svc = Array.isArray(svcData) ? svcData.find(s => String(s.service) === String(safeQuery.service)) : null;

            // FAIL-CLOSED: tanpa harga yang valid, jangan pasang order.
            if (!svc) return res.status(400).json({ error: 'Layanan tidak ditemukan / harga tidak tersedia.' });

            svcName = svc.name || null;
            svcRate = svc.rate || null;

            const qty = parseInt(safeQuery.quantity) || 0;
            if (qty <= 0) return res.status(400).json({ error: 'Jumlah order tidak valid.' });

            const effMarkup = markupRules.services?.[String(svc.service)] ?? markupRules.categories?.[svc.category] ?? markup;
            totalIDR = Math.round(qty * parseFloat(svc.rate || 0) / 1000 * rate * effMarkup);
            if (!Number.isFinite(totalIDR) || totalIDR <= 0) {
                return res.status(400).json({ error: 'Gagal menghitung biaya order.' });
            }
        } catch (e) {
            console.error('[smm] Cost calc error:', e.message);
            return res.status(502).json({ error: 'Gagal memvalidasi biaya order. Coba lagi.' });
        }

        // 2) Debit ATOMIC via RPC (check + insert debit dalam 1 transaksi, terkunci per-user).
        try {
            const { data: debit, error: rpcErr } = await supabaseSvc.rpc('debit_user_balance', {
                p_email: userEmail,
                p_amount: totalIDR,
                p_description: `Order service ${safeQuery.service} qty ${safeQuery.quantity}`,
            });
            if (rpcErr) {
                console.error('[smm] debit RPC error:', rpcErr.message);
                return res.status(502).json({ error: 'Gagal memproses saldo. Coba lagi.' });
            }
            if (!debit?.ok) {
                if (debit?.error === 'insufficient') {
                    const bal = Math.round(debit.balance || 0);
                    return res.status(402).json({ error: `Saldo tidak cukup. Saldo: Rp ${bal.toLocaleString('id-ID')}, Dibutuhkan: Rp ${totalIDR.toLocaleString('id-ID')}` });
                }
                return res.status(400).json({ error: 'Order ditolak.' });
            }
            debitInfo = { email: userEmail, amount: totalIDR, tx_id: debit.tx_id, svcName, svcRate };
        } catch (e) {
            console.error('[smm] debit exception:', e.message);
            return res.status(502).json({ error: 'Gagal memproses saldo. Coba lagi.' });
        }
    }

    try {
        // Custom Comments: provider menghitung jumlah dari daftar komentar,
        // jadi 'quantity' tidak diteruskan ke provider (tetap dipakai untuk cek saldo di atas).
        const forwardQuery = { ...safeQuery };
        if (forwardQuery.comments) delete forwardQuery.quantity;

        const body = new URLSearchParams({
            key: apiKey,
            ...forwardQuery,
        });

        const response = await fetch(`${apiUrl}/api/v2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        const text = await response.text();
        try {
            const data = JSON.parse(text);

            // ✅ Order ke provider gagal tapi saldo SUDAH didebit -> refund (kompensasi).
            //    SMMSOC sukses kalau ada `data.order`; selain itu dianggap gagal.
            if (debitInfo && (!response.ok || !data || data.error || !data.order)) {
                try {
                    const supaRefund = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                    await supaRefund.rpc('refund_order_tx', {
                        p_tx_id: debitInfo.tx_id,
                        p_email: debitInfo.email,
                        p_amount: debitInfo.amount,
                        p_reason: 'provider_failed',
                    });
                } catch (e) {
                    console.error('[smm] refund gagal (PERLU rekonsiliasi manual):', e.message, debitInfo);
                }
                return res.status(502).json({ error: data?.error || 'Order gagal di provider. Saldo dikembalikan.' });
            }
            // ✅ Sembunyikan layanan yang dimatikan admin dari daftar service.
            //    Hanya untuk user/publik (admin tetap lihat semua agar bisa kelola).
            if (safeQuery.action === 'services' && Array.isArray(data) && !isAdmin) {
                try {
                    const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                    const { data: ds } = await supa.from('settings').select('value').eq('key', 'disabled_services').maybeSingle();
                    let disabled = [];
                    try { disabled = ds?.value ? JSON.parse(ds.value) : []; } catch { disabled = []; }
                    if (Array.isArray(disabled) && disabled.length) {
                        const off = new Set(disabled.map(String));
                        const filtered = data.filter(s => !off.has(String(s.service)));
                        return res.status(200).json(filtered);
                    }
                } catch (e) {
                    console.error('[smm] filter disabled services error:', e.message);
                    // kalau gagal, kirim apa adanya (jangan sampai daftar service kosong)
                }
            }

            // ✅ Order sukses: lengkapi baris transaksi debit dengan metadata order.
            //    Ini menggantikan insert client lama di ViewNewOrder, jadi histori/admin
            //    Orders tetap punya order_id, service_id, link, qty, charge, description.
            if (debitInfo && data?.order) {
                try {
                    const qtyNum = parseInt(safeQuery.quantity) || null;
                    const supaEnrich = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                    await supaEnrich.from('transactions').update({
                        order_id: String(data.order),
                        service_id: String(safeQuery.service),
                        link: safeQuery.link || null,
                        qty: qtyNum,
                        charge: debitInfo.svcRate != null ? (parseFloat(debitInfo.svcRate) * (qtyNum || 0) / 1000) : null,
                        description: `Order #${data.order} - ${(debitInfo.svcName || String(safeQuery.service)).slice(0, 60)}`,
                    }).eq('id', debitInfo.tx_id);
                } catch (e) {
                    console.error('[smm] enrich tx gagal (non-fatal, saldo tetap benar):', e.message);
                }
            }

            return res.status(200).json(data);
        } catch {
            // Response provider bukan JSON valid. Kalau saldo udah didebit -> refund.
            if (debitInfo) {
                try {
                    const supaRefund = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                    await supaRefund.rpc('refund_order_tx', {
                        p_tx_id: debitInfo.tx_id,
                        p_email: debitInfo.email,
                        p_amount: debitInfo.amount,
                        p_reason: 'provider_bad_response',
                    });
                } catch (e) {
                    console.error('[smm] refund gagal (PERLU rekonsiliasi manual):', e.message, debitInfo);
                }
                return res.status(502).json({ error: 'Order gagal di provider. Saldo dikembalikan.' });
            }
            return res.status(response.status).send(text);
        }
    } catch (err) {
        return res.status(500).json({ error: `Proxy error: ${err.message}` });
    }
}