import { createContext, useContext, useState } from 'react';
import { supabase } from '@/lib/supabase';

const ApiCtx = createContext({ apiUrl: '', setConfig: () => { } });
export const useApi = () => useContext(ApiCtx);

export function ApiProvider({ children }) {
  const [apiUrl, setApiUrl] = useState(process.env.NEXT_PUBLIC_SMM_API_URL || '');
  const setConfig = (url) => { setApiUrl(url); };

  // Auto-load apiUrl dari Supabase settings saat pertama kali mount
  useState(() => {
    supabase.from('settings').select('value').eq('key', 'smm_api_url').maybeSingle()
      .then(({ data }) => { if (data?.value) setApiUrl(data.value); });
  });

  return (
    <ApiCtx.Provider value={{ apiUrl, apiKey: true, setConfig }}>
      {children}
    </ApiCtx.Provider>
  );
}

/* ── SMM API HELPER — lewat proxy /api/smm dengan auth token ── */
export async function smmRequest(params) {
  // Ambil session token dari Supabase
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) throw new Error('Silakan login terlebih dahulu.');

  const query = new URLSearchParams({ ...params });
  const res = await fetch(`/api/smm?${query.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const text = await res.text();
  if (res.status === 401) throw new Error('Sesi habis. Silakan login ulang.');
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  try {
    const data = JSON.parse(text);
    if (data.error) throw new Error(data.error);
    return data;
  } catch {
    throw new Error(`Response tidak valid: ${text}`);
  }
}

export function useSmmApi() {
  return {
    getServices: () => smmRequest({ action: 'services' }),
    getBalance: () => smmRequest({ action: 'balance' }),
    addOrder: (service, link, quantity) => smmRequest({ action: 'add', service, link, quantity }),
    getStatus: (order) => smmRequest({ action: 'status', order }),
    getMultiStatus: (orders) => smmRequest({ action: 'status', orders: orders.join(',') }),
  };
}