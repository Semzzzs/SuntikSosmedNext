// pages/api/orders/mine.js
import { createClient } from '@supabase/supabase-js';
import { forwardAction, normalizeStatusResponse, PROVIDERS } from '../providers';

function normalizeStatus(raw) {
    if (!raw) return 'Pending';
    const s = String(raw).trim().toLowerCase();
    switch (s) {
        case 'completed': return 'Completed';
        case 'in progress':
        case 'inprogress': return 'In progress';
        case 'processing': return 'Processing';
        case 'pending': return 'Pending';
        case 'partial': return 'Partial';
        case 'canceled':
        case 'cancelled': return 'Canceled';
        case 'refunded': return 'Refunded';
        default: return raw;
    }
}
const FINAL = new Set(['Completed', 'Canceled', 'Refunded']);

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized. Silakan login terlebih dahulu.' });
    }
    const token = authHeader.split(' ')[1];
    const supabaseAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user?.email) return res.status(401).json({ error: 'Sesi tidak valid. Silakan login ulang.' });

    const supaSvc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: txRaw, error: txErr } = await supaSvc
        .from('transactions')
        .select('id, order_id, status, description, link, qty, created_at, amount, provider') // TANPA charge / charge_idr
        .eq('email', user.email)
        .eq('type', 'order')
        .order('created_at', { ascending: false });

    if (txErr) return res.status(500).json({ error: txErr.message });

    const txData = (txRaw || []).filter(t =>
        (t.order_id != null && String(t.order_id).trim() !== '') ||
        (t.description && t.description.startsWith('Order #'))
    );

    // ── Live status cuma buat order yang belum final, dikelompokkan per provider.
    //    Grouping ini dulunya dikerjakan CLIENT (butuh tau nama provider tiap order) —
    //    sekarang dikerjakan di sini, jadi browser gak pernah lihat field `provider`.
    const pending = txData.filter(t =>
        t.order_id != null && String(t.order_id).trim() !== '' &&
        !FINAL.has(normalizeStatus(t.status))
    );
    const byProvider = pending.reduce((acc, t) => {
        const pk = t.provider || 'smmsoc';
        (acc[pk] ||= []).push(String(t.order_id));
        return acc;
    }, {});

    const liveStatus = {};
    await Promise.all(Object.entries(byProvider).map(async ([pk, idsAll]) => {
        const ids = idsAll.slice(0, 100);
        const provDef = PROVIDERS[pk];
        try {
            if (provDef?.supportsMultiStatus) {
                const r = await forwardAction({ providerKey: pk, action: 'status', params: { orders: ids.join(',') } });
                if (r.json) {
                    for (const [oid, info] of Object.entries(r.json)) {
                        liveStatus[`${pk}:${oid}`] = normalizeStatusResponse(pk, info);
                    }
                }
            } else {
                await Promise.all(ids.map(async (oid) => {
                    try {
                        const r = await forwardAction({ providerKey: pk, action: 'status', params: { order: oid } });
                        if (r.json) liveStatus[`${pk}:${oid}`] = normalizeStatusResponse(pk, r.json);
                    } catch { }
                }));
            }
        } catch { /* provider ini gagal -> fallback ke status tersimpan */ }
    }));

    // ── Response ke client: TANPA provider, charge, charge_idr, service_id ──
    const orders = txData.map(t => {
        const pk = t.provider || 'smmsoc';
        const live = (t.order_id && liveStatus[`${pk}:${t.order_id}`]) ? liveStatus[`${pk}:${t.order_id}`] : null;
        const effStatus = live?.status ? normalizeStatus(live.status) : normalizeStatus(t.status);
        return {
            id: t.order_id || t.id,
            status: effStatus,
            startCount: live?.start_count ?? null,
            remains: live?.remains ?? null,
            error: live?.error,
            serviceName: t.description?.replace(/^Order #\d+ - /, '') || '—',
            link: t.link || '—',
            qty: t.qty || '—',
            createdAt: t.created_at,
            amountIDR: t.amount,
        };
    });

    return res.status(200).json(orders);
}