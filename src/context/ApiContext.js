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
const ALLOWED_PARAMS = new Set(['action', 'service', 'link', 'quantity', 'order', 'orders', 'comments']);

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

  const query = new URLSearchParams(safeParams);
  const res = await fetch(`/api/smm?${query.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

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
    getStatus: (order) => smmRequest({ action: 'status', order }),
    getMultiStatus: (orders) => smmRequest({ action: 'status', orders: orders.join(',') }),
  };
}