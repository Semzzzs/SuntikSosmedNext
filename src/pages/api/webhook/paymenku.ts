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

    // ✅ Validasi timestamp — tolak request lebih dari 5 menit (cegah replay attack)
    const tsMs = parseInt(timestamp as string) * 1000;
    if (isNaN(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
        return res.status(401).json({ error: 'Request expired or invalid timestamp.' });
    }

    const rawBody = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', WEBHOOK_SECRET)
        .update(timestamp + '.' + rawBody).digest('hex');

    const sigBuf = Buffer.from(signature as string, 'hex');
    const expBuf = Buffer.from(expected, 'hex');

    // ✅ Cek panjang dulu — timingSafeEqual throw Error kalau beda panjang
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(expBuf, sigBuf)) {
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

        // ── Anti-duplikat: kalau sudah pernah jadi 'deposit success' untuk trx ini, stop ──
        const { data: alreadyDone } = await supabaseAdmin
            .from('transactions')
            .select('id')
            .eq('type', 'deposit')
            .eq('status', 'success')
            .or(`description.ilike.%${trx_id}%,description.ilike.%${reference_id}%`)
            .maybeSingle();

        if (alreadyDone) {
            return res.status(200).json({ received: true, note: 'already processed' });
        }

        // ── STRATEGI UTAMA: cari baris 'qris_pending' yang dibuat saat user bikin QRIS ──
        // Baris itu SUDAH punya email + (idealnya) user_id yang benar dari session user.
        // Cocokkan via trx_id (disimpan di qr_trx_id atau di description "QRIS_PENDING_<trx_id>").
        const { data: pendingRow } = await supabaseAdmin
            .from('transactions')
            .select('id, email, user_id, amount, qr_amount')
            .or(`qr_trx_id.eq.${trx_id},description.eq.QRIS_PENDING_${trx_id}`)
            .maybeSingle();

        if (pendingRow && pendingRow.email) {
            // ✅ Kreditkan saldo pakai NOMINAL DEPOSIT yang user minta (tersimpan di baris pending),
            // BUKAN amount_received dari Paymenku. amount_received = net setelah potongan fee,
            // yang bisa keliru kalau mode fee berubah. Nominal deposit user adalah sumber kebenaran.
            const creditAmount = Math.round(
                Number(pendingRow.qr_amount) || Number(pendingRow.amount) || amount
            );
            // ✅ Email sudah benar dari awal — tinggal jadikan deposit success.
            const { error: updErr } = await supabaseAdmin
                .from('transactions')
                .update({
                    type: 'deposit',
                    status: 'success',
                    amount: creditAmount,
                    description: `Top up QRIS - Ref: ${reference_id} - TrxID: ${trx_id}`,
                })
                .eq('id', pendingRow.id);
            if (updErr) {
                console.error('[Webhook] update pending row error:', updErr.message);
                return res.status(500).json({ error: 'DB update failed' });
            }
            console.log(`[Webhook] Deposit OK (via pending row): ${trx_id} - Rp ${creditAmount} - ${pendingRow.email}`);
            return res.status(200).json({ received: true });
        }

        // ── FALLBACK: baris pending tidak ketemu. Resolve email dari reference_id. ──
        // (mis. baris pending kehapus, atau dibuat di device lain tanpa simpan ke DB)
        let email = '';
        if (reference_id && typeof reference_id === 'string') {
            // reference_id = "<email>_<timestamp>"; timestamp = angka di paling akhir
            const m = reference_id.match(/^(.+?)_\d+$/);
            const cand = (m ? m[1] : reference_id.split('_')[0] || '').toLowerCase().trim();
            if (cand.includes('@') && cand.includes('.')) email = cand;
        }

        // Verifikasi ke auth.users (sumber kebenaran), fallback ke profiles
        let verifiedEmail = '';
        let verifiedUserId: string | null = null;
        if (email) {
            try {
                const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
                const u = list?.users?.find((x: any) => (x.email || '').toLowerCase() === email);
                if (u) { verifiedEmail = u.email!.toLowerCase(); verifiedUserId = u.id; }
            } catch (e: any) {
                console.error('[Webhook] auth.users lookup error:', e?.message);
            }
            if (!verifiedEmail) {
                const { data: profile } = await supabaseAdmin
                    .from('profiles').select('id, email').eq('email', email).maybeSingle();
                if (profile?.email) { verifiedEmail = profile.email.toLowerCase(); verifiedUserId = profile.id || null; }
            }
        }

        // JANGAN buang email — simpan apa adanya. Kalau tak terverifikasi -> pending_webhook (review manual)
        const status = verifiedEmail ? 'success' : 'pending_webhook';
        const emailToSave = verifiedEmail || email || '';

        const { error: insErr } = await supabaseAdmin.from('transactions').insert({
            user_id: verifiedUserId,
            email: emailToSave,
            type: 'deposit',
            amount: Math.round(amount),
            description: `Top up QRIS - Ref: ${reference_id} - TrxID: ${trx_id}`,
            status,
        });
        if (insErr) console.error('[Webhook] insert error:', insErr.message);
        console.log(`[Webhook] Deposit (via fallback): ${trx_id} - Rp ${amount} - email: ${emailToSave || 'unknown'} - status: ${status}`);
    }

    return res.status(200).json({ received: true });
}

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };