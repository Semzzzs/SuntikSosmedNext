/**
 * Fetch real-time USD to IDR exchange rate
 * Tries multiple free sources for best accuracy
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // Cache 10 menit di edge
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');

    // ✅ Override manual dari admin (settings.rate_override) — menang atas sumber live
    try {
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const { data } = await supabase.from('settings').select('value').eq('key', 'rate_override').maybeSingle();
            const val = data?.value ? parseInt(data.value, 10) : 0;
            if (val && val >= 1000) {
                return res.status(200).json({ rate: val, updated: new Date().toISOString(), source: 'manual-override' });
            }
        }
    } catch { /* lanjut ke sumber live */ }

    const sources = [
        // Source 1: Fawaz Ahmed currency API - update tiap jam
        async () => {
            const r = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', { next: { revalidate: 600 } });
            const d = await r.json();
            if (d?.usd?.idr) return { rate: d.usd.idr, source: 'fawazahmed0/currency-api' };
            throw new Error('No IDR rate');
        },
        // Source 2: ExchangeRate API fallback
        async () => {
            const r = await fetch('https://open.er-api.com/v6/latest/USD');
            const d = await r.json();
            if (d.result === 'success' && d.rates?.IDR) return { rate: d.rates.IDR, source: 'open.er-api.com' };
            throw new Error('No IDR rate');
        },
        // Source 3: Frankfurter (ECB data)
        async () => {
            const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=IDR');
            const d = await r.json();
            if (d.rates?.IDR) return { rate: d.rates.IDR, source: 'frankfurter.app' };
            throw new Error('No IDR rate');
        },
    ];

    for (const source of sources) {
        try {
            const result = await source();
            return res.status(200).json({
                rate: Math.round(result.rate),
                updated: new Date().toISOString(),
                source: result.source,
            });
        } catch (e) {
            continue;
        }
    }

    // Fallback hardcoded
    return res.status(200).json({ rate: 17689, updated: null, source: 'fallback' });
}