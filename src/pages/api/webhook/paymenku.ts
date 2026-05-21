// API Route: /api/webhook/paymenku
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const WEBHOOK_SECRET = process.env.PAYMENKU_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
        console.error('[Webhook] PAYMENKU_WEBHOOK_SECRET not set!');
        return res.status(500).json({ error: 'Webhook not configured.' });
    }

    const signature = req.headers['x-paymenku-signature'];
    const timestamp = req.headers['x-paymenku-timestamp'];

    // ✅ Selalu verifikasi HMAC - tidak boleh skip
    if (!signature || !timestamp) {
        return res.status(401).json({ error: 'Missing signature headers.' });
    }

    const rawBody = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', WEBHOOK_SECRET)
        .update(timestamp + '.' + rawBody).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature as string))) {
        console.error('[Webhook] Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = req.body;

    if (payload.event === 'payment.status_updated' && payload.status === 'paid') {
        const { trx_id, reference_id, amount_received } = payload;
        const amount = parseFloat(amount_received || payload.amount || 0);

        // ✅ Validasi amount
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Cek duplikat
        const { data: existing } = await supabaseAdmin
            .from('transactions')
            .select('id')
            .or(`description.ilike.%${reference_id}%,description.ilike.%${trx_id}%`)
            .in('status', ['success', 'pending_webhook'])
            .maybeSingle();

        if (!existing) {
            // ✅ Parse email dari reference_id (format: email_timestamp)
            let email = '';
            if (reference_id && reference_id.includes('_')) {
                const parts = reference_id.split('_');
                if (parts[0] && parts[0].includes('@')) {
                    email = parts[0];
                }
            }

            await supabaseAdmin.from('transactions').insert({
                email,
                type: 'deposit',
                amount: Math.round(amount),
                description: `Top up QRIS - Ref: ${reference_id} - TrxID: ${trx_id}`,
                status: email ? 'success' : 'pending_webhook',
            });

            console.log(`[Webhook] Payment saved: ${trx_id} - Rp ${amount} - email: ${email || 'unknown'}`);
        }
    }

    return res.status(200).json({ received: true });
}

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };