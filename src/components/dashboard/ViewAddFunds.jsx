import { useState, useEffect } from 'react';
import { CreditCard, Bitcoin, Wallet, Building2, ArrowRight, ShieldCheck, Lock, CheckCircle, Zap, Clock, Star, AlertCircle, RefreshCw, MessageCircle } from 'lucide-react';
import { useApi } from '@/context/ApiContext';
import { supabase } from '@/lib/supabase';

const METHODS = [
  {
    id: 'qris',
    label: 'QRIS',
    icon: '▦',
    color: '#E91E63',
    bg: 'rgba(233,30,99,.08)',
    border: 'rgba(233,30,99,.2)',
    badge: 'Instan',
    badgeColor: '#E91E63',
    badgeBg: 'rgba(233,30,99,.1)',
    desc: 'Scan QR dari semua bank & e-wallet',
    fee: 'Fee Rp 200 + 0.7%',
    time: 'Instan',
  },
  {
    id: 'manual',
    label: 'Transfer Manual',
    icon: <MessageCircle size={22} />,
    color: '#25D366',
    bg: 'rgba(37,211,102,.08)',
    border: 'rgba(37,211,102,.2)',
    badge: 'Via WhatsApp',
    badgeColor: '#25D366',
    badgeBg: 'rgba(37,211,102,.1)',
    desc: 'Transfer QRIS lalu konfirmasi ke admin',
    fee: 'No fee',
    time: '< 5 menit',
  },
  {
    id: 'crypto',
    label: 'Cryptocurrency',
    icon: <Bitcoin size={22} />,
    color: '#F7931A',
    bg: 'rgba(247,147,26,.1)',
    border: 'rgba(247,147,26,.3)',
    badge: 'Akan Datang',
    badgeColor: '#F7931A',
    badgeBg: 'rgba(247,147,26,.12)',
    desc: 'BTC, ETH, USDT, BNB & more',
    fee: 'No fees',
    time: 'Instant',
    coming_soon: true,
  },

];

const PRESETS_IDR = [5000, 10000, 15000, 20000, 50000, 100000];

// ── Default tier bonus deposit (dipakai kalau admin belum set di settings) ──
// min = nominal minimum (inklusif), percent = persen bonus.
// Diurutkan dari kecil ke besar. Bonus dihitung dari tier TERTINGGI yang lolos.
const DEFAULT_BONUS_TIERS = [
  { min: 50000, percent: 2 },
  { min: 100000, percent: 3 },
  { min: 250000, percent: 5 },
  { min: 500000, percent: 7 },
  { min: 1000000, percent: 10 },
];

// Hitung persen bonus untuk nominal tertentu berdasarkan daftar tier.
// Mengembalikan persen (number). 0 kalau tidak ada tier yang lolos.
function getBonusPercent(amount, tiers) {
  if (!amount || !Array.isArray(tiers) || tiers.length === 0) return 0;
  // urut menaik berdasarkan min, ambil tier tertinggi yang <= amount
  const sorted = [...tiers].filter(t => t && t.min != null && t.percent != null)
    .sort((a, b) => a.min - b.min);
  let pct = 0;
  for (const t of sorted) {
    if (amount >= t.min) pct = t.percent;
  }
  return pct;
}

const formatIDR = (num) => {
  if (!num) return 'Rp 0';
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
};

export default function ViewAddFunds({ user, balance: balanceProp = null }) {
  const { apiUrl, apiKey } = useApi();
  const [method, setMethod] = useState('qris');
  const handleMethodChange = (m) => {
    setMethod(m);
    const min = m === 'qris' ? 10000 : 5000;
    if (parseFloat(amountIDR) < min) setAmountIDR('');
  };
  const [amountIDR, setAmountIDR] = useState('');
  const [balanceIDRUser, setBalanceIDRUser] = useState(balanceProp);
  const [rate, setRate] = useState(null);
  const [bonusTiers, setBonusTiers] = useState(DEFAULT_BONUS_TIERS);
  const [rateUpdated, setRateUpdated] = useState(null);
  const [rateSource, setRateSource] = useState(null);
  const [loadingRate, setLoadingRate] = useState(true);
  const [step, setStepRaw] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [qrisData, setQrisDataRaw] = useState(null);
  const [qrisChecking, setQrisChecking] = useState(false);
  const [qrisStatus, setQrisStatusRaw] = useState(null);
  const [qrisError, setQrisError] = useState('');
  const [showBackConfirm, setShowBackConfirm] = useState(false);

  // Simpan/hapus QR ke Supabase
  const saveQrisToDB = async (data) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (!email || !data) return;
      await supabase.from('transactions').update({
        qr_url: data.qr_url || null,
        qr_string: data.qr_string || null,
        qr_trx_id: data.trx_id || null,
        qr_expiry: data.expiry || null,
        qr_total: data.totalAmount || null,
        qr_amount: data.amount || null,
        qr_ref: data.reference_id || null,
      }).eq('description', `QRIS_PENDING_${data.trx_id}`).eq('email', email);
    } catch { }
  };

  const setQrisData = (data) => {
    setQrisDataRaw(data);
    try {
      if (data) sessionStorage.setItem('qris_data', JSON.stringify(data));
      else sessionStorage.removeItem('qris_data');
    } catch { }
  };

  const setQrisStatus = (status) => {
    setQrisStatusRaw(status);
    try {
      if (status) sessionStorage.setItem('qris_status', status);
      else sessionStorage.removeItem('qris_status');
    } catch { }
  };

  const setStep = (v) => {
    setStepRaw(v);
    if (v !== 3) {
      try { sessionStorage.removeItem('qris_data'); sessionStorage.removeItem('qris_status'); } catch { }
    }
  };

  // Restore QR dari sessionStorage atau Supabase saat mount
  useEffect(() => {
    // Cek apakah QR sudah kadaluarsa. expiry bisa berupa ISO string / epoch detik / epoch ms.
    // Kalau tidak ada info expiry, anggap basi setelah 2 jam dari created_at (kalau ada).
    const isExpired = (expiry, createdAt) => {
      try {
        if (expiry) {
          let t;
          if (typeof expiry === 'number') t = expiry < 1e12 ? expiry * 1000 : expiry; // detik vs ms
          else if (/^\d+$/.test(String(expiry))) {
            const n = parseInt(expiry, 10); t = n < 1e12 ? n * 1000 : n;
          } else t = new Date(expiry).getTime();
          if (!isNaN(t)) return Date.now() > t;
        }
        if (createdAt) {
          const c = new Date(createdAt).getTime();
          if (!isNaN(c)) return Date.now() > c + 2 * 60 * 60 * 1000; // 2 jam
        }
      } catch { }
      return false;
    };

    const clearQris = () => {
      try { sessionStorage.removeItem('qris_data'); sessionStorage.removeItem('qris_status'); } catch { }
    };

    const restore = async () => {
      // Helper cek apakah trx_id sudah lunas (deposit success) di Supabase
      const isAlreadyPaid = async (trxId) => {
        try {
          if (!trxId) return false;
          const { data } = await supabase
            .from('transactions')
            .select('status, type')
            .or(`qr_trx_id.eq.${trxId},description.ilike.%${trxId}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          return data && data.type === 'deposit' && data.status === 'success';
        } catch { return false; }
      };

      // Coba dari sessionStorage dulu (cepat)
      try {
        const cached = sessionStorage.getItem('qris_data');
        const cachedStatus = sessionStorage.getItem('qris_status');
        if (cached) {
          const parsed = JSON.parse(cached);
          // ✅ Jangan pulihkan kalau sudah kadaluarsa
          if (isExpired(parsed?.expiry)) {
            clearQris();
          } else if (await isAlreadyPaid(parsed?.trx_id)) {
            // ✅ Sudah dibayar — jangan tampilkan QR lagi, bersihkan
            clearQris();
          } else {
            setQrisDataRaw(parsed);
            setQrisStatusRaw(cachedStatus || 'pending');
            setStepRaw(3);
            return;
          }
        }
      } catch { }

      // Fallback: restore dari Supabase
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email;
        if (!email) return;
        const { data } = await supabase
          .from('transactions')
          .select('*')
          .eq('email', email)
          .eq('status', 'pending_webhook')
          .not('qr_trx_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.qr_trx_id) {
          // ✅ Jangan pulihkan kalau sudah kadaluarsa atau sudah dibayar
          if (isExpired(data.qr_expiry, data.created_at) || await isAlreadyPaid(data.qr_trx_id)) {
            clearQris();
            return;
          }
          const restored = {
            qr_url: data.qr_url,
            qr_string: data.qr_string,
            trx_id: data.qr_trx_id,
            expiry: data.qr_expiry,
            totalAmount: data.qr_total,
            amount: data.qr_amount,
            reference_id: data.qr_ref,
          };
          setQrisDataRaw(restored);
          setQrisStatusRaw('pending');
          setStepRaw(3);
          try { sessionStorage.setItem('qris_data', JSON.stringify(restored)); } catch { }
        }
      } catch { }
    };
    restore();
  }, []);

  const fetchRate = async () => {
    setLoadingRate(true);
    try {
      const res = await fetch('/api/rate');
      const data = await res.json();
      setRate(data.rate);
      setRateUpdated(data.updated);
      setRateSource(data.source);
    } catch (e) {
      setRate(16350); // fallback
    }
    setLoadingRate(false);
  };

  useEffect(() => {
    fetchRate();
  }, []);

  // Ambil konfigurasi tier bonus deposit dari Supabase settings.
  // Disimpan admin di key 'deposit_bonus_tiers' sebagai JSON string.
  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'deposit_bonus_tiers').maybeSingle()
      .then(({ data }) => {
        if (!data?.value) return;
        try {
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          if (Array.isArray(parsed) && parsed.length > 0) setBonusTiers(parsed);
        } catch { /* pakai default kalau parse gagal */ }
      });
  }, []);

  // Sync balance dari prop (dihitung di dashboard.jsx dari user_transactions)
  useEffect(() => {
    if (balanceProp !== null) setBalanceIDRUser(balanceProp);
  }, [balanceProp]);

  const numIDR = parseFloat(String(amountIDR).replace(/\./g, '').replace(',', '.')) || 0;
  const minAmount = method === 'qris' ? 10000 : 5000;
  const numUSD = rate ? numIDR / rate : 0;
  const balanceIDR = balanceIDRUser;
  const feeIDR = method === 'qris' ? (200 + numIDR * 0.007) : method === 'card' ? numIDR * 0.025 : 0;
  const totalIDR = numIDR + feeIDR;
  // Bonus tiered (berlaku untuk qris & crypto, tidak untuk transfer manual).
  const bonusPercent = (method === 'qris' || method === 'crypto') ? getBonusPercent(numIDR, bonusTiers) : 0;
  const bonusIDR = Math.round(numIDR * bonusPercent / 100);
  const receiveIDR = numIDR + bonusIDR;
  const selectedMethod = METHODS.find(m => m.id === method);

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setAmountIDR(raw);
  };

  const handleConfirm = async () => {
    if (numIDR < minAmount) return;
    // QRIS via Paymenku
    if (method === 'qris') {
      setProcessing(true);
      setQrisError('');
      try {
        // ✅ Fix Critical: ambil session dari Supabase Auth, bukan sessionStorage
        // customer_email di server akan di-override dengan user.email dari session JWT
        // (sudah diimplementasikan di /api/payment) — ini hanya untuk reference_id
        const { data: { session: paySession } } = await supabase.auth.getSession();
        const refId = `${paySession?.user?.email || 'user'}_${Date.now()}`;
        const resp = await fetch('/api/payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${paySession?.access_token || ''}`,
          },
          body: JSON.stringify({
            action: 'create_qris',
            reference_id: refId,
            // ✅ Kirim nominal MURNI (numIDR), bukan totalIDR.
            // Channel QRIS Paymenku = Fee Mode "Customer", jadi Paymenku otomatis
            // menambahkan fee (Rp 200 + 0.7%) di ATAS amount ini dan menagihkannya
            // ke customer. Net yang diterima merchant = numIDR. Mengirim totalIDR
            // menyebabkan fee dihitung dua kali (double-fee).
            amount: Math.round(numIDR),
          }),
        });
        const data = await resp.json();
        if (data.status === 'success' && data.data) {
          // Total tagihan sebenarnya = dari respons Paymenku (sudah termasuk fee Customer).
          // Fallback ke estimasi (numIDR + fee) kalau field tidak tersedia.
          const billedTotal =
            data.data.total_amount ??
            data.data.payment_info?.total_amount ??
            data.data.amount ??
            Math.round(totalIDR);
          const qrisPayload = {
            qr_url: data.data.payment_info?.qr_url,
            qr_string: data.data.payment_info?.qr_string,
            trx_id: data.data.trx_id,
            reference_id: refId,
            amount: numIDR,                       // saldo yang diterima user = nominal murni
            totalAmount: Math.round(billedTotal), // total yang ditagih ke user (sudah +fee Paymenku)
            expiry: data.data.payment_info?.expiration_date,
          };
          setQrisData(qrisPayload);
          setQrisStatus('pending');
          setStep(3);
          // Simpan ke Supabase untuk restore lintas device/tab
          try {
            const { data: { session: s } } = await supabase.auth.getSession();
            await supabase.from('transactions').insert({
              user_id: s?.user?.id || null,
              email: s?.user?.email,
              type: 'qris_pending',
              amount: numIDR,
              description: `QRIS_PENDING_${data.data.trx_id}`,
              status: 'pending_webhook',
              qr_url: qrisPayload.qr_url || null,
              qr_string: qrisPayload.qr_string || null,
              qr_trx_id: qrisPayload.trx_id || null,
              qr_expiry: qrisPayload.expiry || null,
              qr_total: qrisPayload.totalAmount || null,
              qr_amount: qrisPayload.amount || null,
              qr_ref: qrisPayload.reference_id || null,
            });
          } catch { }
        } else {
          setQrisError(data.message || 'Gagal membuat transaksi QRIS. Coba lagi.');
        }
      } catch (e) {
        setQrisError('Koneksi gagal: ' + e.message);
      }
      setProcessing(false);
      return;
    }
    // Transfer Manual via WhatsApp
    if (method === 'manual') {
      const email = user?.email || '';
      const msg = encodeURIComponent(
        `Halo admin, saya mau melakukan top up manual.\n\n` +
        `Email: ${email}\n` +
        `Jumlah: ${formatIDR(numIDR)}\n\n` +
        `Mohon info nomor/QRIS tujuan transfer. Setelah transfer, saya akan kirim BUKTI TRANSFER (screenshot) di chat ini untuk diverifikasi.`
      );
      window.open(`https://wa.me/6283843306230?text=${msg}`, '_blank');
      return;
    }
    // Other methods — placeholder
    setProcessing(true);
    setTimeout(() => { setProcessing(false); setDone(true); }, 1800);
  };

  // Poll QRIS payment status
  // Helper: cek apakah pembayaran sudah lunas.
  // Sumber utama = Supabase (webhook sudah ubah qris_pending -> deposit/success = saldo masuk).
  // Sumber cadangan = Paymenku check_status. Terima berbagai variasi nama status.
  const isPaidStatus = (s) => {
    const v = String(s || '').toLowerCase();
    return ['paid', 'success', 'settled', 'completed', 'berhasil'].includes(v);
  };

  const checkPaidViaSupabase = async () => {
    try {
      const trx = qrisData?.trx_id;
      if (!trx) return false;
      const { data } = await supabase
        .from('transactions')
        .select('status, type')
        .or(`qr_trx_id.eq.${trx},description.ilike.%${trx}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      // Webhook mengubah baris jadi type='deposit' status='success' saat lunas
      if (data && data.type === 'deposit' && data.status === 'success') return true;
    } catch { }
    return false;
  };

  const checkQrisStatus = async () => {
    if (!qrisData?.trx_id) return;
    setQrisChecking(true);
    try {
      // 1) Cek Supabase dulu (paling andal — saldo sudah benar2 masuk)
      if (await checkPaidViaSupabase()) {
        setQrisStatus('paid');
        setDone(true);
        setQrisChecking(false);
        return;
      }
      // 2) Cadangan: tanya Paymenku
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`/api/payment?action=check_status&order_id=${qrisData.trx_id}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });
      const data = await resp.json();
      const status = data.data?.status || data.status;
      if (isPaidStatus(status)) {
        setQrisStatus('paid');
        setDone(true);
      } else {
        setQrisStatus(status || 'pending');
      }
    } catch { }
    setQrisChecking(false);
  };

  // Auto-poll setiap 5 detik saat QR ditampilkan
  useEffect(() => {
    if (step !== 3 || !qrisData || qrisStatus === 'paid' || qrisStatus === 'expired') return;
    const interval = setInterval(async () => {
      try {
        // 1) Sumber kebenaran: Supabase (di-update webhook saat lunas)
        if (await checkPaidViaSupabase()) {
          setQrisStatus('paid');
          clearInterval(interval);
          setTimeout(() => setDone(true), 1200);
          return;
        }
        // 2) Cadangan: Paymenku
        const { data: { session: pollSession } } = await supabase.auth.getSession();
        const resp = await fetch(`/api/payment?action=check_status&order_id=${qrisData.trx_id}`, {
          headers: { 'Authorization': `Bearer ${pollSession?.access_token || ''}` }
        });
        const data = await resp.json();
        const status = data.data?.status || data.status;
        if (isPaidStatus(status)) {
          setQrisStatus('paid');
          clearInterval(interval);
          setTimeout(() => setDone(true), 1200);
        } else if (status === 'expired' || status === 'cancelled') {
          setQrisStatus(status);
          clearInterval(interval);
        }
      } catch { }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, qrisData, qrisStatus]);

  if (done) {
    const newBalance = (balanceIDR || 0); // saldo sudah ter-update via auto-poll/refetch
    const trxId = qrisData?.trx_id || '—';
    const nowStr = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return (
      <div className="fu" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'min(70vh, 560px)', padding: 16 }}>
        <style>{`
          @keyframes popIn{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
          @keyframes ringPulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,.35)}70%{box-shadow:0 0 0 16px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}
        `}</style>
        <div className="card" style={{ padding: 'clamp(28px, 6vw, 40px) clamp(22px, 5vw, 36px)', maxWidth: 400, width: '100%' }}>
          {/* Centang + judul */}
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'var(--green-l)', border: '2px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', animation: 'popIn .5s ease-out, ringPulse 1.8s ease-out .4s' }}>
              <CheckCircle size={34} style={{ color: 'var(--green)' }} />
            </div>
            <h2 style={{ fontSize: 'clamp(17px, 5vw, 20px)', fontWeight: 800, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3 }}>Pembayaran Berhasil</h2>
            <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>Saldo kamu sudah otomatis ditambahkan.</p>
          </div>

          {/* Detail key-value */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { label: 'ID Transaksi', value: <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5 }}>{trxId}</span> },
              { label: 'Metode', value: method === 'qris' ? 'QRIS' : method?.toUpperCase() },
              { label: 'Tanggal', value: nowStr },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 500, flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700, textAlign: 'right', wordBreak: 'break-all' }}>{row.value}</span>
              </div>
            ))}
            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0 0' }}>
              <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 800 }}>Total Deposit</span>
              <span style={{ fontSize: 17, color: 'var(--green)', fontWeight: 800 }}>{formatIDR(numIDR)}</span>
            </div>
          </div>

          {/* Saldo sekarang */}
          <div style={{ background: 'var(--blue)', borderRadius: 14, padding: '14px 18px', margin: '22px 0', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, opacity: .9 }}>Saldo Kamu Sekarang</span>
            <span style={{ fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 800 }}>{formatIDR(newBalance)}</span>
          </div>

          <button className="btn btn-blue" onClick={() => { setDone(false); setStep(1); setAmountIDR(''); }} style={{ width: '100%', borderRadius: 11, padding: 13 }}>
            Tambah Dana Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fu">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Tambah Saldo</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Top up saldo kamu dengan aman dan instan.</p>
      </div>

      {/* Balance card — mobile only */}
      <div className="addfunds-balance-mobile" style={{ marginBottom: 14 }}>
        <div style={{ background: 'linear-gradient(135deg, var(--blue), #1D4ED8)', borderRadius: 14, padding: '16px 18px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.65)', fontWeight: 600, marginBottom: 2, letterSpacing: '.06em' }}>SALDO SAAT INI</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{balanceIDR !== null ? formatIDR(balanceIDR) : '—'}</div>
          </div>
          {numIDR > 0 && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', textAlign: 'right' }}>
              <div style={{ fontSize: 10, marginBottom: 2 }}>Setelah top up</div>
              <strong>{formatIDR((balanceIDR || 0) + receiveIDR)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        {['Pilih Metode & Jumlah', 'Konfirmasi'].map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: step > i ? 'var(--green)' : step === i + 1 ? 'var(--blue)' : 'var(--bg2)', border: `2px solid ${step > i ? 'var(--green)' : step === i + 1 ? 'var(--blue)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: step >= i + 1 ? '#fff' : 'var(--text3)', fontSize: 12, fontWeight: 800, flexShrink: 0, transition: 'all .3s' }}>
              {step > i ? <CheckCircle size={13} /> : i + 1}
            </div>
            <span style={{ fontSize: 13, fontWeight: step === i + 1 ? 700 : 500, color: step === i + 1 ? 'var(--text)' : 'var(--text3)', whiteSpace: 'nowrap' }}>{s}</span>
            {i < 1 && <div style={{ width: 32, height: 2, background: step > 1 ? 'var(--green)' : 'var(--border)', borderRadius: 2, transition: 'background .3s' }} />}
          </div>
        ))}
      </div>

      {step === 3 && qrisData && (
        <div className="qris-pay-wrap" style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* QR CENTER */}
          <div className="card" style={{ flex: '1 1 300px', maxWidth: 420, padding: 'clamp(18px, 4vw, 28px)', textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginBottom: 4 }}>Scan QR Code</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
              Bayar <strong style={{ color: '#E91E63' }}>Rp {(qrisData.totalAmount || Math.round(qrisData.amount)).toLocaleString('id-ID')}</strong> via QRIS
              {qrisData.totalAmount && qrisData.totalAmount !== qrisData.amount && (
                <span style={{ fontSize: 11.5, display: 'block', marginTop: 3 }}>(Saldo diterima: Rp {Math.round(qrisData.amount).toLocaleString('id-ID')})</span>
              )}
              {qrisData.expiry && new Date(qrisData.expiry).getTime() > 0 && <span style={{ display: 'block', marginTop: 2 }}>Berlaku s/d {new Date(qrisData.expiry).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
            <div style={{ display: 'inline-block', padding: 16, background: '#fff', borderRadius: 16, border: '2px solid var(--border)', marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,.08)', maxWidth: '100%' }}>
              {qrisData.qr_string
                ? <img src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrisData.qr_string)}`} alt="QRIS" style={{ width: 'min(220px, 60vw)', height: 'min(220px, 60vw)', display: 'block', borderRadius: 8 }} />
                : qrisData.qr_url
                  ? <img src={qrisData.qr_url} alt="QRIS" style={{ width: 'min(220px, 60vw)', height: 'min(220px, 60vw)', display: 'block', borderRadius: 8 }} />
                  : <div style={{ width: 'min(220px, 60vw)', height: 'min(220px, 60vw)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg2)', borderRadius: 10 }}>
                    <div style={{ fontSize: 56 }}>▦</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, textAlign: 'center', wordBreak: 'break-all', padding: '0 8px' }}>ID: {qrisData.trx_id}</div>
                  </div>
              }
            </div>
            <div style={{ marginBottom: 18 }}>
              {qrisStatus === 'pending' && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--yellow-l)', color: 'var(--yellow)', padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}><style>{`@keyframes dotPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.7)}}`}</style><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--yellow)', animation: 'dotPulse 1s ease-in-out infinite' }} />Menunggu pembayaran...</div>}
              {qrisStatus === 'paid' && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--green-l)', color: 'var(--green)', padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}><CheckCircle size={14} /> Pembayaran berhasil!</div>}
              {qrisStatus === 'expired' && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--red-l)', color: 'var(--red)', padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>✕ QR kedaluwarsa</div>}
            </div>

            {/* Info: status terdeteksi otomatis — user tidak perlu klik apa-apa */}
            {qrisStatus !== 'paid' && qrisStatus !== 'expired' && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <RefreshCw size={12} style={{ animation: 'spin 2s linear infinite' }} />
                Status pembayaran terdeteksi otomatis setelah kamu bayar
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
              {/* Kembali jadi tombol utama */}
              <button onClick={() => setShowBackConfirm(true)} style={{ flex: 1, padding: '12px 0', borderRadius: 11, border: '1.5px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Kembali</button>
              {/* Cek manual jadi tombol sekunder kecil — cadangan saja */}
              <button onClick={checkQrisStatus} disabled={qrisChecking || qrisStatus === 'paid' || qrisStatus === 'expired'}
                title="Auto-cek sudah jalan. Tombol ini opsional untuk cek manual."
                style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontWeight: 600, fontSize: 12.5, cursor: (qrisChecking || qrisStatus === 'paid' || qrisStatus === 'expired') ? 'default' : 'pointer', fontFamily: "'Outfit',sans-serif", display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', opacity: (qrisStatus === 'paid' || qrisStatus === 'expired') ? 0.5 : 1 }}>
                {qrisChecking ? <><RefreshCw size={13} style={{ animation: 'spin .7s linear infinite' }} /> Mengecek</> : <><RefreshCw size={13} /> Cek manual</>}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', wordBreak: 'break-all' }}>Ref: {qrisData.reference_id}</div>
          </div>
          {/* INFO SIDEBAR */}
          <div className="qris-info-side" style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <div style={{ background: 'linear-gradient(135deg, var(--blue), #1D4ED8)', borderRadius: 18, padding: '22px 20px', color: '#fff' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', fontWeight: 600, marginBottom: 4 }}>SALDO SAAT INI</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{balanceIDR !== null ? formatIDR(balanceIDR) : '—'}</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', gap: 6 }}><ArrowRight size={13} />Setelah top up: <strong>{formatIDR((balanceIDR || 0) + qrisData.amount)}</strong></div>
            </div>
            <div className="card" style={{ padding: 16, background: 'var(--blue-l)', border: '1.5px solid var(--border2)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginBottom: 8 }}>Detail Pembayaran</div>
              {[{ l: 'Jumlah Top Up', v: formatIDR(qrisData.amount) }, { l: 'Biaya QRIS', v: `+${formatIDR(qrisData.totalAmount - qrisData.amount)}` }, { l: 'Total Bayar', v: formatIDR(qrisData.totalAmount) }].map(r => (
                <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}><span style={{ color: 'var(--text3)' }}>{r.l}</span><span style={{ fontWeight: 700, color: 'var(--text)' }}>{r.v}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: step === 3 ? 'block' : 'grid', gridTemplateColumns: 'min(420px, 100%) 1fr', gap: 24, alignItems: 'start' }} className="addfunds-grid">

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {step === 1 && (
            <>
              {/* Payment method */}
              <div className="card" style={{ padding: 22 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Metode Pembayaran</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                  {METHODS.map(m => (
                    <button key={m.id} onClick={() => !m.coming_soon && handleMethodChange(m.id)}
                      style={{ padding: '14px 16px', borderRadius: 14, border: `2px solid ${method === m.id ? m.color : 'var(--border)'}`, background: method === m.id ? m.bg : 'var(--bg2)', cursor: m.coming_soon ? 'not-allowed' : 'pointer', textAlign: 'left', transition: 'all .18s', position: 'relative', overflow: 'hidden', fontFamily: "'Outfit',sans-serif", opacity: m.coming_soon ? 0.6 : 1 }}>
                      {/* Coming Soon overlay */}
                      {m.coming_soon && (
                        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(247,147,26,.15)', color: '#F7931A', fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(247,147,26,.3)' }}>🕐 Akan Datang</div>
                      )}
                      {!m.coming_soon && m.badge && (
                        <div style={{ position: 'absolute', top: 8, right: 8, background: m.badgeBg, color: m.badgeColor, fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 20 }}>{m.badge}</div>
                      )}
                      <div style={{ color: method === m.id ? m.color : 'var(--text3)', marginBottom: 8 }}>{m.icon}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: method === m.id ? 'var(--text)' : 'var(--text2)', marginBottom: 2 }}>{m.label}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 8 }}>{m.desc}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--green)', background: 'var(--green-l)', padding: '2px 7px', borderRadius: 20 }}>{m.fee}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} />{m.time}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div className="card" style={{ padding: 22 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Jumlah Top Up (IDR)</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  {PRESETS_IDR.filter(p => p >= minAmount).map(p => (
                    <button key={p} onClick={() => setAmountIDR(String(p))}
                      style={{ padding: '8px 14px', borderRadius: 9, border: `1.5px solid ${amountIDR === String(p) ? 'var(--blue)' : 'var(--border)'}`, background: amountIDR === String(p) ? 'var(--blue)' : 'transparent', color: amountIDR === String(p) ? '#fff' : 'var(--text2)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", transition: 'all .18s' }}>
                      {formatIDR(p)}
                    </button>
                  ))}
                </div>
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--text3)', fontSize: 14 }}>Rp</span>
                  <input className="inp" type="text" style={{ paddingLeft: 42, fontSize: 18, fontWeight: 700 }}
                    value={numIDR ? numIDR.toLocaleString('id-ID') : ''}
                    onChange={handleAmountChange}
                    placeholder="0" />
                </div>

                {/* Info tier bonus — biar user tau "deposit segini dapet bonus segini" */}
                {(method === 'qris' || method === 'crypto') && bonusTiers.length > 0 && (
                  <div style={{ background: 'var(--green-l)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: 'var(--green)', marginBottom: 8 }}>
                      <Star size={13} /> Bonus Deposit Bertingkat
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[...bonusTiers].sort((a, b) => a.min - b.min).map((t, i) => {
                        const active = numIDR >= t.min &&
                          (i === bonusTiers.length - 1 || numIDR < [...bonusTiers].sort((a, b) => a.min - b.min)[i + 1].min);
                        return (
                          <div key={t.min} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: active ? 800 : 600, color: active ? 'var(--green)' : 'var(--text2)' }}>
                            <span>Deposit ≥ {formatIDR(t.min)}</span>
                            <span>+{t.percent}% bonus{active ? '  ✓' : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bonus deposit (tiered) */}
                {bonusIDR > 0 && (
                  <div style={{ marginBottom: 14, background: 'var(--green-l)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Star size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                      🎉 Bonus {bonusPercent}% — kamu dapat +{formatIDR(bonusIDR)} extra saldo!
                    </div>
                  </div>
                )}

                {numIDR > 0 && (
                  <div style={{ background: 'var(--bg2)', borderRadius: 11, padding: '14px 16px', marginBottom: 16 }}>
                    {[
                      { l: 'Jumlah Top Up', v: formatIDR(numIDR) },
                      ...(feeIDR > 0 ? [{ l: method === 'qris' ? 'Biaya QRIS (Rp 200 + 0.7%)' : 'Biaya Layanan (2.5%)', v: `+${formatIDR(Math.round(feeIDR))}`, c: 'var(--red)' }] : []),
                      ...(bonusIDR > 0 ? [{ l: `Bonus Deposit (${bonusPercent}%)`, v: `+${formatIDR(bonusIDR)}`, c: 'var(--green)' }] : []),
                      { l: 'Total Bayar', v: formatIDR(totalIDR), bold: true },
                      { l: 'Saldo yang Diterima', v: formatIDR(receiveIDR), bold: true, c: 'var(--blue)' },
                    ].map((r, i, arr) => (
                      <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: `${i > 0 ? 7 : 0}px 0 7px`, borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', fontSize: r.bold ? 14 : 13, fontWeight: r.bold ? 800 : 600, color: r.c || (r.bold ? 'var(--text)' : 'var(--text2)') }}>
                        <span>{r.l}</span><span>{r.v}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button className="btn btn-blue" onClick={() => setStep(2)}
                  disabled={!numIDR || (method === 'qris' && numIDR < 10000) || (method === 'crypto' && numIDR < 10000) || selectedMethod?.coming_soon}
                  style={{ width: '100%', padding: 13, borderRadius: 11, fontSize: 14.5, opacity: (!numIDR || (method === 'qris' && numIDR < 10000) || (method === 'crypto' && numIDR < 10000) || selectedMethod?.coming_soon) ? 0.5 : 1 }}>
                  Lanjut ke Pembayaran <ArrowRight size={16} />
                </button>
                {numIDR > 0 && numIDR < minAmount && (
                  <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--red)', marginTop: 8, fontWeight: 600 }}>
                    Minimum top up {method === 'qris' ? 'QRIS Rp 10.000' : method === 'manual' ? 'Transfer Manual Rp 5.000' : 'Rp 10.000'}
                  </p>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <div className="card" style={{ padding: 26 }}>
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 13, fontFamily: "'Outfit',sans-serif", fontWeight: 600, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
                ← Kembali
              </button>
              <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginBottom: 6 }}>Konfirmasi Pembayaran</div>
              <p style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 22, lineHeight: 1.6 }}>Periksa detail deposit kamu sebelum melanjutkan.</p>

              <div style={{ background: 'var(--bg2)', borderRadius: 14, padding: '18px 18px', marginBottom: 18 }}>
                {[
                  { l: 'Metode Pembayaran', v: selectedMethod?.label },
                  { l: 'Jumlah Top Up', v: formatIDR(numIDR) },
                  { l: 'Setara USD', v: `≈ $${numUSD.toFixed(4)}` },
                  ...(feeIDR > 0 ? [{ l: 'Biaya Layanan', v: `+${formatIDR(feeIDR)}`, c: 'var(--red)' }] : []),
                  ...(bonusIDR > 0 ? [{ l: `Bonus Deposit ${bonusPercent}%`, v: `+${formatIDR(bonusIDR)}`, c: 'var(--green)' }] : []),
                  { l: 'Total Bayar', v: formatIDR(totalIDR), bold: true },
                  { l: 'Saldo yang Diterima', v: formatIDR(receiveIDR), bold: true, c: 'var(--blue)' },
                ].map((r, i, arr) => (
                  <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', fontSize: r.bold ? 14 : 13, fontWeight: r.bold ? 800 : 600, color: r.c || (r.bold ? 'var(--text)' : 'var(--text2)') }}>
                    <span>{r.l}</span><span>{r.v}</span>
                  </div>
                ))}
              </div>

              {method === 'manual' && (
                <div style={{ background: 'rgba(37,211,102,.08)', border: '1.5px solid rgba(37,211,102,.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#25D366', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageCircle size={14} /> Cara Transfer Manual
                  </div>
                  <ol style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 2, margin: 0, paddingLeft: 18 }}>
                    <li>Klik tombol di bawah untuk chat admin via WhatsApp</li>
                    <li>Admin akan kirim nomor/QRIS tujuan transfer</li>
                    <li>Transfer sejumlah <strong style={{ color: 'var(--text)' }}>{formatIDR(numIDR)}</strong></li>
                    <li><strong style={{ color: 'var(--text)' }}>Kirim bukti transfer (screenshot)</strong> ke admin</li>
                    <li>Saldo ditambahkan setelah pembayaran diverifikasi admin</li>
                  </ol>
                </div>
              )}


              {qrisError && (
                <div style={{ background: 'var(--red-l)', border: '1.5px solid var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--red)', fontWeight: 600, marginBottom: 12 }}>
                  ⚠️ {qrisError}
                </div>
              )}
              <button className="btn btn-blue" onClick={handleConfirm} disabled={processing || numIDR < minAmount} style={{ width: '100%', padding: 13, borderRadius: 11, fontSize: 14.5, background: method === 'manual' ? '#25D366' : method === 'qris' ? '#E91E63' : 'var(--blue)', opacity: numIDR < minAmount ? 0.5 : 1 }}>
                {processing
                  ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', borderRadius: '50%' }} className="spin" /> Memproses...</>
                  : method === 'manual'
                    ? <><MessageCircle size={16} /> Konfirmasi via WhatsApp</>
                    : <><Zap size={16} /> Konfirmasi & Bayar {formatIDR(totalIDR)}</>}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ display: step === 3 ? 'none' : 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Balance */}
          <div className="addfunds-sidebar-balance" style={{ background: 'linear-gradient(135deg, var(--blue), #1D4ED8)', borderRadius: 18, padding: '22px 20px', color: '#fff' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', fontWeight: 600, marginBottom: 4, letterSpacing: '.06em' }}>SALDO SAAT INI</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
              {balanceIDR !== null ? formatIDR(balanceIDR) : '—'}
            </div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.5)', marginBottom: numIDR > 0 ? 8 : 0 }}>

            </div>
            {numIDR > 0 && (
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.8)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowRight size={13} />
                Setelah top up: <strong>{formatIDR((balanceIDR || 0) + receiveIDR)}</strong>
              </div>
            )}
          </div>

          {/* Crypto bonus */}
          <div style={{ background: 'linear-gradient(135deg, rgba(247,147,26,.12), rgba(247,147,26,.04))', border: '1.5px solid rgba(247,147,26,.25)', borderRadius: 16, padding: '18px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Bitcoin size={20} style={{ color: '#F7931A' }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#F7931A' }}>Bonus Crypto 5%</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 10 }}>
              Top up <strong>Rp 1.000.000+</strong> via crypto dan dapatkan bonus saldo <strong>5%</strong> instan!
            </p>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#F7931A', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={12} /> BTC, ETH, USDT, BNB diterima
            </div>
          </div>

          {/* Security */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)', marginBottom: 12 }}>Keamanan Pembayaran</div>
            {[
              { icon: <ShieldCheck size={15} />, c: 'var(--green)', t: 'SSL encrypted' },
              { icon: <Lock size={15} />, c: 'var(--blue)', t: 'PCI DSS compliant' },
              { icon: <CheckCircle size={15} />, c: 'var(--green)', t: 'Saldo update instan' },
              { icon: <Zap size={15} />, c: 'var(--yellow)', t: 'Support 24/7' },
            ].map(i => (
              <div key={i.t} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, fontSize: 12.5, color: 'var(--text2)', fontWeight: 600 }}>
                <span style={{ color: i.c }}>{i.icon}</span> {i.t}
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="card" style={{ padding: 16, background: 'var(--blue-l)', border: '1.5px solid var(--border2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginBottom: 8 }}>Info Deposit</div>
            {[
              { l: `Minimum top up ${method === 'qris' ? 'QRIS' : method === 'manual' ? 'Manual' : ''}`, v: method === 'qris' ? 'Rp 10.000' : 'Rp 5.000' },
              { l: 'Maksimum top up', v: 'Rp 100.000.000' },
            ].map(r => (
              <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                <span style={{ color: 'var(--text3)', fontWeight: 500 }}>{r.l}</span>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Modal konfirmasi Kembali */}
      {showBackConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 380, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>Batalkan Pembayaran?</div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20 }}>
              QR code masih aktif. Kalau kamu kembali, QR ini bisa dibuka lagi nanti selama belum expired. Yakin mau kembali?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowBackConfirm(false)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                Tetap di sini
              </button>
              <button onClick={async () => {
                // Tandai baris QR pending ini batal di Supabase agar tidak ter-restore lagi
                try {
                  const trx = qrisData?.trx_id;
                  if (trx) {
                    await supabase.from('transactions')
                      .update({ status: 'failed' })
                      .eq('qr_trx_id', trx)
                      .eq('status', 'pending_webhook');
                  }
                } catch { }
                setShowBackConfirm(false); setStep(1); setQrisData(null); setQrisStatus(null); setQrisError('');
              }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', background: 'var(--red)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                Ya, Kembali
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}