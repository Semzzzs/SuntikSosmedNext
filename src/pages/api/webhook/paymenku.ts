// API Route: /api/webhook/paymenku
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Bonus deposit: dihitung DI SERVER (sumber kebenaran), bukan dari client ──
// Tier diambil dari settings 'deposit_bonus_tiers'. Kalau belum diset, bonus = 0
// (aman: lebih baik tidak kasih bonus daripada salah kasih).
async function getBonusAmount(baseAmount: number): Promise<{ bonus: number; percent: number }> {
    try {
        const { data } = await supabaseAdmin
            .from('settings').select('value').eq('key', 'deposit_bonus_tiers').maybeSingle();
        if (!data?.value) return { bonus: 0, percent: 0 };
        const tiers = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        if (!Array.isArray(tiers) || tiers.length === 0) return { bonus: 0, percent: 0 };
        // ambil persen dari tier tertinggi yang min-nya <= baseAmount
        const sorted = tiers
            .filter((t: any) => t && Number.isFinite(Number(t.min)) && Number.isFinite(Number(t.percent)))
            .sort((a: any, b: any) => Number(a.min) - Number(b.min));
        let percent = 0;
        for (const t of sorted) {
            if (baseAmount >= Number(t.min)) percent = Number(t.percent);
        }
        const bonus = Math.round(baseAmount * percent / 100);
        return { bonus, percent };
    } catch {
        return { bonus: 0, percent: 0 };
    }
}

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
        // 📌 Pemetaan field Paymenku (mode customer menanggung fee):
        //    - payload.amount         = GROSS (nominal deposit + fee yang dibayar customer)
        //    - payload.total_fee      = fee
        //    - payload.amount_received = NET diterima merchant = NOMINAL DEPOSIT ASLI user.
        //    Jadi yang dikreditkan = amount_received (net), BUKAN gross.
        //    CATATAN: sumber kebenaran terbaik tetap qr_amount dari baris qris_pending
        //    (nominal yang user pilih saat bikin QRIS) — dipakai lebih dulu di bawah.
        const netAmount = parseFloat(amount_received || 0);
        const amount = netAmount || parseFloat(payload.amount || 0) || 0;

        // ✅ Validasi amount
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // ── Anti-duplikat: kalau sudah pernah jadi 'deposit success' untuk trx ini, stop ──
        // Pakai limit(1) (bukan maybeSingle) supaya tidak throw kalau kebetulan ada >1 baris match.
        const { data: dupRows } = await supabaseAdmin
            .from('transactions')
            .select('id')
            .eq('type', 'deposit')
            .eq('status', 'success')
            .or(`description.ilike.%${trx_id}%,description.ilike.%${reference_id}%`)
            .limit(1);
        const alreadyDone = (dupRows || [])[0];

        if (alreadyDone) {
            return res.status(200).json({ received: true, note: 'already processed' });
        }

        // ── STRATEGI UTAMA: cari baris 'qris_pending' yang dibuat saat user bikin QRIS ──
        // Baris itu SUDAH punya email + (idealnya) user_id yang benar dari session user.
        // Cocokkan via trx_id (disimpan di qr_trx_id atau di description "QRIS_PENDING_<trx_id>").
        const { data: pendingRows } = await supabaseAdmin
            .from('transactions')
            .select('id, email, user_id, amount, qr_amount')
            .or(`qr_trx_id.eq.${trx_id},description.ilike.%QRIS_PENDING_${trx_id}%,description.ilike.%${reference_id}%`)
            .eq('status', 'qris_pending')
            .order('created_at', { ascending: false })
            .limit(1);
        const pendingRow = (pendingRows || [])[0];

        if (pendingRow && pendingRow.email) {
            // ✅ Kreditkan saldo pakai NOMINAL DEPOSIT yang user minta (tersimpan di baris pending),
            // BUKAN amount_received dari Paymenku. amount_received = net setelah potongan fee,
            // yang bisa keliru kalau mode fee berubah. Nominal deposit user adalah sumber kebenaran.
            const baseAmount = Math.round(
                Number(pendingRow.qr_amount) || Number(pendingRow.amount) || amount
            );
            // ✅ Hitung bonus di server dari nominal deposit asli (anti-curang).
            const { bonus, percent } = await getBonusAmount(baseAmount);
            const creditAmount = baseAmount + bonus;
            const bonusNote = bonus > 0 ? ` (+bonus ${percent}%: Rp ${bonus})` : '';
            // ✅ Email sudah benar dari awal — tinggal jadikan deposit success.
            const { error: updErr } = await supabaseAdmin
                .from('transactions')
                .update({
                    type: 'deposit',
                    status: 'success',
                    amount: creditAmount,
                    description: `Top up QRIS - Ref: ${reference_id} - TrxID: ${trx_id}${bonusNote}`,
                })
                .eq('id', pendingRow.id);
            if (updErr) {
                console.error('[Webhook] update pending row error:', updErr.message);
                return res.status(500).json({ error: 'DB update failed' });
            }
            console.log(`[Webhook] Deposit OK (via pending row): ${trx_id} - Rp ${baseAmount}${bonusNote} = Rp ${creditAmount} - ${pendingRow.email}`);
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

        // Verifikasi email: utamakan query profiles (indexed, scalable),
        // fallback ke auth.users hanya kalau profiles tidak menemukan.
        let verifiedEmail = '';
        let verifiedUserId: string | null = null;
        if (email) {
            const { data: profile } = await supabaseAdmin
                .from('profiles').select('id, email').eq('email', email).maybeSingle();
            if (profile?.email) {
                verifiedEmail = profile.email.toLowerCase();
                verifiedUserId = profile.id || null;
            } else {
                // Fallback: cek auth.users (untuk akun yang belum punya baris profiles)
                try {
                    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
                    const u = list?.users?.find((x: any) => (x.email || '').toLowerCase() === email);
                    if (u) { verifiedEmail = u.email!.toLowerCase(); verifiedUserId = u.id; }
                } catch (e: any) {
                    console.error('[Webhook] auth.users lookup error:', e?.message);
                }
            }
        }

        // JANGAN buang email — simpan apa adanya. Kalau tak terverifikasi -> pending_webhook (review manual)
        const emailToSave = verifiedEmail || email || '';

        // ✅ Bonus hanya diberikan kalau deposit terverifikasi (status success).
        // Kalau pending_webhook (butuh review manual admin), jangan tambah bonus dulu.
        //
        // 📌 NOMINAL DEPOSIT = amount_received (net). Di mode "customer menanggung fee",
        //    net inilah nominal yang user pilih. (gross = net + fee.) Fallback ini hanya
        //    terpakai kalau baris qris_pending tak ketemu; idealnya jarang terjadi karena
        //    server kini selalu menyimpan qris_pending saat QRIS dibuat.
        const baseAmt = Math.round(amount);
        const status = verifiedEmail ? 'success' : 'pending_webhook';

        const { bonus: fbBonus, percent: fbPercent } =
            status === 'success' ? await getBonusAmount(baseAmt) : { bonus: 0, percent: 0 };
        const fbCredit = baseAmt + fbBonus;
        const fbBonusNote = fbBonus > 0 ? ` (+bonus ${fbPercent}%: Rp ${fbBonus})` : '';

        const { error: insErr } = await supabaseAdmin.from('transactions').insert({
            user_id: verifiedUserId,
            email: emailToSave,
            type: 'deposit',
            amount: fbCredit,
            description: `Top up QRIS - Ref: ${reference_id} - TrxID: ${trx_id}${fbBonusNote}`,
            status,
        });
        if (insErr) console.error('[Webhook] insert error:', insErr.message);
        console.log(`[Webhook] Deposit (via fallback): ${trx_id} - Rp ${baseAmt}${fbBonusNote} = Rp ${fbCredit} - email: ${emailToSave || 'unknown'} - status: ${status}`);
    }

    return res.status(200).json({ received: true });
}

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };