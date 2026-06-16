/**
 * providers.js — Abstraksi multi-provider untuk panel SMM.
 *
 * Tujuan: smm.js cukup tahu "provider mana" + "service apa", tanpa peduli
 * beda endpoint / nama param / nama field / currency tiap upstream.
 *
 * KONSEP ID BER-PREFIX:
 *   Service ID yang dilihat user/admin = "<providerKey>:<rawId>", contoh:
 *     "smmsoc:1234"  ->  provider SMMSOC, service asli 1234
 *     "buzzer:5678"  ->  provider BuzzerPanel, service asli 5678
 *   Ini mencegah tabrakan ID antar provider (ID 100 bisa ada di dua-duanya).
 *   parseServiceId() memecah prefix; listServices() menambahkan prefix balik.
 *
 * CURRENCY:
 *   Tiap provider mendeklarasikan currency-nya. smm.js pakai ini untuk
 *   memutuskan apakah perlu konversi USD->IDR (SMMSOC) atau tidak (BuzzerPanel).
 *
 * ⚠️ FIELD MAPPING BUZZERPANEL — VERIFIKASI DULU:
 *   Nama field di response BuzzerPanel (id/price/name/category dst) diambil
 *   dari pola Perfect Panel + dugaan. normalizeService() mencoba beberapa
 *   nama yang umum, tapi PASTIKAN cocok dengan dokumentasi asli (tab Layanan).
 *   Cara cek cepat ada di bawah file ini (lihat blok komentar "CARA TES").
 */

// ─────────────────────────────────────────────────────────────
// Registry provider
// ─────────────────────────────────────────────────────────────
export const PROVIDERS = {
    smmsoc: {
        key: 'smmsoc',
        label: 'SMMSOC',
        currency: 'USD',            // rate per 1000 dalam USD -> perlu konversi ke IDR
        endpoint: () => process.env.SMM_API_URL || 'https://smmsoc.com',
        path: '/api/v2',
        apiKey: () => process.env.SMM_API_KEY,
        secretKey: () => null,      // SMMSOC cukup 1 key
        // Param auth + nama action menurut Perfect Panel klasik
        actions: { services: 'services', order: 'add', status: 'status', refill: 'refill', cancel: 'cancel', balance: 'balance' },
        // Cara menaruh credential ke body
        authParams: (p) => ({ key: p.apiKey() }),
        // Field untuk link & jumlah pada saat order
        orderParams: { link: 'link', quantity: 'quantity', comments: 'comments' },
        // Field response saat sukses bikin order (cek keberadaan ini = sukses)
        orderIdField: 'order',
        // ── Param & bentuk response khas SMMSOC (Perfect Panel klasik) ──
        statusParam: 'order',       // status pakai ?order=<id> atau ?orders=csv
        supportsMultiStatus: true,  // bisa banyak order sekaligus (orders=1,2,3)
        wrapped: false,             // response array/objek langsung (tidak dibungkus)
        balanceField: 'balance',    // { balance: "12.34", currency: "USD" }
        errorPath: 'error',         // pesan error di field 'error'
    },

    buzzer: {
        key: 'buzzer',
        label: 'BuzzerPanel',
        currency: 'IDR',            // harga sudah Rupiah -> JANGAN dikali rate USD
        endpoint: () => process.env.BUZZER_API_URL || 'https://buzzerpanel.id',
        path: '/api/json.php',
        apiKey: () => process.env.BUZZER_API_KEY,
        secretKey: () => process.env.BUZZER_SECRET_KEY,
        // ✅ Verified dari dokumentasi:
        //    - buat pesanan  = 'order'
        //    - cek status    = 'status'  (param: id, SATU id per request)
        //    - cek saldo     = 'profile' (BUKAN 'balance')
        actions: { services: 'services', order: 'order', status: 'status', refill: 'refill', cancel: 'cancel', balance: 'profile' },
        // ✅ Verified: auth pakai api_key + secret_key
        authParams: (p) => ({ api_key: p.apiKey(), secret_key: p.secretKey() }),
        // ✅ Verified dari dokumentasi "Membuat Pesanan":
        //    - link/username target dikirim sebagai 'data'
        //    - field komentar utama = 'komen'
        orderParams: { link: 'data', quantity: 'quantity', comments: 'komen' },
        orderIdField: 'id',
        // ── Param & bentuk response khas BuzzerPanel ──
        statusParam: 'id',          // status pakai ?id=<orderId> (SMMSOC pakai 'order')
        supportsMultiStatus: false, // status hanya 1 id per request
        wrapped: true,              // semua response dibungkus { status, data }
        balanceField: 'balance',    // saldo ada di data.balance
        errorPath: 'data.msg',      // pesan error ada di data.msg
    },
};

export const DEFAULT_PROVIDER = 'smmsoc';

// ─────────────────────────────────────────────────────────────
// Helper ID ber-prefix
// ─────────────────────────────────────────────────────────────
export function parseServiceId(raw) {
    const s = String(raw ?? '');
    const i = s.indexOf(':');
    if (i === -1) {
        // Tanpa prefix -> anggap provider default (kompatibilitas data lama SMMSOC).
        return { providerKey: DEFAULT_PROVIDER, rawId: s };
    }
    const providerKey = s.slice(0, i);
    const rawId = s.slice(i + 1);
    if (!PROVIDERS[providerKey]) {
        // Prefix tak dikenal -> jangan tebak, lempar ke caller untuk ditolak.
        return { providerKey: null, rawId: s };
    }
    return { providerKey, rawId };
}

export function makeServiceId(providerKey, rawId) {
    return `${providerKey}:${rawId}`;
}

// ─────────────────────────────────────────────────────────────
// Normalisasi 1 service ke bentuk seragam:
//   { service, name, category, rate, currency, min, max, _provider, _rawId }
// 'service' = ID BER-PREFIX (yang dilihat client). 'rate' = harga per 1000.
// ─────────────────────────────────────────────────────────────
function num(v) {
    if (v == null) return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function normalizeService(p, raw) {
    // Coba beberapa nama field umum. SMMSOC: service/name/category/rate/min/max.
    // BuzzerPanel (⚠️ verifikasi): kemungkinan id/name/category/price/min/max.
    const rawId =
        raw.service ?? raw.id ?? raw.service_id ?? raw.ID ?? null;
    const name = raw.name ?? raw.nama ?? raw.title ?? '';
    const category = raw.category ?? raw.kategori ?? raw.type ?? '';
    const rate = num(
        raw.rate ?? raw.price ?? raw.harga ??
        raw.price_per_1000 ?? raw.rate_per_1000 ?? raw.harga_per_1000 ??
        raw.price_per_k ?? raw.pricePer1000
    );
    const min = raw.min ?? raw.minimal ?? raw.minimum ?? raw.min_order ?? null;
    const max = raw.max ?? raw.maksimal ?? raw.maximum ?? raw.max_order ?? null;
    const refill = raw.refill ?? raw.refill_enabled ?? false;
    const type = raw.type ?? raw.tipe ?? raw.jenis ?? null;

    if (rawId == null) return null;

    // ⚠️ FAIL-LOUD: kalau rate null, mapping field harga kemungkinan meleset.
    // Daripada diam-diam null (order bakal ketolak "harga tidak tersedia"),
    // teriak di log + tunjukin key apa aja yang ADA di response biar gampang
    // benerin nama field-nya. Cek log ini dulu kalau order Buzzer error harga.
    if (rate == null) {
        console.warn(
            `[providers] ${p.key} service ${rawId}: RATE NULL — nama field harga mungkin beda. ` +
            `Key tersedia: ${Object.keys(raw).join(', ')}`
        );
    }
    return {
        service: makeServiceId(p.key, rawId),
        _provider: p.key,
        _rawId: String(rawId),
        name,
        category,
        rate,
        currency: p.currency,
        min,
        max,
        refill,
        type,
    };
}

// ─────────────────────────────────────────────────────────────
// Panggil API satu provider (low-level). Mengembalikan {ok, status, json, text}.
// ─────────────────────────────────────────────────────────────
async function callProvider(p, params) {
    const body = new URLSearchParams({ ...p.authParams(p), ...params });
    const res = await fetch(`${p.endpoint()}${p.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* biarkan null */ }
    return { ok: res.ok, status: res.status, json, text };
}

// ─────────────────────────────────────────────────────────────
// Cache daftar service per-provider (TTL pendek).
// Tujuan: getService() & listAllServices() nggak nge-fetch full list
// berulang tiap order. Catatan: di serverless (Vercel) cache ini per
// instance lambda yang lagi warm — tetap motong mayoritas fetch berulang,
// tapi bukan cache global. TTL pendek supaya harga/service baru cepat kebawa.
// ─────────────────────────────────────────────────────────────
const SVC_CACHE_TTL_MS = parseInt(process.env.SVC_CACHE_TTL_MS || '60000', 10);
const _svcCache = new Map(); // providerKey -> { at, arr }

async function fetchServiceArrayCached(p) {
    const hit = _svcCache.get(p.key);
    if (hit && (Date.now() - hit.at) < SVC_CACHE_TTL_MS) return hit.arr;
    const r = await callProvider(p, { action: p.actions.services });
    const arr = extractServiceArray(r.json);
    if (arr) {
        _svcCache.set(p.key, { at: Date.now(), arr });
    } else {
        console.error(`[providers] ${p.key} services bukan array:`, r.text?.slice(0, 200));
    }
    return arr; // null kalau gagal — caller yang handle
}

// ─────────────────────────────────────────────────────────────
// Ekstrak array service dari response. Sebagian provider (BuzzerPanel)
// membungkus dalam { status, data: [...] }; sebagian (SMMSOC) array langsung.
// Coba root dulu, lalu key pembungkus yang umum.
// ─────────────────────────────────────────────────────────────
function extractServiceArray(json) {
    if (Array.isArray(json)) return json;
    if (json && typeof json === 'object') {
        for (const key of ['data', 'services', 'result', 'results']) {
            if (Array.isArray(json[key])) return json[key];
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────
// API publik modul
// ─────────────────────────────────────────────────────────────

// Cek provider mana yang ter-konfigurasi (punya API key).
export function configuredProviders() {
    return Object.values(PROVIDERS).filter((p) => !!p.apiKey());
}

// Ambil daftar service dari SEMUA provider yang terkonfigurasi, sudah dinormalisasi
// & diberi prefix. Provider yang error di-skip (jangan sampai 1 provider down
// bikin seluruh daftar kosong).
export async function listAllServices() {
    const out = [];
    for (const p of configuredProviders()) {
        try {
            const arr = await fetchServiceArrayCached(p);
            if (arr) {
                for (const raw of arr) {
                    const n = normalizeService(p, raw);
                    if (n) out.push(n);
                }
            }
        } catch (e) {
            console.error(`[providers] ${p.key} services error:`, e.message);
        }
    }
    return out;
}

// Ambil 1 service (untuk hitung harga server-side saat order).
// prefixedId = "buzzer:5678" dst.
export async function getService(prefixedId) {
    const { providerKey, rawId } = parseServiceId(prefixedId);
    if (!providerKey) return null;
    const p = PROVIDERS[providerKey];
    if (!p?.apiKey()) return null;
    const arr = await fetchServiceArrayCached(p);
    if (!arr) return null;
    const match = arr.find((s) => {
        const id = s.service ?? s.id ?? s.service_id ?? s.ID;
        return String(id) === String(rawId);
    });
    return match ? normalizeService(p, match) : null;
}

// Buat order. orderInput = { serviceId (prefixed), link, quantity, comments? }
// Mengembalikan { ok, orderId, raw, error }.
export async function placeOrder({ serviceId, link, quantity, comments }) {
    const { providerKey, rawId } = parseServiceId(serviceId);
    if (!providerKey) return { ok: false, error: 'Provider tidak dikenal.' };
    const p = PROVIDERS[providerKey];
    if (!p?.apiKey()) return { ok: false, error: `Provider ${providerKey} belum dikonfigurasi.` };

    const params = {
        action: p.actions.order,
        service: rawId,
        [p.orderParams.link]: link,
    };
    // Custom comments: jumlah dihitung dari daftar komentar, quantity tak dikirim.
    if (comments) {
        // Nama field komentar beda per provider (SMMSOC: comments, BuzzerPanel: komen).
        const commentField = p.orderParams.comments || 'comments';
        params[commentField] = comments;
    } else {
        params[p.orderParams.quantity] = quantity;
    }

    const r = await callProvider(p, params);

    // Order ID bisa di root (SMMSOC: {order: 123}) atau dalam pembungkus
    // (BuzzerPanel mungkin {status, data: {id: ...}}). Coba beberapa lokasi.
    const j = r.json;
    let orderId = null;
    if (j && typeof j === 'object') {
        const candidates = [
            j[p.orderIdField],          // field utama provider (id / order)
            j.id, j.order, j.order_id,  // nama umum di root
            j.data?.[p.orderIdField],   // dalam pembungkus .data
            j.data?.id, j.data?.order,
        ];
        orderId = candidates.find((v) => v != null && v !== '') ?? null;
    }

    // Sukses kalau ada order id dan tidak ada flag error.
    // Pesan error lokasinya beda per provider (SMMSOC: error, BuzzerPanel: data.msg).
    const providerError = readErrorMessage(p, j);
    if (!r.ok || !j || orderId == null || (providerError && j?.status !== true)) {
        return { ok: false, error: providerError || 'Order gagal di provider.', raw: j, status: r.status };
    }
    return { ok: true, orderId: String(orderId), raw: j };
}

// Baca pesan error dari response sesuai errorPath provider (mis. 'data.msg').
function readErrorMessage(p, json) {
    if (!json || typeof json !== 'object') return null;
    const path = p.errorPath || 'error';
    let v = json;
    for (const key of path.split('.')) {
        v = v?.[key];
        if (v == null) break;
    }
    if (typeof v === 'string') return v;
    // fallback ke nama umum
    return json.error || json.message || (json.status === false ? 'Permintaan ditolak provider.' : null);
}

// Forward action status/refill/cancel ke provider yang benar.
// Menangani perbedaan nama param (order vs id) & response terbungkus per provider.
//   params bisa berisi { order } (single) atau { orders } (multi, hanya provider
//   yang supportsMultiStatus).
export async function forwardAction({ providerKey, action, params }) {
    const p = PROVIDERS[providerKey];
    if (!p?.apiKey()) return { ok: false, error: `Provider ${providerKey} belum dikonfigurasi.` };
    const mapped = p.actions[action] || action;

    // Remap nama parameter order id sesuai provider.
    //   SMMSOC: status pakai 'order' / 'orders'.
    //   BuzzerPanel: status pakai 'id' (single saja).
    const outParams = { ...params };
    const pname = p.statusParam || 'order';
    if (pname !== 'order') {
        if (outParams.order != null) { outParams[pname] = outParams.order; delete outParams.order; }
        // Provider tanpa multistatus: 'orders' tak didukung -> pakai id pertama.
        if (outParams.orders != null) {
            if (!p.supportsMultiStatus) {
                outParams[pname] = String(outParams.orders).split(',')[0].trim();
            } else {
                outParams[pname] = outParams.orders;
            }
            delete outParams.orders;
        }
    }

    const r = await callProvider(p, { action: mapped, ...outParams });
    return { ok: r.ok, status: r.status, json: r.json, text: r.text };
}

// Ambil saldo provider. Mengembalikan { ok, balance, currency, raw, error }.
export async function getBalance(providerKey = 'smmsoc') {
    const p = PROVIDERS[providerKey];
    if (!p?.apiKey()) return { ok: false, error: `Provider ${providerKey} belum dikonfigurasi.` };
    const r = await callProvider(p, { action: p.actions.balance });
    const j = r.json;
    if (!j) return { ok: false, error: 'Respons saldo tidak valid.', status: r.status };

    // Lokasi saldo: SMMSOC -> j.balance; BuzzerPanel -> j.data.balance.
    const bf = p.balanceField || 'balance';
    const balance = p.wrapped ? j.data?.[bf] : j[bf];
    if (balance == null) {
        const err = readErrorMessage(p, j);
        return { ok: false, error: err || 'Saldo tidak ditemukan di respons.', raw: j, status: r.status };
    }
    return { ok: true, balance, currency: p.currency, raw: j };
}

// Normalisasi response status order ke bentuk seragam yang dipakai UI:
//   { status, charge, start_count, remains, error }
// SMMSOC sudah datar; BuzzerPanel dibungkus .data dengan nama field beda.
export function normalizeStatusResponse(providerKey, raw) {
    const p = PROVIDERS[providerKey];
    if (!raw || typeof raw !== 'object') return raw;
    const d = p?.wrapped ? (raw.data || {}) : raw;
    if (p?.wrapped && raw.status === false) {
        return { error: readErrorMessage(p, raw) || 'Pesanan tidak ditemukan.' };
    }
    return {
        status: d.status ?? raw.status,
        charge: d.charge ?? raw.charge ?? null,
        start_count: d.start_count ?? raw.start_count ?? null,
        remains: d.remains ?? raw.remains ?? null,
        error: d.msg || raw.error || null,
    };
}

/* ─────────────────────────────────────────────────────────────
   CARA TES field mapping BuzzerPanel (jalankan sekali di lokal):

     BUZZER_API_KEY=xxx BUZZER_SECRET_KEY=yyy node -e '
       fetch("https://buzzerpanel.id/api/json.php",{method:"POST",
         headers:{"Content-Type":"application/x-www-form-urlencoded"},
         body:new URLSearchParams({api_key:process.env.BUZZER_API_KEY,
           secret_key:process.env.BUZZER_SECRET_KEY,action:"services"})})
       .then(r=>r.json()).then(d=>console.log(JSON.stringify(d[0],null,2)))'

   Lihat key object pertama. Sesuaikan:
     - normalizeService() kalau nama field beda (mis. price_idr).
     - orderParams.link kalau ternyata "link" bukan "target".
     - orderIdField kalau response order pakai "order" bukan "id".
   ───────────────────────────────────────────────────────────── */