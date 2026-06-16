// API Route: /api/cron/sweep-qris
//
// JARING PENGAMAN WEBHOOK PAYMENKU.
// Webhook dari Paymenku TIDAK 100% reliable — kadang pembayaran "Berhasil" di sisi
// Paymenku tapi callback ke server kita tak pernah dikirim (terbukti dari kasus
// TrxID IDP202606161726950564: status Berhasil, dana masuk, tapi tak ada di
// Webhook Logs Paymenku & tak pernah dikreditkan).
//
// Sweeper ini berjalan periodik (mis. tiap 3 menit via cron-job.org), mengambil
// semua baris berstatus 'qris_pending', menanyakan status sebenarnya ke Paymenku,
// lalu:
//   - paid     -> kreditkan (jadikan 'success' + bonus, sama seperti webhook)
//   - expired  -> tandai 'qris_expired'
//   - lainnya  -> biarkan pending (akan dicek lagi siklus berikutnya)
//
// Idempoten: hanya memproses baris yang MASIH 'qris_pending'. Update memakai filter
// .eq('status','qris_pending') sehingga balapan dengan webhook tidak menggandakan kredit
// (siapa pun yang menang duluan mengubah status; yang kalah meng-update 0 baris).

import { createClient } from '@supabase/supabase-js';

const PAYMENKU_BASE = 'https://paymenku.com/api/v1';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Bonus deposit dihitung di server dari tier 'deposit_bonus_tiers' (sama dgn webhook).
async function getBonusAmount(baseAmount: number): Promise<{ bonus: number; percent: number }> {
    try {
        const { data } = await supabaseAdmin
            .from('settings').select('value').eq('key', 'deposit_bonus_tiers').maybeSingle();
        if (!data?.value) return { bonus: 0, percent: 0 };
        const tiers = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        if (!Array.isArray(tiers) || tiers.length === 0) return { bonus: 0, percent: 0 };
        const sorted = tiers
            .filter((t: any) => t && Number.isFinite(Number(t.min)) && Number.isFinite(Number(t.percent)))
            .sort((a: any, b: any) => Number(a.min) - Number(b.min));
        let percent = 0;
        for (const t of sorted) {
            if (baseAmount >= Number(t.min)) percent = Number(t.percent);
        }
        return { bonus: Math.round(baseAmount * percent / 100), percent };
    } catch {
        return { bonus: 0, percent: 0 };
    }
}

// Ekstrak status & nominal dari berbagai bentuk respons check-status Paymenku.
function readStatus(data: any): { status: string; amountReceived: number; trxId: string | null } {
    const d = (data && typeof data === 'object') ? (data.data && typeof data.data === 'object' ? data.data : data) : {};
    const status = String(d.status || data?.status || '').toLowerCase();
    const amountReceived = parseFloat(d.amount_received ?? data?.amount_received ?? 0) || 0;
    const trxId = d.trx_id || d.transaction_id || d.id || data?.trx_id || null;
    return { status, amountReceived, trxId: trxId ? String(trxId) : null };
}

export default async function handler(req: any, res: any) {
    // ── Auth: hanya boleh dipanggil oleh cron yang tahu CRON_SECRET ──
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        console.error('[sweep-qris] CRON_SECRET belum diset.');
        return res.status(500).json({ error: 'Sweeper not configured.' });
    }
    const provided =
        (req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
        req.query.secret || '';
    if (provided !== secret) {
        return res.status(401).json({ error: 'Unauthorized.' });
    }

    const PAYMENKU_API_KEY = process.env.PAYMENKU_API_KEY;
    if (!PAYMENKU_API_KEY) {
        return res.status(500).json({ error: 'Payment gateway belum dikonfigurasi.' });
    }

    // ── Ambil kandidat: qris_pending umur 2 menit s/d 24 jam ──
    // - >2 menit: beri waktu webhook normal lebih dulu (hindari balapan tak perlu).
    // - <24 jam: lebih tua dari itu dianggap kedaluwarsa (ditangani sebagai expired).
    const now = Date.now();
    const minAgeISO = new Date(now - 2 * 60 * 1000).toISOString();
    const maxAgeISO = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const { data: pending, error: selErr } = await supabaseAdmin
        .from('transactions')
        .select('id, email, user_id, qr_amount, amount, qr_trx_id, description, created_at')
        .eq('status', 'qris_pending')
        .lt('created_at', minAgeISO)
        .order('created_at', { ascending: true })
        .limit(50); // batasi per run agar tidak menahan request kelamaan

    if (selErr) {
        console.error('[sweep-qris] select error:', selErr.message);
        return res.status(500).json({ error: 'DB select failed.' });
    }

    const summary = { checked: 0, credited: 0, expired: 0, stillPending: 0, errors: 0 };

    for (const row of (pending || [])) {
        summary.checked++;

        // Terlalu tua -> expired.
        if (row.created_at && row.created_at < maxAgeISO) {
            const { error } = await supabaseAdmin
                .from('transactions')
                .update({ status: 'qris_expired', description: `${row.description || 'QRIS'} [expired by sweeper]` })
                .eq('id', row.id)
                .eq('status', 'qris_pending');
            if (!error) summary.expired++;
            continue;
        }

        // trx_id Paymenku: utamakan kolom, fallback parse dari description "QRIS_PENDING_<trx>".
        let trxId = row.qr_trx_id || null;
        if (!trxId && row.description) {
            const m = String(row.description).match(/QRIS_PENDING_([A-Za-z0-9]+)/);
            if (m) trxId = m[1];
        }
        if (!trxId) { summary.stillPending++; continue; }

        // ── Tanya status ke Paymenku ──
        let data: any;
        try {
            const resp = await fetch(`${PAYMENKU_BASE}/check-status/${encodeURIComponent(trxId)}`, {
                headers: { 'Authorization': `Bearer ${PAYMENKU_API_KEY}` },
            });
            data = await resp.json();
        } catch (e: any) {
            console.error('[sweep-qris] check-status error:', trxId, e?.message);
            summary.errors++;
            continue;
        }

        const { status: payStatus, amountReceived } = readStatus(data);

        if (payStatus === 'paid' || payStatus === 'success' || payStatus === 'settled') {
            // Nominal deposit: utamakan qr_amount (yang user pilih), fallback amount_received (net).
            const baseAmt = Math.round(Number(row.qr_amount) || amountReceived || Number(row.amount) || 0);
            if (baseAmt <= 0) { summary.errors++; continue; }

            const { bonus, percent } = await getBonusAmount(baseAmt);
            const creditAmount = baseAmt + bonus;
            const bonusNote = bonus > 0 ? ` (+bonus ${percent}%: Rp ${bonus})` : '';

            // Update HANYA jika masih qris_pending -> idempoten & aman dari balapan webhook.
            const { data: updated, error: updErr } = await supabaseAdmin
                .from('transactions')
                .update({
                    type: 'deposit',
                    status: 'success',
                    amount: creditAmount,
                    description: `Top up QRIS - TrxID: ${trxId}${bonusNote} [via sweeper]`,
                })
                .eq('id', row.id)
                .eq('status', 'qris_pending')
                .select('id');

            if (updErr) { console.error('[sweep-qris] update error:', updErr.message); summary.errors++; continue; }
            if (updated && updated.length > 0) {
                summary.credited++;
                console.log(`[sweep-qris] Credited ${trxId} - Rp ${baseAmt}${bonusNote} = Rp ${creditAmount} - ${row.email}`);
            } else {
                // 0 baris ter-update -> sudah diproses pihak lain (webhook). Aman.
                summary.stillPending++;
            }
        } else if (payStatus === 'expired' || payStatus === 'failed' || payStatus === 'cancelled' || payStatus === 'canceled') {
            const { error } = await supabaseAdmin
                .from('transactions')
                .update({ status: 'qris_expired', description: `${row.description || 'QRIS'} [${payStatus} by sweeper]` })
                .eq('id', row.id)
                .eq('status', 'qris_pending');
            if (!error) summary.expired++;
        } else {
            // pending/unpaid -> biarkan, cek lagi siklus berikut.
            summary.stillPending++;
        }
    }

    console.log('[sweep-qris] run summary:', JSON.stringify(summary));
    return res.status(200).json({ ok: true, ...summary });
}

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };