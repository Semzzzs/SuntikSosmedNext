import { useState, useEffect } from 'react';
import { ArrowLeftRight, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ViewTransactions({ user }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.email) return;
    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('email', user.email)
      .order('created_at', { ascending: false });
    setTransactions(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const TYPE_CONFIG = {
    deposit: { label: 'Deposit', icon: <ArrowDownLeft size={16} />, color: 'var(--green)', bg: 'var(--green-l)', sign: '+' },
    order: { label: 'Order', icon: <ArrowUpRight size={16} />, color: 'var(--red)', bg: 'var(--red-l)', sign: '-' },
    refund: { label: 'Refund', icon: <ArrowDownLeft size={16} />, color: 'var(--blue)', bg: 'var(--blue-l)', sign: '+' },
    bonus: { label: 'Bonus', icon: <ArrowDownLeft size={16} />, color: 'var(--yellow)', bg: 'var(--yellow-l)', sign: '+' },
  };

  const totalDeposit = transactions.filter(t => ['deposit', 'bonus', 'refund'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const totalOrder = transactions.filter(t => t.type === 'order').reduce((s, t) => s + (t.amount || 0), 0);


  const STATUS_CONFIG_TRX = {
    success: { label: 'Sukses', color: 'var(--green)', bg: 'var(--green-l)' },
    pending_webhook: { label: 'Pending', color: 'var(--yellow)', bg: 'var(--yellow-l)' },
    pending: { label: 'Pending', color: 'var(--yellow)', bg: 'var(--yellow-l)' },
    failed: { label: 'Gagal', color: 'var(--red)', bg: 'var(--red-l)' },
  };
  const getTrxStatus = (s) => STATUS_CONFIG_TRX[s] || STATUS_CONFIG_TRX.success;

  return (
    <div className="fu">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Riwayat Transaksi</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Semua mutasi saldo akun kamu.</p>
      </div>

      <div className="trx-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Deposit', value: `Rp ${totalDeposit.toLocaleString('id-ID')}`, color: 'var(--green)', bg: 'var(--green-l)', icon: <ArrowDownLeft size={20} />, fullWidth: true },
          { label: 'Total Pengeluaran', value: `Rp ${totalOrder.toLocaleString('id-ID')}`, color: 'var(--red)', bg: 'var(--red-l)', icon: <ArrowUpRight size={20} /> },
          { label: 'Total Transaksi', value: transactions.length, color: 'var(--blue)', bg: 'var(--blue-l)', icon: <ArrowLeftRight size={20} /> },
        ].map(s => (
          <div key={s.label} className="card" data-stat-full={s.fullWidth ? '1' : '0'} style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <span style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: '50%', display: 'inline-block' }} className="spin" />
          <p style={{ marginTop: 14, color: 'var(--text3)', fontSize: 13 }}>Memuat transaksi...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="card" style={{ padding: 56, textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--blue-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ArrowLeftRight size={28} style={{ color: 'var(--blue)' }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>Belum ada transaksi</div>
          <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Transaksi akan muncul setelah kamu deposit atau melakukan order.</p>
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="card trx-table-wrap" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                  {['Tanggal', 'Tipe', 'Keterangan', 'Jumlah', 'Status'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => {
                  const cfg = TYPE_CONFIG[t.type] || TYPE_CONFIG.deposit;
                  return (
                    <tr key={t.id || i} style={{ borderBottom: i < transactions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--text3)', fontSize: 12 }}>
                        {new Date(t.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '4px 10px', borderRadius: 20 }}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || '-'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: cfg.color, fontFamily: "'JetBrains Mono', monospace" }}>
                        {cfg.sign}Rp {(t.amount || 0).toLocaleString('id-ID')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {/* ✅ Fix Medium: render status dari data, bukan hardcoded "Sukses" */}
                        {(() => {
                          const st = getTrxStatus(t.status); return (
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: st.color, background: st.bg, padding: '3px 9px', borderRadius: 20 }}>{st.label}</span>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <div className="trx-card-list" style={{ display: 'none', flexDirection: 'column', gap: 10 }}>
            {transactions.map((t, i) => {
              const cfg = TYPE_CONFIG[t.type] || TYPE_CONFIG.deposit;
              return (
                <div key={t.id || i} className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '4px 10px', borderRadius: 20 }}>
                      {cfg.icon} {cfg.label}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 14, color: cfg.color, fontFamily: "'JetBrains Mono', monospace" }}>
                      {cfg.sign}Rp {(t.amount || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.description || '-'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                      {new Date(t.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {/* ✅ Fix Medium: render status dari data di mobile card */}
                    {(() => {
                      const st = getTrxStatus(t.status); return (
                        <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: '2px 8px', borderRadius: 20 }}>{st.label}</span>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}