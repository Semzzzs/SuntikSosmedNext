// API Route: /api/payment
import { createClient } from '@supabase/supabase-js';

const PAYMENKU_BASE = 'https://paymenku.com/api/v1';
const MIN_AMOUNT = 10000;   // Rp 10.000 minimum deposit
const MAX_AMOUNT = 10000000; // Rp 10.000.000 maximum deposit

async function getAuthUser(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    return user || null;
}

export default async function handler(req, res) {
    const PAYMENKU_API_KEY = process.env.PAYMENKU_API_KEY;
    if (!PAYMENKU_API_KEY) return res.status(500).json({ error: 'Payment gateway belum dikonfigurasi.' });

    // ✅ Wajib login untuk semua endpoint payment
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized. Silakan login terlebih dahulu.' });

    if (req.method === 'POST') {
        const { action, ...body } = req.body;

        if (action === 'create_qris') {
            // ✅ Validasi amount
            const amount = parseInt(body.amount);
            if (!amount || isNaN(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
                return res.status(400).json({
                    error: `Jumlah deposit tidak valid. Min: Rp ${MIN_AMOUNT.toLocaleString('id-ID')}, Max: Rp ${MAX_AMOUNT.toLocaleString('id-ID')}`
                });
            }

            // ✅ Paksa email dari session, bukan dari client
            try {
                const reqBody = {
                    reference_id: body.reference_id,
                    amount,
                    customer_name: user.user_metadata?.full_name || user.email,
                    customer_email: user.email,
                    channel_code: 'qris',
                    return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard`,
                };
                console.log('[Paymenku] Request URL:', `${PAYMENKU_BASE}/transaction/create`);
                console.log('[Paymenku] Request body:', JSON.stringify(reqBody));
                const resp = await fetch(`${PAYMENKU_BASE}/transaction/create`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${PAYMENKU_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(reqBody),
                });
                const rawText = await resp.text();
                console.log('[Paymenku] Response status:', resp.status);
                console.log('[Paymenku] Response body:', rawText);
                try {
                    const data = JSON.parse(rawText);
                    return res.status(resp.ok ? 200 : 400).json(data);
                } catch {
                    return res.status(500).json({ error: 'Response Paymenku bukan JSON', raw: rawText.slice(0, 200) });
                }
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    if (req.method === 'GET') {
        const { action, order_id } = req.query;

        if (action === 'check_status' && order_id) {
            // ✅ Cek dari Supabase dulu (bukan filesystem)
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            const { data: tx } = await supabase
                .from('transactions')
                .select('*')
                .ilike('description', `%${order_id}%`)
                .eq('email', user.email)
                .maybeSingle();

            if (tx?.status === 'success') {
                return res.status(200).json({ status: 'success', data: tx });
            }

            // Fallback: tanya langsung ke Paymenku
            try {
                const resp = await fetch(`${PAYMENKU_BASE}/check-status/${order_id}`, {
                    headers: { 'Authorization': `Bearer ${PAYMENKU_API_KEY}` },
                });
                const data = await resp.json();
                return res.status(resp.ok ? 200 : 400).json(data);
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}