import { useState, useEffect } from 'react';
import { CreditCard, Bitcoin, Wallet, Building2, ArrowRight, ShieldCheck, Lock, CheckCircle, Zap, Clock, Star, AlertCircle, RefreshCw } from 'lucide-react';
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

const formatIDR = (num) => {
  if (!num) return 'Rp 0';
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
};

export default function ViewAddFunds({ user, balance: balanceProp = null }) {
  const { apiUrl, apiKey } = useApi();
  const [method, setMethod] = useState('qris');
  const [amountIDR, setAmountIDR] = useState('');
  const [balanceIDRUser, setBalanceIDRUser] = useState(balanceProp);
  const [rate, setRate] = useState(null);
  const [rateUpdated, setRateUpdated] = useState(null);
  const [rateSource, setRateSource] = useState(null);
  const [loadingRate, setLoadingRate] = useState(true);
  const [step, setStep] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [qrisData, setQrisData] = useState(null);   // { qr_url, trx_id, amount, expiry }
  const [qrisChecking, setQrisChecking] = useState(false);
  const [qrisStatus, setQrisStatus] = useState(null); // 'paid'|'expired'|'pending'
  const [qrisError, setQrisError] = useState('');

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

  // Sync balance dari prop (dihitung di dashboard.jsx dari user_transactions)
  useEffect(() => {
    if (balanceProp !== null) setBalanceIDRUser(balanceProp);
  }, [balanceProp]);

  const numIDR = parseFloat(String(amountIDR).replace(/\./g, '').replace(',', '.')) || 0;
  const numUSD = rate ? numIDR / rate : 0;
  const balanceIDR = balanceIDRUser;
  const feeIDR = method === 'qris' ? (200 + numIDR * 0.007) : method === 'card' ? numIDR * 0.025 : 0;
  const bonusIDR = method === 'crypto' && numIDR >= 1000000 ? numIDR * 0.05 : 0;
  const totalIDR = numIDR + feeIDR;
  const receiveIDR = numIDR + bonusIDR;
  const selectedMethod = METHODS.find(m => m.id === method);

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setAmountIDR(raw);
  };

  const handleConfirm = async () => {
    // QRIS via Paymenku
    if (method === 'qris') {
      setProcessing(true);
      setQrisError('');
      try {
        // ✅ Fix Critical: ambil session dari Supabase Auth, bukan sessionStorage
        // customer_email di server akan di-override dengan user.email dari session JWT
        // (sudah diimplementasikan di /api/payment) — ini hanya untuk reference_id
        const { data: { session: paySession } } = await supabase.auth.getSession();
        const refId = `${paySession?.user?.id?.slice(0, 8) || 'USR'}-${Date.now()}`;
        const resp = await fetch('/api/payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${paySession?.access_token || ''}`,
          },
          body: JSON.stringify({
            action: 'create_qris',
            reference_id: refId,
            amount: Math.round(totalIDR),
          }),
        });
        const data = await resp.json();
        if (data.status === 'success' && data.data) {
          setQrisData({
            qr_url: data.data.payment_info?.qr_url,
            qr_string: data.data.payment_info?.qr_string,
            trx_id: data.data.trx_id,
            reference_id: refId,
            amount: numIDR,        // saldo diterima user
            totalAmount: Math.round(totalIDR), // total yang dibayar (inc. fee)
            expiry: data.data.payment_info?.expiration_date,
          });
          setQrisStatus('pending');
          setStep(3); // QR display step
        } else {
          setQrisError(data.message || 'Gagal membuat transaksi QRIS. Coba lagi.');
        }
      } catch (e) {
        setQrisError('Koneksi gagal: ' + e.message);
      }
      setProcessing(false);
      return;
    }
    // Other methods — placeholder
    setProcessing(true);
    setTimeout(() => { setProcessing(false); setDone(true); }, 1800);
  };

  // Poll QRIS payment status
  const checkQrisStatus = async () => {
    if (!qrisData?.trx_id) return;
    setQrisChecking(true);
    try {
      const resp = await fetch(`/api/payment?action=check_status&order_id=${qrisData.trx_id}`);
      const data = await resp.json();
      const status = data.data?.status || data.status;
      setQrisStatus(status);
      if (status === 'paid') {
        // ✅ Fix Critical: TIDAK insert deposit dari client.
        // Saldo dikreditkan exclusively oleh webhook server-side (/api/webhook/paymenku).
        // Client hanya update UI — tidak boleh menulis ke database payment.
        setDone(true);
      }
    } catch { }
    setQrisChecking(false);
  };

  // Auto-poll setiap 5 detik saat QR ditampilkan
  useEffect(() => {
    if (step !== 3 || !qrisData || qrisStatus === 'paid' || qrisStatus === 'expired') return;
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`/api/payment?action=check_status&order_id=${qrisData.trx_id}`);
        const data = await resp.json();
        const status = data.data?.status || data.status;
        if (status === 'paid') {
          setQrisStatus('paid');
          clearInterval(interval);
          // Tambah ke user_transactions
          // ✅ Transaksi sudah dicatat oleh webhook di Supabase
          // Tidak perlu simpan ke localStorage
          setTimeout(() => setDone(true), 1500);
        } else if (status === 'expired' || status === 'cancelled') {
          setQrisStatus(status);
          clearInterval(interval);
        }
      } catch { }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, qrisData, qrisStatus]);

  if (done) {
    return (
      <div className="fu" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div className="card" style={{ padding: '48px 40px', textAlign: 'center', maxWidth: 420 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green-l)', border: '2px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={36} style={{ color: 'var(--green)' }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Permintaan Pembayaran Terkirim!</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 24 }}>
            Deposit <strong>{formatIDR(numIDR)}</strong> via <strong>{selectedMethod?.label}</strong> sedang diproses. Saldo akan terupdate otomatis.
          </p>
          <button className="btn btn-blue" onClick={() => { setDone(false); setStep(1); setAmountIDR(''); }} style={{ width: '100%', borderRadius: 11, padding: 12 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'min(320px, 100%) 1fr', gap: 20, alignItems: 'start' }} className="addfunds-grid">

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {step === 1 && (
            <>
              {/* Payment method */}
              <div className="card" style={{ padding: 22 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Metode Pembayaran</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                  {METHODS.map(m => (
                    <button key={m.id} onClick={() => !m.coming_soon && setMethod(m.id)}
                      style={{ padding: '14px 16px', borderRadius: 14, border: `2px solid ${method === m.id ? m.color : 'var(--border)'}`, background: method === m.id ? m.bg : 'var(--bg2)', cursor: m.coming_soon ? 'not-allowed' : 'pointer', textAlign: 'left', transition: 'all .18s', position: 'relative', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans',sans-serif", opacity: m.coming_soon ? 0.6 : 1 }}>
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
                  {PRESETS_IDR.map(p => (
                    <button key={p} onClick={() => setAmountIDR(String(p))}
                      style={{ padding: '8px 14px', borderRadius: 9, border: `1.5px solid ${amountIDR === String(p) ? 'var(--blue)' : 'var(--border)'}`, background: amountIDR === String(p) ? 'var(--blue)' : 'transparent', color: amountIDR === String(p) ? '#fff' : 'var(--text2)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'all .18s' }}>
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
                {numIDR > 0 && rate && (
                  <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 14 }}>
                  </div>
                )}

                {/* Crypto bonus */}
                {method === 'crypto' && numIDR >= 1000000 && (
                  <div style={{ marginBottom: 14, background: 'rgba(247,147,26,.08)', border: '1px solid rgba(247,147,26,.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Star size={15} style={{ color: '#F7931A', flexShrink: 0 }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F7931A' }}>
                      🎉 Bonus 5% Crypto — kamu dapat +{formatIDR(bonusIDR)} extra!
                    </div>
                  </div>
                )}

                {numIDR > 0 && (
                  <div style={{ background: 'var(--bg2)', borderRadius: 11, padding: '14px 16px', marginBottom: 16 }}>
                    {[
                      { l: 'Jumlah Top Up', v: formatIDR(numIDR) },
                      ...(feeIDR > 0 ? [{ l: method === 'qris' ? 'Biaya QRIS (Rp 200 + 0.7%)' : 'Biaya Layanan (2.5%)', v: `+${formatIDR(Math.round(feeIDR))}`, c: 'var(--red)' }] : []),
                      ...(bonusIDR > 0 ? [{ l: 'Bonus Crypto (5%)', v: `+${formatIDR(bonusIDR)}`, c: 'var(--green)' }] : []),
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
                  disabled={!numIDR || (method === 'qris' && numIDR < 5000) || (method === 'crypto' && numIDR < 10000) || selectedMethod?.coming_soon}
                  style={{ width: '100%', padding: 13, borderRadius: 11, fontSize: 14.5, opacity: (!numIDR || (method === 'qris' && numIDR < 5000) || (method === 'crypto' && numIDR < 10000) || selectedMethod?.coming_soon) ? 0.5 : 1 }}>
                  Lanjut ke Pembayaran <ArrowRight size={16} />
                </button>
                {numIDR > 0 && method === 'qris' && numIDR < 5000 && (
                  <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--red)', marginTop: 8, fontWeight: 600 }}>Minimum top up QRIS Rp 5.000</p>
                )}
                {numIDR > 0 && method === 'crypto' && numIDR < 10000 && (
                  <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--red)', marginTop: 8, fontWeight: 600 }}>Minimum top up Crypto Rp 10.000</p>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <div className="card" style={{ padding: 26 }}>
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 13, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
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
                  ...(bonusIDR > 0 ? [{ l: 'Bonus Crypto 5%', v: `+${formatIDR(bonusIDR)}`, c: 'var(--green)' }] : []),
                  { l: 'Total Bayar', v: formatIDR(totalIDR), bold: true },
                  { l: 'Saldo yang Diterima', v: formatIDR(receiveIDR), bold: true, c: 'var(--blue)' },
                ].map((r, i, arr) => (
                  <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', fontSize: r.bold ? 14 : 13, fontWeight: r.bold ? 800 : 600, color: r.c || (r.bold ? 'var(--text)' : 'var(--text2)') }}>
                    <span>{r.l}</span><span>{r.v}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: 'var(--yellow-l)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: 'var(--yellow)', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertCircle size={13} style={{ flexShrink: 0 }} />
                Payment gateway sedang dalam integrasi. Ini adalah preview alur pembayaran.
              </div>

              {qrisError && (
                <div style={{ background: 'var(--red-l)', border: '1.5px solid var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--red)', fontWeight: 600, marginBottom: 12 }}>
                  ⚠️ {qrisError}
                </div>
              )}
              <button className="btn btn-blue" onClick={handleConfirm} disabled={processing} style={{ width: '100%', padding: 13, borderRadius: 11, fontSize: 14.5, background: method === 'qris' ? '#E91E63' : 'var(--blue)' }}>
                {processing
                  ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', borderRadius: '50%' }} className="spin" /> Memproses...</>
                  : <><Zap size={16} /> Konfirmasi & Bayar {formatIDR(totalIDR)}</>}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

          {/* Step 3: QRIS QR Display */}
          {step === 3 && qrisData && (
            <div className="card" style={{ padding: 28, textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginBottom: 4 }}>Scan QR Code</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
                Bayar <strong style={{ color: '#E91E63' }}>Rp {(qrisData.totalAmount || Math.round(qrisData.amount)).toLocaleString('id-ID')}</strong> via QRIS
                {qrisData.totalAmount && qrisData.totalAmount !== qrisData.amount && (
                  <span style={{ fontSize: 11.5, display: 'block', marginTop: 3 }}>
                    (Saldo diterima: Rp {Math.round(qrisData.amount).toLocaleString('id-ID')})
                  </span>
                )}
                {qrisData.expiry && <span> · Berlaku s/d {new Date(qrisData.expiry).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>

              <div style={{ display: 'inline-block', padding: 16, background: '#fff', borderRadius: 16, border: '2px solid var(--border)', marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
                {qrisData.qr_url ? (
                  <img src={qrisData.qr_url} alt="QRIS" style={{ width: 220, height: 220, display: 'block', borderRadius: 8 }} />
                ) : (
                  <div style={{ width: 220, height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg2)', borderRadius: 10 }}>
                    <div style={{ fontSize: 56 }}>▦</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, textAlign: 'center', lineHeight: 1.5 }}>
                      QR tersedia di dashboard Paymenku<br />
                      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>ID: {qrisData.trx_id}</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 18 }}>
                {qrisStatus === 'pending' && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--yellow-l)', color: 'var(--yellow)', padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--yellow)' }} />
                    Menunggu pembayaran...
                  </div>
                )}
                {qrisStatus === 'paid' && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--green-l)', color: 'var(--green)', padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                    <CheckCircle size={14} /> Pembayaran berhasil!
                  </div>
                )}
                {qrisStatus === 'expired' && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--red-l)', color: 'var(--red)', padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                    ✕ QR kedaluwarsa
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <button onClick={() => { setStep(2); setQrisData(null); setQrisStatus(null); setQrisError(''); }}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 11, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                  Kembali
                </button>
                <button onClick={checkQrisStatus} disabled={qrisChecking || qrisStatus === 'paid' || qrisStatus === 'expired'}
                  style={{ flex: 2, padding: '11px 0', borderRadius: 11, border: 'none', background: '#E91E63', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: qrisStatus === 'paid' || qrisStatus === 'expired' ? 0.5 : 1 }}>
                  {qrisChecking
                    ? <><RefreshCw size={14} style={{ animation: 'spin .7s linear infinite' }} /> Mengecek...</>
                    : <><RefreshCw size={14} /> Cek Status Bayar</>}
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                Ref: {qrisData.reference_id} · Setelah bayar klik tombol cek di atas
              </div>
            </div>
          )}

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
              { l: 'Minimum top up QRIS', v: 'Rp 5.000' },
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
    </div>
  );
}