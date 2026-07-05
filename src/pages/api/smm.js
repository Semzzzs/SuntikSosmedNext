/**
 * API Proxy multi-provider (SMMSOC + BuzzerPanel, dst).
 *
 * Perubahan dari versi single-provider:
 *   1. Provider ditentukan dari PREFIX service id ("smmsoc:123" / "buzzer:456").
 *      Lihat providers.js. Logika auth/saldo/refund TIDAK berubah.
 *   2. Konversi USD->IDR HANYA untuk provider ber-currency USD (SMMSOC).
 *      Provider IDR (BuzzerPanel) memakai harga apa adanya (rate USD diabaikan).
 *   3. Daftar service = gabungan semua provider (listAllServices), sudah prefixed.
 *   4. Kolom `provider` disimpan di transaksi agar status/refill tahu tujuannya.
 *      -> Tambahkan kolom text `provider` di tabel transactions (default 'smmsoc').
 *
 * Auth user/admin & RPC debit/refund sama persis dengan versi lama.
 */
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import {
    listAllServices,
    getService,
    placeOrder,
    forwardAction,
    getBalance,
    normalizeStatusResponse,
    parseServiceId,
    configuredProviders,
    PROVIDERS,
} from './providers';

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

// Daftar service gabungan (~32rb item) bisa >4MB. Default API route Next.js
// dibatasi 4MB (memunculkan warning & berisiko ke-truncate kalau makin besar).
// Naikkan limitnya. Response tetap di-gzip otomatis, jadi transfer ke browser
// jauh lebih kecil dari angka mentah ini.
export const config = {
    api: { responseLimit: '12mb' },
};

export default async function handler(req, res) {
    const authHeader = req.headers.authorization;
    const isAdmin = verifyAdminJWT(authHeader);

    // ── Endpoint publik: markup global + rules ──
    if (req.query.action === 'get_public_markup') {
        try {
            const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const { data: mk } = await supa.from('settings').select('value').eq('key', 'markup').maybeSingle();
            const { data: rl } = await supa.from('settings').select('value').eq('key', 'markup_rules').maybeSingle();
            let markup = mk?.value ? parseFloat(mk.value) : 1;
            if (isNaN(markup) || markup < 1) markup = 1;
            let rules = { categories: {}, services: {}, providers: {} };
            try { if (rl?.value) { const p = JSON.parse(rl.value); rules = { categories: p.categories || {}, services: p.services || {}, providers: p.providers || {} }; } } catch { }
            return res.status(200).json({ markup, rules });
        } catch (e) {
            return res.status(200).json({ markup: 1, rules: { categories: {}, services: {} } });
        }
    }

    // ── Endpoint publik: estimasi durasi per service ──
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

    // ── Auth user (kecuali action=services yang publik) ──
    const publicAction = req.query.action === 'services';
    if (!isAdmin && !publicAction) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized. Silakan login terlebih dahulu.' });
        }
        const token = authHeader.split(' ')[1];
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Sesi tidak valid. Silakan login ulang.' });
        }
        try {
            const supaSvc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const { data: blk } = await supaSvc.from('settings').select('value').eq('key', 'blocked_emails').maybeSingle();
            const blockedEmails = blk?.value ? JSON.parse(blk.value) : [];
            if (user.email && blockedEmails.includes(user.email)) {
                return res.status(403).json({ error: 'Akun kamu telah diblokir. Hubungi admin untuk informasi lebih lanjut.' });
            }
        } catch (e) {
            console.error('[smm] gagal cek blocked_emails:', e.message);
            if (req.query.action === 'add') {
                return res.status(503).json({ error: 'Gagal memverifikasi status akun. Coba lagi.' });
            }
        }
    }

    const action = req.query.action;

    // ─────────────────────────────────────────────────────────
    // ACTION: services — gabungan semua provider, sudah prefixed.
    // ─────────────────────────────────────────────────────────
    if (action === 'services') {
        try {
            // Diagnostik: kalau tidak ada provider yang terkonfigurasi (env API key kosong),
            // beri tahu eksplisit daripada mengembalikan array kosong yang membingungkan.
            const configured = configuredProviders();
            if (configured.length === 0) {
                console.error('[smm] TIDAK ADA provider terkonfigurasi. Cek env SMM_API_KEY (dan BUZZER_API_KEY bila dipakai).');
                return res.status(500).json({ error: 'Provider belum dikonfigurasi (SMM_API_KEY kosong?). Cek .env.local.' });
            }

            let services = await listAllServices();
            if (!isAdmin) {
                // Sembunyikan service yang di-off-kan admin.
                //   - provider_status    : status DEFAULT per-provider, persisten
                //                          (mis. { buzzer: 'off', smmsoc: 'on' }).
                //                          Provider yang tak ada di sini = default 'on'.
                //   - disabled_services  : exception individual saat provider default ON
                //                          ("semua nyala, KECUALI id-id ini").
                //   - enabled_overrides  : exception individual saat provider default OFF
                //                          ("semua mati, KECUALI id-id ini").
                //
                // FIX dari versi lama: dulu cuma ada disabled_services berisi SNAPSHOT id
                // saat admin klik "Matikan Semua". Service baru yang provider tambahkan
                // belakangan tidak pernah masuk snapshot itu -> otomatis nongol aktif lagi.
                // Sekarang provider_status berlaku ke SEMUA id (lama & baru) dari provider
                // tsb, jadi service baru otomatis ikut status default provider-nya.
                try {
                    const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                    const [{ data: ds }, { data: ov }, { data: ps }] = await Promise.all([
                        supa.from('settings').select('value').eq('key', 'disabled_services').maybeSingle(),
                        supa.from('settings').select('value').eq('key', 'enabled_overrides').maybeSingle(),
                        supa.from('settings').select('value').eq('key', 'provider_status').maybeSingle(),
                    ]);
                    let disabled = [];
                    try { disabled = ds?.value ? JSON.parse(ds.value) : []; } catch { disabled = []; }
                    let overrides = [];
                    try { overrides = ov?.value ? JSON.parse(ov.value) : []; } catch { overrides = []; }
                    let providerStatus = {};
                    try { providerStatus = ps?.value ? JSON.parse(ps.value) : {}; } catch { providerStatus = {}; }

                    const disabledSet = new Set((Array.isArray(disabled) ? disabled : []).map(String));
                    const overrideSet = new Set((Array.isArray(overrides) ? overrides : []).map(String));

                    services = services.filter((s) => {
                        const id = String(s.service);
                        const providerKey = id.includes(':') ? id.split(':')[0] : null;
                        const providerDefaultOn = !providerKey || providerStatus[providerKey] !== 'off';

                        return providerDefaultOn
                            ? !disabledSet.has(id)   // default ON -> tampil kecuali di-exception-in off
                            : overrideSet.has(id);   // default OFF -> sembunyi kecuali di-exception-in on
                    });
                } catch (e) {
                    console.error('[smm] filter disabled services error:', e.message);
                }
            }
            return res.status(200).json(services);
        } catch (e) {
            console.error('[smm] listAllServices error:', e.message);
            return res.status(502).json({ error: 'Gagal mengambil daftar layanan.' });
        }
    }

    // ─────────────────────────────────────────────────────────
    // ACTION: add — buat order (user/admin).
    // ─────────────────────────────────────────────────────────
    if (action === 'add') {
        // ✅ POST: order (terutama custom comments yang bisa ratusan baris) dikirim
        //    via body, bukan query string — menghindari URL kepanjangan (limit
        //    ~8KB di Nginx/browser) yang bikin order komentar massal gagal.
        //    Fallback ke req.query agar caller lama (GET) tetap jalan.
        const src = (req.method === 'POST' && req.body && typeof req.body === 'object')
            ? req.body
            : req.query;
        const serviceId = src.service;              // prefixed, mis. "buzzer:5678"
        const link = src.link;
        const quantity = src.quantity;
        const comments = src.comments;

        const { providerKey } = parseServiceId(serviceId);
        if (!providerKey) {
            return res.status(400).json({ error: 'Layanan tidak valid (provider tidak dikenal).' });
        }

        // ── Validasi + debit ATOMIC (hanya user biasa) ──
        let debitInfo = null;
        if (!isAdmin) {
            const supabaseSvc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

            let totalIDR = null, userEmail = null, svcName = null, svcRate = null, providerCostIDR = null;
            try {
                const token = authHeader.split(' ')[1];
                const { data: { user: u } } = await supabaseSvc.auth.getUser(token);
                userEmail = u?.email || null;
                if (!userEmail) return res.status(401).json({ error: 'Sesi tidak valid. Silakan login ulang.' });

                // Rate USD->IDR (hanya relevan untuk provider USD).
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

                let markup = 1, markupRules = { categories: {}, services: {}, providers: {} };
                try {
                    const { data: mkData } = await supabaseSvc.from('settings').select('value').eq('key', 'markup').maybeSingle();
                    if (mkData?.value) markup = parseFloat(mkData.value);
                    const { data: rulesData } = await supabaseSvc.from('settings').select('value').eq('key', 'markup_rules').maybeSingle();
                    if (rulesData?.value) { const p = JSON.parse(rulesData.value); markupRules = { categories: p.categories || {}, services: p.services || {}, providers: p.providers || {} }; }
                } catch { }

                // Ambil service dari provider yang sesuai (sudah dinormalisasi + ada currency).
                const svc = await getService(serviceId);
                if (!svc || svc.rate == null) {
                    return res.status(400).json({ error: 'Layanan tidak ditemukan / harga tidak tersedia.' });
                }
                svcName = svc.name || null;
                svcRate = svc.rate;

                const qty = parseInt(quantity) || 0;
                if (qty <= 0) return res.status(400).json({ error: 'Jumlah order tidak valid.' });

                // Markup rules pakai ID prefixed untuk per-service, category apa adanya.
                const provKey = svc._provider || String(svc.service).split(':')[0];
                const effMarkup =
                    markupRules.services?.[String(svc.service)] ??
                    markupRules.categories?.[svc.category] ??
                    markupRules.providers?.[provKey] ??
                    markup;

                // ⚡ INTI MULTI-CURRENCY:
                //   USD  -> qty/1000 * rate(USD->IDR) * harga
                //   IDR  -> qty/1000 * harga   (TANPA rate)
                const fx = svc.currency === 'USD' ? rate : 1;
                totalIDR = Math.round(qty * svcRate / 1000 * fx * effMarkup);
                // Cost provider (TANPA markup) dinormalisasi ke IDR untuk laporan
                // profit lintas provider. totalIDR = harga ke user (sudah markup),
                // providerCostIDR = modal kita ke provider. Profit = selisihnya.
                providerCostIDR = Math.round(qty * svcRate / 1000 * fx);

                if (!Number.isFinite(totalIDR) || totalIDR <= 0) {
                    return res.status(400).json({ error: 'Gagal menghitung biaya order.' });
                }
            } catch (e) {
                console.error('[smm] Cost calc error:', e.message);
                return res.status(502).json({ error: 'Gagal memvalidasi biaya order. Coba lagi.' });
            }

            // Debit atomic.
            try {
                const { data: debit, error: rpcErr } = await supabaseSvc.rpc('debit_user_balance', {
                    p_email: userEmail,
                    p_amount: totalIDR,
                    p_description: `Order service ${serviceId} qty ${quantity}`,
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
                debitInfo = { email: userEmail, amount: totalIDR, tx_id: debit.tx_id, svcName, svcRate, providerCostIDR, currency: PROVIDERS[providerKey].currency };
            } catch (e) {
                console.error('[smm] debit exception:', e.message);
                return res.status(502).json({ error: 'Gagal memproses saldo. Coba lagi.' });
            }
        }

        // ── Kirim order ke provider yang benar ──
        try {
            const result = await placeOrder({ serviceId, link, quantity, comments });

            if (!result.ok) {
                // Refund kalau saldo sudah didebit.
                if (debitInfo) {
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
                }
                return res.status(502).json({ error: result.error || 'Order gagal di provider. Saldo dikembalikan.' });
            }

            // Sukses: lengkapi baris transaksi + simpan provider & order id provider.
            // PENTING: order_id adalah field yang dipakai My Orders buat nampilin order.
            // Kalau update ini gagal diam-diam, order jadi "tak terlihat" walau saldo
            // sudah dipotong. Catatan: supabase-js TIDAK throw saat query error, cuma
            // balikin { error } — jadi kita WAJIB cek error-nya, retry, dan sebagai
            // pamungkas minimal set order_id biar order tetap muncul.
            if (debitInfo) {
                const qtyNum = parseInt(quantity) || null;
                const supaEnrich = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                const enrichPayload = {
                    order_id: result.orderId,
                    provider: providerKey,
                    service_id: String(serviceId),         // prefixed (konsisten dengan daftar service)
                    link: link || null,
                    qty: qtyNum,
                    // 'charge' = harga pokok provider dalam satuan aslinya (USD/IDR) untuk laporan.
                    charge: debitInfo.svcRate != null ? (parseFloat(debitInfo.svcRate) * (qtyNum || 0) / 1000) : null,
                    // 'charge_idr' = modal provider yang SUDAH dinormalisasi ke IDR (aman di-SUM).
                    charge_idr: debitInfo.providerCostIDR ?? null,
                    description: `Order #${result.orderId} - ${(debitInfo.svcName || String(serviceId)).slice(0, 60)}`,
                };

                let enriched = false;
                for (let attempt = 1; attempt <= 3 && !enriched; attempt++) {
                    try {
                        const { error: upErr } = await supaEnrich
                            .from('transactions')
                            .update(enrichPayload)
                            .eq('id', debitInfo.tx_id);
                        if (!upErr) { enriched = true; break; }
                        console.error(`[smm] enrich gagal (attempt ${attempt}/3):`, upErr.message);
                    } catch (e) {
                        console.error(`[smm] enrich exception (attempt ${attempt}/3):`, e.message);
                    }
                    await new Promise(r => setTimeout(r, 250 * attempt)); // backoff kecil
                }

                // Pamungkas: minimal set order_id + provider supaya order TETAP terlihat
                // di My Orders walau field kosmetik (link/qty/charge) gagal ke-update.
                if (!enriched) {
                    try {
                        const { error: minErr } = await supaEnrich
                            .from('transactions')
                            .update({ order_id: result.orderId, provider: providerKey })
                            .eq('id', debitInfo.tx_id);
                        if (minErr) {
                            console.error('[smm] set order_id minimal GAGAL (PERLU rekonsiliasi manual):', minErr.message, { tx_id: debitInfo.tx_id, order_id: result.orderId, provider: providerKey });
                        } else {
                            console.error('[smm] enrich penuh gagal, tapi order_id ke-set — order tetap terlihat. tx:', debitInfo.tx_id);
                        }
                    } catch (e) {
                        console.error('[smm] set order_id minimal exception (PERLU rekonsiliasi manual):', e.message, { tx_id: debitInfo.tx_id, order_id: result.orderId, provider: providerKey });
                    }
                }
            }

            // Bentuk respons konsisten dengan versi lama: { order: <id> }.
            return res.status(200).json({ order: result.orderId, ...result.raw });
        } catch (err) {
            // Exception tak terduga setelah debit -> refund.
            if (debitInfo) {
                try {
                    const supaRefund = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                    await supaRefund.rpc('refund_order_tx', {
                        p_tx_id: debitInfo.tx_id,
                        p_email: debitInfo.email,
                        p_amount: debitInfo.amount,
                        p_reason: 'provider_exception',
                    });
                } catch (e) {
                    console.error('[smm] refund gagal (PERLU rekonsiliasi manual):', e.message, debitInfo);
                }
            }
            return res.status(500).json({ error: `Proxy error: ${err.message}` });
        }
    }

    // ─────────────────────────────────────────────────────────
    // ACTION: balance — saldo akun di provider. Per-provider (saldo tiap
    //   provider terpisah). Default smmsoc; pakai ?provider=buzzer untuk yang lain.
    // ─────────────────────────────────────────────────────────
    if (action === 'balance') {
        const providerKey = req.query.provider || 'smmsoc';
        try {
            const b = await getBalance(providerKey);
            if (!b.ok) return res.status(502).json({ error: b.error || 'Gagal mengambil saldo.' });
            // Bentuk respons konsisten dengan SMMSOC: { balance, currency }.
            return res.status(200).json({ balance: b.balance, currency: b.currency });
        } catch (e) {
            return res.status(500).json({ error: `Proxy error: ${e.message}` });
        }
    }

    // ─────────────────────────────────────────────────────────
    // ACTION: provider_balances — saldo SEMUA provider terkonfigurasi sekaligus
    //   (buat panel admin). Tiap provider punya currency sendiri (SMMSOC=USD,
    //   BuzzerPanel=IDR). Admin-only: saldo grosir provider bukan info user.
    // ─────────────────────────────────────────────────────────
    if (action === 'provider_balances') {
        if (!isAdmin) return res.status(403).json({ error: 'Hanya admin.' });
        try {
            const list = configuredProviders();
            const providers = await Promise.all(list.map(async (p) => {
                try {
                    const b = await getBalance(p.key);
                    return {
                        key: p.key,
                        label: p.label || p.key,
                        currency: p.currency || 'USD',
                        balance: b.ok ? b.balance : null,
                        error: b.ok ? null : (b.error || 'Gagal mengambil saldo.'),
                    };
                } catch (e) {
                    return { key: p.key, label: p.label || p.key, currency: p.currency || 'USD', balance: null, error: e.message };
                }
            }));
            return res.status(200).json({ providers });
        } catch (e) {
            return res.status(500).json({ error: `Proxy error: ${e.message}` });
        }
    }

    // ─────────────────────────────────────────────────────────
    // ACTION: status / refill / cancel — forward ke provider asal order.
    //   - Single: ?order=123 [&provider=buzzer]
    //   - Multi:  ?orders=1,2,3&provider=buzzer  (semua order HARUS provider sama;
    //             ApiContext sudah memecah per provider sebelum memanggil ini)
    //   Provider: dari ?provider= kalau ada; kalau tidak, di-lookup dari kolom
    //   transactions.provider berdasar order_id (hanya untuk single order).
    // ─────────────────────────────────────────────────────────
    if (action === 'status' || action === 'refill' || action === 'cancel') {
        const orderId = req.query.order;
        const ordersCsv = req.query.orders;        // multi (CSV)
        let providerKey = req.query.provider || null;

        // Resolve provider kalau tidak dikirim eksplisit.
        if (!providerKey) {
            // Untuk multi tanpa provider, kita tak bisa tahu campuran -> butuh provider
            // dari client. Tapi untuk kompatibilitas, lookup pakai order pertama.
            const lookupId = orderId || (ordersCsv ? String(ordersCsv).split(',')[0].trim() : null);
            if (lookupId) {
                try {
                    const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
                    // ⚠️ order_id TIDAK unik antar provider (SMMSOC & Buzzer bisa sama-sama
                    // punya #1234). Jangan maybeSingle() — itu error/ambil sembarang row
                    // kalau ada >1. Ambil maksimal 2, lalu putuskan dengan aman.
                    const { data: rows } = await supa
                        .from('transactions')
                        .select('provider')
                        .eq('order_id', String(lookupId))
                        .limit(2);
                    const provs = [...new Set((rows || []).map(r => r.provider).filter(Boolean))];
                    if (provs.length === 1) {
                        providerKey = provs[0];
                    } else if (provs.length > 1) {
                        // Tabrakan asli: order_id sama ada di >1 provider. Tak bisa ditebak.
                        return res.status(409).json({
                            error: 'Order ID ambigu antar provider. Sertakan parameter ?provider=.',
                        });
                    }
                    // provs.length === 0 -> mungkin row lama tanpa kolom provider.
                    // Biarkan jatuh ke fallback 'smmsoc' di bawah (data lama = SMMSOC).
                } catch (e) {
                    console.error('[smm] lookup provider error:', e.message);
                }
            }
        }
        if (!providerKey) providerKey = 'smmsoc'; // fallback data lama

        const provDef = PROVIDERS[providerKey];

        try {
            // ── STATUS MULTI (orders=csv) ──
            if (action === 'status' && ordersCsv) {
                const ids = String(ordersCsv).split(',').map(s => s.trim()).filter(Boolean);

                if (provDef?.supportsMultiStatus) {
                    // SMMSOC: satu request, response sudah { orderId: {...} }.
                    const r = await forwardAction({ providerKey, action, params: { orders: ids.join(',') } });
                    if (!r.json) return res.status(r.status || 502).send(r.text || '');
                    // Normalisasi tiap entry agar field seragam.
                    const out = {};
                    for (const [oid, info] of Object.entries(r.json)) {
                        out[oid] = normalizeStatusResponse(providerKey, info);
                    }
                    return res.status(200).json(out);
                }

                // BuzzerPanel: tak ada multistatus -> loop per id (paralel), gabung.
                const out = {};
                await Promise.all(ids.map(async (oid) => {
                    try {
                        const r = await forwardAction({ providerKey, action, params: { order: oid } });
                        out[oid] = r.json ? normalizeStatusResponse(providerKey, r.json) : { error: 'Status tidak tersedia.' };
                    } catch (e) {
                        out[oid] = { error: e.message };
                    }
                }));
                return res.status(200).json(out);
            }

            // ── SINGLE (status/refill/cancel satu order) ──
            const r = await forwardAction({ providerKey, action, params: { order: orderId } });
            if (!r.json) return res.status(r.status || 502).send(r.text || '');
            // Untuk status single, normalisasi juga supaya konsisten.
            if (action === 'status') return res.status(200).json(normalizeStatusResponse(providerKey, r.json));
            return res.status(200).json(r.json);
        } catch (e) {
            return res.status(500).json({ error: `Proxy error: ${e.message}` });
        }
    }

    return res.status(400).json({ error: 'Action tidak dikenal.' });
}