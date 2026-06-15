// API Route: /api/admin-api
// File BARU — menggantikan semua direct Supabase call dari client (index.jsx).
//
// KENAPA FILE INI ADA:
//   Sebelumnya index.jsx memanggil supabase.from(...) langsung dari browser
//   menggunakan anon key. Siapapun bisa bypass UI dan query/hapus data.
//   Sekarang semua operasi admin harus lewat endpoint ini, yang:
//     1. Verifikasi JWT admin token (bukan ADMIN_SECRET mentah)
//     2. Baru pakai service role key untuk Supabase
//
// DEPENDENCY: npm install jsonwebtoken @supabase/supabase-js

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ── Helper: hash & verify password (scrypt, tanpa dependency tambahan) ─────
function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(password), salt, 64);
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function verifyPassword(password, stored) {
    try {
        const [scheme, saltHex, hashHex] = String(stored).split('$');
        if (scheme !== 'scrypt') return false;
        const salt = Buffer.from(saltHex, 'hex');
        const expected = Buffer.from(hashHex, 'hex');
        const actual = crypto.scryptSync(String(password), salt, expected.length);
        return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
    } catch {
        return false;
    }
}

// ── Helper: verifikasi JWT admin ──────────────────────────────────────────
function verifyAdminToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.split(' ')[1];
    const secret = process.env.ADMIN_SECRET;
    if (!secret) return null;

    try {
        const payload = jwt.verify(token, secret, { issuer: 'smm-admin' });
        if (payload.role !== 'admin') return null;
        return payload;
    } catch {
        // expired, invalid signature, dll
        return null;
    }
}

// ── Supabase admin client (service role) — hanya di server ───────────────
function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY  // ✅ bukan anon key
    );
}

// ── Audit log: catat tiap aksi penting admin ─────────────────────────────
function getClientIp(req) {
    return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
        .split(',')[0].trim();
}
async function logAudit(supabase, req, { action, target = null, detail = null }) {
    try {
        await supabase.from('audit_logs').insert({
            action,
            target,
            detail: detail ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : null,
            ip: getClientIp(req),
            created_at: new Date().toISOString(),
        });
    } catch (e) {
        // Jangan gagalkan aksi utama hanya karena audit log error
        console.error('[audit] gagal mencatat:', e.message);
    }
}

// ──────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
    // ✅ Semua request wajib punya JWT admin yang valid
    const adminPayload = verifyAdminToken(req);
    if (!adminPayload) {
        return res.status(401).json({ error: 'Unauthorized. Token tidak valid atau sudah expired.' });
    }

    const supabase = getSupabaseAdmin();
    const { action } = req.query;

    // ── GET /api/admin-api?action=... ──────────────────────────────────────

    if (req.method === 'GET') {

        // Ambil markup dari settings
        if (action === 'get_markup') {
            const { data, error } = await supabase.from('settings').select('value').eq('key', 'markup').maybeSingle();
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ value: data?.value || null });
        }

        // Ambil daftar user dari profiles (atau fallback ke transactions)
        if (action === 'get_users') {
            const { data: blockData } = await supabase.from('settings').select('value').eq('key', 'blocked_emails').maybeSingle();
            const blockedEmails = blockData?.value ? JSON.parse(blockData.value) : [];

            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, email, full_name, created_at')
                .order('created_at', { ascending: true });

            if (!profileError && profileData?.length > 0) {
                return res.status(200).json({
                    users: profileData.map(u => ({
                        email: u.email,
                        name: u.full_name || u.email?.split('@')[0],
                        createdAt: u.created_at,
                        blocked: blockedEmails.includes(u.email),
                    }))
                });
            }

            // Fallback: dari transactions
            const { data: txData } = await supabase.from('transactions').select('email, created_at').order('created_at', { ascending: true });
            const seen = new Set();
            const userList = (txData || []).filter(t => {
                if (!t.email || seen.has(t.email)) return false;
                seen.add(t.email); return true;
            }).map(t => ({
                email: t.email,
                name: t.email?.split('@')[0],
                createdAt: t.created_at,
                blocked: blockedEmails.includes(t.email),
            }));
            return res.status(200).json({ users: userList });
        }

        // Ambil semua transactions untuk kalkulasi saldo
        if (action === 'get_transactions_all') {
            const { data, error } = await supabase
                .from('transactions')
                .select('email, type, amount, status');
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ transactions: data || [] });
        }

        // Ambil orders (transactions type=order)
        if (action === 'get_orders') {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('type', 'order')
                .order('created_at', { ascending: false });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ orders: data || [] });
        }

        // Ambil semua deposits (transactions type=deposit)
        if (action === 'get_deposits') {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('type', 'deposit')
                .order('created_at', { ascending: false });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ deposits: data || [] });
        }


        // Ambil semua tiket support
        if (action === 'get_tickets') {
            const { data, error } = await supabase
                .from('tickets')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ tickets: data || [] });
        }

        // Ambil semua pengumuman
        if (action === 'get_announcements') {
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('pinned', { ascending: false })
                .order('updated_at', { ascending: false });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ announcements: data || [] });
        }

        // Ambil markup rules (per-kategori / per-service)
        if (action === 'get_markup_rules') {
            const { data } = await supabase.from('settings').select('value').eq('key', 'markup_rules').maybeSingle();
            let rules = { categories: {}, services: {} };
            if (data?.value) {
                try { const p = JSON.parse(data.value); rules = { categories: p.categories || {}, services: p.services || {} }; } catch { /* ignore */ }
            }
            return res.status(200).json({ rules });
        }

        // Jumlah pending untuk badge sidebar
        if (action === 'get_pending_counts') {
            const { count: deposits } = await supabase
                .from('transactions').select('id', { count: 'exact', head: true })
                .eq('type', 'deposit').eq('status', 'pending');
            const { count: tickets } = await supabase
                .from('tickets').select('id', { count: 'exact', head: true })
                .neq('status', 'closed');
            return res.status(200).json({ deposits: deposits || 0, tickets: tickets || 0 });
        }

        // Audit log — daftar aksi admin terbaru (limit 200)
        if (action === 'get_audit_logs') {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('id, action, target, detail, ip, created_at')
                .order('created_at', { ascending: false })
                .limit(200);
            if (error) return res.status(200).json({ logs: [], error: error.message });
            return res.status(200).json({ logs: data || [] });
        }

        // Detail satu user: profil + riwayat order + riwayat deposit + saldo
        if (action === 'get_user_detail') {
            const email = String(req.query.email || '').trim().toLowerCase();
            if (!email) return res.status(400).json({ error: 'Email wajib diisi.' });

            const { data: profile } = await supabase
                .from('profiles').select('id, email, full_name, created_at').eq('email', email).maybeSingle();

            const { data: txs } = await supabase
                .from('transactions')
                .select('id, type, amount, description, status, created_at')
                .eq('email', email)
                .order('created_at', { ascending: false });

            const list = txs || [];
            const masuk = list.filter(t => ['deposit', 'bonus', 'refund'].includes(t.type) && t.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
            const keluar = list.filter(t => ['order', 'purchase'].includes(t.type) && t.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
            const balance = Math.max(0, masuk - keluar);

            const orders = list.filter(t => ['order', 'purchase'].includes(t.type));
            const deposits = list.filter(t => ['deposit', 'bonus', 'refund'].includes(t.type));

            return res.status(200).json({
                profile: profile || { email },
                balance,
                totalMasuk: masuk,
                totalKeluar: keluar,
                orders,
                deposits,
                orderCount: orders.length,
                depositCount: deposits.length,
            });
        }

        // Daftar service yang dimatikan admin (array of service id string)
        if (action === 'get_disabled_services') {
            const { data } = await supabase.from('settings').select('value').eq('key', 'disabled_services').maybeSingle();
            let ids = [];
            try { ids = data?.value ? JSON.parse(data.value) : []; } catch { ids = []; }
            return res.status(200).json({ disabled: Array.isArray(ids) ? ids : [] });
        }

        // Ambil tier bonus deposit
        if (action === 'get_bonus_tiers') {
            const { data } = await supabase.from('settings').select('value').eq('key', 'deposit_bonus_tiers').maybeSingle();
            let tiers = [];
            try { tiers = data?.value ? JSON.parse(data.value) : []; } catch { tiers = []; }
            return res.status(200).json({ value: Array.isArray(tiers) ? tiers : [] });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    // ── POST /api/admin-api?action=... ────────────────────────────────────

    if (req.method === 'POST') {
        const body = req.body;

        // Simpan markup
        if (action === 'save_markup') {
            const val = parseFloat(body.value);
            if (isNaN(val) || val < 1 || val > 100) {
                return res.status(400).json({ error: 'Nilai markup tidak valid.' });
            }
            const { error } = await supabase.from('settings').upsert({
                key: 'markup',
                value: String(val),
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            if (error) return res.status(500).json({ error: error.message });
            await logAudit(supabase, req, { action: 'save_markup', target: null, detail: { value: val } });
            return res.status(200).json({ ok: true });
        }

        // Toggle on/off layanan — service yang off disembunyikan dari user
        if (action === 'toggle_service') {
            const serviceId = String(body.service_id || '').trim();
            const enabled = body.enabled; // true = aktifkan, false = matikan
            if (!serviceId) return res.status(400).json({ error: 'service_id wajib diisi.' });

            // Ambil daftar disabled saat ini
            const { data: cur } = await supabase.from('settings').select('value').eq('key', 'disabled_services').maybeSingle();
            let disabled = [];
            try { disabled = cur?.value ? JSON.parse(cur.value) : []; } catch { disabled = []; }
            if (!Array.isArray(disabled)) disabled = [];
            const set = new Set(disabled.map(String));

            if (enabled) set.delete(serviceId);   // aktifkan = keluarkan dari daftar disabled
            else set.add(serviceId);               // matikan = masukkan ke daftar disabled

            const next = Array.from(set);
            const { error } = await supabase.from('settings').upsert({
                key: 'disabled_services',
                value: JSON.stringify(next),
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            if (error) return res.status(500).json({ error: error.message });
            await logAudit(supabase, req, { action: 'toggle_service', target: serviceId, detail: { enabled: !!enabled } });
            return res.status(200).json({ ok: true, disabled: next });
        }

        // Toggle block user
        if (action === 'toggle_block') {
            const { email, blocked_emails } = body;
            if (!email || !Array.isArray(blocked_emails)) {
                return res.status(400).json({ error: 'Data tidak valid.' });
            }
            const { error } = await supabase.from('settings').upsert({
                key: 'blocked_emails',
                value: JSON.stringify(blocked_emails),
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            if (error) return res.status(500).json({ error: error.message });
            await logAudit(supabase, req, { action: 'toggle_block', target: email, detail: { blocked: blocked_emails.includes(email) } });
            return res.status(200).json({ ok: true });
        }

        // Hapus user — hapus Supabase Auth user DULU, baru transactions.
        // Urutan ini penting: kalau hapus data dulu lalu hapus-auth gagal, user
        // masih bisa login tapi datanya hilang. Hapus akses dulu baru bersihkan data.
        if (action === 'delete_user') {
            const { email } = body;
            if (!email) return res.status(400).json({ error: 'Email wajib diisi.' });

            // 1) Hapus akun Supabase Auth dulu (cabut akses login)
            const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
            if (profile?.id) {
                const { error: authErr } = await supabase.auth.admin.deleteUser(profile.id);
                // Abaikan "user not found" (sudah terhapus), tapi gagalkan error lain
                if (authErr && !/not found|does not exist/i.test(authErr.message || '')) {
                    return res.status(500).json({ error: `Gagal menghapus akun auth: ${authErr.message}` });
                }
            }

            // 2) Baru hapus transactions
            const { error: txError } = await supabase.from('transactions').delete().eq('email', email);
            if (txError) return res.status(500).json({ error: txError.message });

            // 3) Hapus dari blocked_emails settings jika ada
            const { data: blockData } = await supabase.from('settings').select('value').eq('key', 'blocked_emails').maybeSingle();
            if (blockData?.value) {
                const list = JSON.parse(blockData.value).filter(e => e !== email);
                await supabase.from('settings').upsert({
                    key: 'blocked_emails',
                    value: JSON.stringify(list),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
            }

            await logAudit(supabase, req, { action: 'delete_user', target: email });
            return res.status(200).json({ ok: true });
        }

        // Approve deposit pending
        if (action === 'approve_deposit') {
            const { id, email, amount } = body;
            if (!id || !email || !amount) return res.status(400).json({ error: 'Data tidak lengkap.' });

            // Update status jadi success
            const { error } = await supabase.from('transactions').update({
                status: 'success',
                description: `Deposit QRIS diapprove admin - Rp ${parseInt(amount).toLocaleString('id-ID')}`,
            }).eq('id', id).eq('email', email);

            if (error) return res.status(500).json({ error: error.message });
            await logAudit(supabase, req, { action: 'approve_deposit', target: email, detail: { id, amount: parseInt(amount) } });
            return res.status(200).json({ ok: true });
        }

        // Tolak deposit — set status jadi failed
        if (action === 'reject_deposit') {
            const { id } = body;
            if (!id) return res.status(400).json({ error: 'ID tidak valid.' });
            const { error } = await supabase
                .from('transactions')
                .update({ status: 'failed' })
                .eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            await logAudit(supabase, req, { action: 'reject_deposit', target: String(id) });
            return res.status(200).json({ ok: true });
        }

        // Refund saldo untuk order yang dibatalkan / sebagian gagal
        // Dipicu MANUAL oleh admin. Aman dari double-refund (cek refund existing per order_id).
        if (action === 'refund_order') {
            const order_id = String(body.order_id || '').trim();
            if (!order_id) return res.status(400).json({ error: 'order_id wajib diisi.' });

            // Ambil transaksi order asli (sumber kebenaran amount yang dibayar user)
            const { data: orderRows } = await supabase
                .from('transactions')
                .select('id, email, amount, type, status, qty, remains, description, order_id')
                .eq('order_id', order_id)
                .eq('type', 'order')
                .order('created_at', { ascending: true })
                .limit(1);
            const orderTx = (orderRows || [])[0];

            if (!orderTx) return res.status(404).json({ error: `Order #${order_id} tidak ditemukan.` });
            if (orderTx.status !== 'success') return res.status(400).json({ error: 'Order ini bukan transaksi sukses, tidak bisa direfund.' });

            const paid = Math.round(orderTx.amount || 0);
            if (paid <= 0) return res.status(400).json({ error: 'Nominal order tidak valid.' });

            // ✅ Anti double-refund: cek apakah sudah pernah ada refund untuk order ini
            const { data: existing } = await supabase
                .from('transactions')
                .select('id, amount')
                .eq('order_id', order_id)
                .eq('type', 'refund');
            const alreadyRefunded = (existing || []).reduce((s, t) => s + Math.round(t.amount || 0), 0);
            if (alreadyRefunded >= paid) {
                return res.status(400).json({ error: 'Order ini sudah direfund penuh sebelumnya.' });
            }

            // Hitung jumlah refund yang diminta
            // - mode 'full'    : refund seluruh sisa yang belum direfund
            // - mode 'partial' : proporsional = paid * (remains / qty)
            let refundAmt;
            const mode = body.mode === 'partial' ? 'partial' : 'full';
            if (mode === 'partial') {
                const qty = parseInt(body.qty ?? orderTx.qty) || 0;
                const remains = parseInt(body.remains ?? orderTx.remains) || 0;
                if (qty <= 0 || remains <= 0) {
                    return res.status(400).json({ error: 'Data qty/remains tidak valid untuk refund proporsional.' });
                }
                if (remains > qty) {
                    return res.status(400).json({ error: 'Remains tidak boleh melebihi qty.' });
                }
                refundAmt = Math.round(paid * (remains / qty));
            } else {
                refundAmt = paid - alreadyRefunded; // sisa yang belum direfund
            }

            // ✅ Validasi server-side: total refund tidak boleh melebihi yang dibayar
            if (refundAmt <= 0) return res.status(400).json({ error: 'Jumlah refund tidak valid.' });
            if (alreadyRefunded + refundAmt > paid) {
                refundAmt = paid - alreadyRefunded; // cap di sisa
            }

            const note = mode === 'partial'
                ? `Refund proporsional Order #${order_id} (${body.remains ?? orderTx.remains}/${body.qty ?? orderTx.qty} gagal)`
                : `Refund Order #${order_id} (dibatalkan)`;

            const { error } = await supabase.from('transactions').insert({
                email: orderTx.email,
                type: 'refund',
                amount: refundAmt,
                description: note,
                status: 'success',
                order_id, // simpan agar bisa dilacak & cegah double-refund
            });
            if (error) return res.status(500).json({ error: error.message });

            await logAudit(supabase, req, {
                action: 'refund_order',
                target: orderTx.email,
                detail: { order_id, mode, amount: refundAmt },
            });
            return res.status(200).json({ ok: true, refunded: refundAmt, email: orderTx.email });
        }

        // Deposit / pengurangan manual oleh admin
        if (action === 'manual_deposit') {
            const { email, amount, note, mode } = body;
            if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email tidak valid.' });
            const amt = parseInt(amount);
            if (!amt || amt <= 0) return res.status(400).json({ error: 'Jumlah tidak valid.' });

            const isDeduct = mode === 'deduct';

            // Cek user terdaftar (boleh di profiles atau pernah ada transaksi)
            const { data: profile } = await supabase.from('profiles').select('email').eq('email', email).maybeSingle();
            if (!profile) {
                const { data: txUser } = await supabase.from('transactions').select('email').eq('email', email).limit(1).maybeSingle();
                if (!txUser) return res.status(400).json({ error: `Email ${email} tidak terdaftar di sistem.` });
            }

            // Untuk pengurangan: cegah saldo jadi negatif
            if (isDeduct) {
                const { data: txs } = await supabase
                    .from('transactions')
                    .select('type, amount, status')
                    .eq('email', email);
                let saldo = 0;
                for (const t of (txs || [])) {
                    if (t.status !== 'success') continue;
                    if (['deposit', 'bonus', 'refund'].includes(t.type)) saldo += (t.amount || 0);
                    else if (['order', 'purchase'].includes(t.type)) saldo -= (t.amount || 0);
                }
                saldo = Math.max(0, saldo);
                if (amt > saldo) {
                    return res.status(400).json({ error: `Saldo tidak cukup (saldo: Rp ${saldo.toLocaleString('id-ID')}).` });
                }
            }

            const { error } = await supabase.from('transactions').insert({
                email,
                type: isDeduct ? 'order' : 'deposit',
                amount: amt,
                description: note || (isDeduct ? 'Pengurangan saldo manual oleh admin' : 'Deposit manual oleh admin'),
                status: 'success',
            });
            if (error) return res.status(500).json({ error: error.message });
            await logAudit(supabase, req, {
                action: 'manual_deposit',
                target: email,
                detail: { amount: amt, mode: isDeduct ? 'deduct' : 'add', note: note || '' },
            });
            return res.status(200).json({ ok: true });
        }


        // Update tiket (status atau reply)
        if (action === 'update_ticket') {
            const { id, status, replies } = body;
            if (!id) return res.status(400).json({ error: 'ID tiket wajib diisi.' });
            const updates = { updated_at: new Date().toISOString() };
            if (status) updates.status = status;
            if (replies) updates.replies = replies;
            const { error } = await supabase.from('tickets').update(updates).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        // Buat atau update pengumuman
        if (action === 'save_announcement') {
            const { id, title, content, type, pinned } = body;
            if (!title?.trim() || !content?.trim()) return res.status(400).json({ error: 'Judul dan isi wajib diisi.' });
            const payload = { title, content, type: type || 'info', pinned: !!pinned, updated_at: new Date().toISOString() };
            const { error } = id
                ? await supabase.from('announcements').update(payload).eq('id', id)
                : await supabase.from('announcements').insert(payload);
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        // Hapus pengumuman
        if (action === 'delete_announcement') {
            const { id } = body;
            if (!id) return res.status(400).json({ error: 'ID pengumuman wajib diisi.' });
            const { error } = await supabase.from('announcements').delete().eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        // Simpan markup rules (per-kategori / per-service)
        if (action === 'save_markup_rules') {
            const cleanMap = (obj) => {
                const out = {};
                for (const [k, v] of Object.entries(obj || {})) {
                    const n = parseFloat(v);
                    if (k && !isNaN(n) && n >= 1 && n <= 100) out[k] = n;
                }
                return out;
            };
            const rules = { categories: cleanMap(body.categories), services: cleanMap(body.services) };
            const { error } = await supabase.from('settings').upsert({
                key: 'markup_rules', value: JSON.stringify(rules), updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            if (error) return res.status(500).json({ error: error.message });
            await logAudit(supabase, req, { action: 'save_markup_rules', target: null, detail: { categories: Object.keys(rules.categories).length, services: Object.keys(rules.services).length } });
            return res.status(200).json({ ok: true, rules });
        }

        // Simpan override kurs USD/IDR manual
        if (action === 'save_rate') {
            const val = parseInt(body.value, 10);
            if (!val || val < 1000 || val > 1000000) return res.status(400).json({ error: 'Kurs tidak valid.' });
            const { error } = await supabase.from('settings').upsert({
                key: 'rate_override', value: String(val), updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            if (error) return res.status(500).json({ error: error.message });
            await logAudit(supabase, req, { action: 'save_rate', target: null, detail: { value: val } });
            return res.status(200).json({ ok: true });
        }

        // Ganti password admin (disimpan sebagai hash di settings)
        if (action === 'change_password') {
            const { current, next } = body;
            if (!current || !next) return res.status(400).json({ error: 'Lengkapi semua field.' });
            if (String(next).length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });

            const { data: hashData } = await supabase.from('settings').select('value').eq('key', 'admin_password_hash').maybeSingle();
            const currentValid = hashData?.value
                ? verifyPassword(current, hashData.value)
                : (current === process.env.ADMIN_PASSWORD);
            if (!currentValid) return res.status(400).json({ error: 'Password saat ini salah.' });

            const { error } = await supabase.from('settings').upsert({
                key: 'admin_password_hash', value: hashPassword(next), updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            if (error) return res.status(500).json({ error: error.message });
            await logAudit(supabase, req, { action: 'change_password', target: null, detail: null });
            return res.status(200).json({ ok: true });
        }

        // Simpan tier bonus deposit
        if (action === 'save_bonus_tiers') {
            const raw = body.value;
            if (!Array.isArray(raw)) return res.status(400).json({ error: 'Format tier tidak valid.' });
            // Validasi tiap tier: min >= 0, percent 0..100. Buang yang invalid, urutkan menaik.
            const clean = raw
                .map(t => ({ min: parseInt(t?.min, 10), percent: parseFloat(t?.percent) }))
                .filter(t => Number.isFinite(t.min) && t.min >= 0 && Number.isFinite(t.percent) && t.percent >= 0 && t.percent <= 100)
                .sort((a, b) => a.min - b.min);
            const { error } = await supabase.from('settings').upsert({
                key: 'deposit_bonus_tiers', value: JSON.stringify(clean), updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            if (error) return res.status(500).json({ error: error.message });
            await logAudit(supabase, req, { action: 'save_bonus_tiers', target: null, detail: { count: clean.length } });
            return res.status(200).json({ ok: true, value: clean });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}