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

            // ✅ reference_id dibuat DI SERVER dari email session (jangan percaya client).
            // Format: <email>_<timestamp> — dipakai webhook untuk mencocokkan & verifikasi email.
            // Kalau client kirim reference_id, diabaikan demi keamanan & konsistensi.
            const serverRefId = `${user.email}_${Date.now()}`;

            // ✅ Paksa email dari session, bukan dari client
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
                    || (req.headers.origin)
                    || (req.headers.host ? `https://${req.headers.host}` : 'https://suntiksosmed.store');
                const reqBody = {
                    reference_id: serverRefId,
                    amount,
                    customer_name: user.user_metadata?.full_name || user.email,
                    customer_email: user.email,
                    channel_code: 'qris',
                    return_url: `${baseUrl}/dashboard`,
                };

                const resp = await fetch(`${PAYMENKU_BASE}/transaction/create`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${PAYMENKU_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(reqBody),
                });
                const rawText = await resp.text();

                try {
                    const data = JSON.parse(rawText);
                    // Sertakan reference_id server agar client bisa simpan ke baris qris_pending (sinkron dgn webhook)
                    if (data && typeof data === 'object' && !data.reference_id) data.reference_id = serverRefId;
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

        // Sanitasi order_id — hanya boleh alphanumeric dan strip/dash
        const sanitizedOrderId = String(order_id || '').replace(/[^a-zA-Z0-9_-]/g, '');
        if (action === 'check_status' && sanitizedOrderId) {
            // ✅ Cek dari Supabase dulu (bukan filesystem)
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            const { data: txRows } = await supabase
                .from('transactions')
                .select('*')
                .ilike('description', `%${sanitizedOrderId}%`)
                .eq('email', user.email)
                .order('created_at', { ascending: false })
                .limit(1);
            const tx = (txRows || [])[0];

            if (tx?.status === 'success') {
                return res.status(200).json({ status: 'success', data: tx });
            }

            // Fallback: tanya langsung ke Paymenku
            try {
                const resp = await fetch(`${PAYMENKU_BASE}/check-status/${sanitizedOrderId}`, {
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