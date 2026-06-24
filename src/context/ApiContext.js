import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const ApiCtx = createContext({ apiUrl: '', setConfig: () => { } });
export const useApi = () => useContext(ApiCtx);

export function ApiProvider({ children }) {
  const [apiUrl, setApiUrl] = useState('');

  // ✅ Fix bug: useState -> useEffect agar benar-benar jalan sebagai side effect
  // ✅ Fix: hapus NEXT_PUBLIC_SMM_API_URL — sudah di-rename ke SMM_API_URL (server-only)
  //         apiUrl cukup diambil dari Supabase settings saja
  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'smm_api_url').maybeSingle()
      .then(({ data }) => { if (data?.value) setApiUrl(data.value); });
  }, []);

  const setConfig = (url) => { setApiUrl(url); };

  // ✅ Fix: hapus apiKey dari context — API key sudah server-side di /api/smm,
  //         tidak perlu diekspos ke client dalam bentuk apapun
  return (
    <ApiCtx.Provider value={{ apiUrl, setConfig }}>
      {children}
    </ApiCtx.Provider>
  );
}

// ── Whitelist params yang diizinkan ke /api/smm ────────────────────────────
const ALLOWED_PARAMS = new Set(['action', 'service', 'link', 'quantity', 'order', 'orders', 'comments', 'provider']);

/* ── SMM API HELPER — lewat proxy /api/smm dengan auth token ── */
export async function smmRequest(params) {
  // ✅ Fix: whitelist params — tolak key yang tidak dikenal agar tidak bisa
  //         inject parameter arbitrary (misal: menimpa 'key' di server)
  const safeParams = Object.fromEntries(
    Object.entries(params).filter(([k]) => ALLOWED_PARAMS.has(k))
  );

  // Ambil session token dari Supabase — retry kalau belum ready (production delay)
  let { data: { session } } = await supabase.auth.getSession();
  let token = session?.access_token;

  if (!token) {
    // Tunggu sebentar lalu coba lagi (session mungkin belum restore)
    await new Promise(r => setTimeout(r, 800));
    const { data: { session: s2 } } = await supabase.auth.getSession();
    token = s2?.access_token;
  }

  if (!token) throw new Error('Silakan login terlebih dahulu.');

  // ✅ Order dengan custom comments dikirim via POST (body JSON) — comments bisa
  //    ratusan baris, kalau lewat query string URL-nya kepanjangan & bisa kena
  //    limit Nginx/browser (~8KB) -> request gagal. `action` tetap di query
  //    karena handler membaca req.query.action sebelum tahu method.
  //    Sisanya (services/status/balance) tetap GET seperti semula.
  const usePost = safeParams.action === 'add' && safeParams.comments != null;

  let res;
  if (usePost) {
    const { action, ...bodyParams } = safeParams;
    res = await fetch(`/api/smm?action=${encodeURIComponent(action)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyParams),
    });
  } else {
    const query = new URLSearchParams(safeParams);
    // ✅ FIX: Selalu pakai '/api/smm' dengan leading slash — tidak pakai apiUrl sebagai base.
    // Penggunaan apiUrl sebagai base URL (misal `${apiUrl}api/smm?...`) berbahaya:
    // jika apiUrl kosong (belum load dari Supabase), hasilnya 'api/smm?...' tanpa slash
    // → browser parse 'api' sebagai hostname → ERR_NAME_NOT_RESOLVED.
    res = await fetch(`/api/smm?${query.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  if (res.status === 401) throw new Error('Sesi habis. Silakan login ulang.');

  // ✅ Fix: jangan bocorkan raw response text ke UI — log saja ke console.
  //         Tapi error TERSTRUKTUR dari API kita sendiri ({ error: "..." }) aman
  //         dan memang ditujukan ke user (mis. 402 "Saldo tidak cukup"), jadi diteruskan.
  const text = await res.text();
  if (!res.ok) {
    console.error(`[suntiksosmedRequest] HTTP ${res.status}:`, text);
    let serverMsg = null;
    try {
      const err = JSON.parse(text);
      if (err?.error) serverMsg = String(err.error);
    } catch { /* body bukan JSON -> pakai pesan generik */ }
    throw new Error(serverMsg || `Permintaan gagal (${res.status}). Coba lagi.`);
  }

  // ✅ Fix: pisahkan parsing dari handling error.
  //         Sebelumnya `throw new Error(data.error)` ada di dalam try yang sama,
  //         jadi ke-catch dan diganti pesan generik — error spesifik dari server
  //         (mis. "saldo tidak cukup") gak pernah sampai ke user.
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Hanya response yang bukan JSON valid yang jadi pesan generik
    console.error('[suntiksosmedRequest] Response tidak valid:', text);
    throw new Error('Response dari server tidak valid.');
  }
  // Error spesifik dari server diteruskan apa adanya ke UI
  if (data.error) throw new Error(data.error);
  return data;
}

export function useSmmApi() {
  return {
    getServices: () => smmRequest({ action: 'services' }),
    getBalance: () => smmRequest({ action: 'balance' }),
    addOrder: (service, link, quantity, opts = {}) =>
      smmRequest({ action: 'add', service, link, quantity, ...(opts.comments ? { comments: opts.comments } : {}) }),

    // Status / refill / cancel satu order. `provider` opsional: kalau pemanggil
    // sudah tahu provider order ini (dari row transactions.provider), kirim biar
    // server tak perlu lookup DB. Kalau tidak, server resolve sendiri dari order_id.
    getStatus: (order, provider) =>
      smmRequest({ action: 'status', order, ...(provider ? { provider } : {}) }),
    refillOrder: (order, provider) =>
      smmRequest({ action: 'refill', order, ...(provider ? { provider } : {}) }),
    cancelOrder: (order, provider) =>
      smmRequest({ action: 'cancel', order, ...(provider ? { provider } : {}) }),

    // Multi-status, provider-aware.
    //   Terima:
    //     - array string  -> ["1","2"]            (cara lama; diasumsikan smmsoc)
    //     - array objek    -> [{order, provider}]  (multi-provider, disarankan)
    //   Order dikelompokkan per provider, satu request multistatus per provider,
    //   lalu hasilnya digabung jadi { [orderId]: statusObj }.
    getMultiStatus: async (items) => {
      if (!Array.isArray(items) || items.length === 0) return {};

      // Normalisasi ke { order, provider }.
      const norm = items.map((it) =>
        typeof it === 'object' && it !== null
          ? { order: String(it.order), provider: it.provider || 'smmsoc' }
          : { order: String(it), provider: 'smmsoc' }
      );

      // Kelompokkan per provider.
      const byProvider = norm.reduce((acc, { order, provider }) => {
        (acc[provider] ||= []).push(order);
        return acc;
      }, {});

      // Satu request per provider (paralel), lalu merge.
      const merged = {};
      await Promise.all(
        Object.entries(byProvider).map(async ([provider, orders]) => {
          try {
            const data = await smmRequest({ action: 'status', orders: orders.join(','), provider });
            // Provider Perfect Panel mengembalikan objek { orderId: {...} } untuk multistatus.
            if (data && typeof data === 'object') Object.assign(merged, data);
          } catch (e) {
            // Satu provider gagal tak boleh menggagalkan semua. Tandai error per order.
            for (const o of orders) merged[o] = { error: e.message };
          }
        })
      );
      return merged;
    },
  };
}