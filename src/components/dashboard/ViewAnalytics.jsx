import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, ShoppingCart, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const rp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

export default function ViewAnalytics({ user }) {
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    let alive = true;

    // ✅ Load transactions + order count dari Supabase (akurat & lintas device)
    supabase.from('transactions').select('*').eq('email', user.email)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.error('[Analytics] transactions:', error);
        setTransactions(Array.isArray(data) ? data : []);
        setLoaded(true);
      })
      .catch((e) => { if (alive) { console.error('[Analytics]', e); setLoaded(true); } });

    // ✅ Total Order dihitung dari transactions tipe order/purchase di Supabase,
    //    bukan dari localStorage (yang tidak ikut pindah device).
    supabase.from('transactions')
      .select('order_id, type, description')
      .eq('email', user.email)
      .in('type', ['order', 'purchase'])
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.error('[Analytics] orders:', error);
        const valid = (Array.isArray(data) ? data : []).filter(t =>
          (t?.order_id && /^\d+$/.test(String(t.order_id))) ||
          (t?.description && t.description.startsWith('Order #'))
        );
        setOrders(valid);
      })
      .catch((e) => { if (alive) console.error('[Analytics]', e); });

    return () => { alive = false; };
  }, [user]);

  const tx = Array.isArray(transactions) ? transactions : [];
  const totalDeposit = tx.filter(t => ['deposit', 'bonus', 'refund'].includes(t?.type) && t?.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
  const totalSpent = tx.filter(t => ['order', 'purchase'].includes(t?.type) && t?.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
  const balance = totalDeposit - totalSpent;

  // Chart data - transaksi per hari 7 hari terakhir
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const dateKey = d.toISOString().slice(0, 10);
    const dayTx = tx.filter(t => t?.created_at?.slice(0, 10) === dateKey);
    const deposit = dayTx.filter(t => ['deposit', 'bonus', 'refund'].includes(t?.type) && t?.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
    const spent = dayTx.filter(t => ['order', 'purchase'].includes(t?.type) && t?.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
    return { label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), deposit, spent };
  });

  const maxVal = Math.max(...last7.map(d => Math.max(d.deposit, d.spent)), 1);
  const periodDeposit = last7.reduce((s, d) => s + d.deposit, 0);
  const periodSpent = last7.reduce((s, d) => s + d.spent, 0);
  const hasData = tx.length > 0;

  const stats = [
    { label: 'Total Deposit', value: rp(totalDeposit), color: 'var(--green)', bg: 'var(--green-l)', icon: <CreditCard size={20} /> },
    { label: 'Total Pengeluaran', value: rp(totalSpent), color: 'var(--red)', bg: 'var(--red-l)', icon: <ShoppingCart size={20} /> },
    { label: 'Estimasi Saldo', value: rp(Math.max(0, balance)), color: 'var(--blue)', bg: 'var(--blue-l)', icon: <TrendingUp size={20} /> },
    { label: 'Total Order', value: orders.length, color: 'var(--yellow)', bg: 'var(--yellow-l)', icon: <BarChart2 size={20} /> },
  ];

  return (
    <div className="fu an-page">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Analytics</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Ringkasan aktivitas akun kamu.</p>
      </div>

      {/* Stat cards */}
      <div className="an-stats">
        {stats.map(s => (
          <div key={s.label} className="card an-stat" style={{ '--c': s.color }}>
            <div className="an-stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            <div className="an-stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="an-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="card" style={{ padding: 24 }}>
        <div className="an-chart-head">
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>Aktivitas 7 Hari Terakhir</div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Deposit vs Pengeluaran</div>
          </div>
          <div className="an-period">
            <div className="an-period-item">
              <span className="an-dot" style={{ background: 'var(--green)' }} />
              <div>
                <div className="an-period-num">{rp(periodDeposit)}</div>
                <div className="an-period-cap">Deposit</div>
              </div>
            </div>
            <div className="an-period-item">
              <span className="an-dot" style={{ background: 'var(--red)' }} />
              <div>
                <div className="an-period-num">{rp(periodSpent)}</div>
                <div className="an-period-cap">Pengeluaran</div>
              </div>
            </div>
          </div>
        </div>

        {!loaded ? (
          /* Loading skeleton */
          <div className="an-bars" aria-hidden>
            {[60, 35, 80, 50, 70, 40, 90].map((h, i) => (
              <div key={i} className="an-col">
                <div className="an-pair">
                  <div className="an-skel" style={{ height: `${h}%` }} />
                  <div className="an-skel" style={{ height: `${h * 0.6}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : hasData ? (
          <>
            <div className="an-plot">
              <div className="an-grid"><span /><span /><span /><span /></div>
              <div className="an-bars">
                {last7.map((d, i) => (
                  <div key={i} className="an-col" style={{ '--i': i }}>
                    <div className="an-tip">
                      <div className="an-tip-date">{d.label}</div>
                      <div className="an-tip-row"><span className="an-dot" style={{ background: 'var(--green)' }} />Deposit <b>{rp(d.deposit)}</b></div>
                      <div className="an-tip-row"><span className="an-dot" style={{ background: 'var(--red)' }} />Keluar <b>{rp(d.spent)}</b></div>
                    </div>
                    <div className="an-pair">
                      <div className="an-bar an-green" style={{ height: `${(d.deposit / maxVal) * 100}%`, minHeight: d.deposit > 0 ? 4 : 0 }} />
                      <div className="an-bar an-red" style={{ height: `${(d.spent / maxVal) * 100}%`, minHeight: d.spent > 0 ? 4 : 0 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="an-labels">
              {last7.map((d, i) => <span key={i}>{d.label}</span>)}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="an-empty">
            <div className="an-empty-icon"><BarChart2 size={26} /></div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Belum ada data</div>
            <p style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 320, margin: '0 auto' }}>Grafik akan muncul setelah kamu melakukan deposit atau order pertama.</p>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .an-page { max-width: 1200px; }

        /* Stat cards */
        .an-stats {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 14px; margin-bottom: 16px;
        }
        .an-stat {
          padding: 18px 20px; position: relative; overflow: hidden;
          transition: transform .22s cubic-bezier(.34,1.56,.64,1), box-shadow .22s ease;
        }
        .an-stat::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--c);
          opacity: .8;
        }
        .an-stat:hover { transform: translateY(-3px); box-shadow: 0 14px 30px color-mix(in srgb, var(--c) 16%, transparent); }
        .an-stat-icon {
          width: 42px; height: 42px; border-radius: 12px; margin-bottom: 12px;
          display: flex; align-items: center; justify-content: center;
        }
        .an-stat-value { font-size: 20px; font-weight: 800; margin-bottom: 3px; line-height: 1.2; word-break: break-word; }
        .an-stat-label { font-size: 12px; font-weight: 600; color: var(--text3); }

        /* Chart head + period summary */
        .an-chart-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; margin-bottom: 22px; }
        .an-period { display: flex; gap: 22px; }
        .an-period-item { display: flex; align-items: center; gap: 8px; }
        .an-period-num { font-size: 14px; font-weight: 800; color: var(--text); line-height: 1.2; }
        .an-period-cap { font-size: 11px; font-weight: 600; color: var(--text3); }
        .an-dot { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }

        /* Plot */
        .an-plot { position: relative; }
        .an-grid { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; }
        .an-grid > span { border-top: 1px dashed var(--border); }
        .an-bars { position: relative; display: flex; gap: 10px; align-items: flex-end; height: 180px; }
        .an-col { position: relative; flex: 1; height: 100%; display: flex; align-items: flex-end; justify-content: center; }
        .an-pair { width: 100%; max-width: 48px; height: 100%; display: flex; gap: 4px; align-items: flex-end; }
        .an-bar {
          flex: 1; border-radius: 5px 5px 0 0; transform-origin: bottom;
          animation: anGrow .6s cubic-bezier(.16,1,.3,1) backwards;
          animation-delay: calc(var(--i) * 55ms);
        }
        .an-green { background: linear-gradient(180deg, var(--green), color-mix(in srgb, var(--green) 60%, transparent)); }
        .an-red   { background: linear-gradient(180deg, var(--red),   color-mix(in srgb, var(--red) 60%, transparent)); }
        .an-col:hover .an-bar { filter: brightness(1.08); }
        @keyframes anGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }

        .an-labels { display: flex; gap: 10px; margin-top: 8px; }
        .an-labels > span { flex: 1; text-align: center; font-size: 10.5px; color: var(--text3); white-space: nowrap; }

        /* Hover tooltip */
        .an-tip {
          position: absolute; top: 0; left: 50%; transform: translateX(-50%) translateY(-6px);
          background: var(--text); color: var(--white, #fff); border-radius: 10px; padding: 9px 11px;
          font-size: 11.5px; white-space: nowrap; opacity: 0; pointer-events: none; z-index: 6;
          box-shadow: 0 8px 24px rgba(0,0,0,.22); transition: opacity .15s ease, transform .15s ease;
        }
        .an-col:hover .an-tip { opacity: 1; transform: translateX(-50%) translateY(0); }
        .an-tip-date { font-weight: 800; margin-bottom: 5px; opacity: .85; }
        .an-tip-row { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
        .an-tip-row b { margin-left: auto; padding-left: 12px; }

        /* Skeleton */
        .an-skel { flex: 1; border-radius: 5px 5px 0 0; background: var(--bg2); animation: anPulse 1.4s ease-in-out infinite; }
        @keyframes anPulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }

        /* Empty */
        .an-empty { padding: 30px 16px; text-align: center; color: var(--text3); }
        .an-empty-icon { width: 56px; height: 56px; border-radius: 16px; margin: 0 auto 14px; display: flex; align-items: center; justify-content: center; background: var(--bg2); color: var(--text3); }

        @media (prefers-reduced-motion: reduce) {
          .an-stat, .an-bar, .an-tip, .an-skel { transition: none; animation: none; }
          .an-stat:hover { transform: none; }
        }
        `
      }} />
    </div>
  );
}