import { useState, useEffect } from 'react';
import { Instagram, Youtube, Twitter, Facebook, Play } from 'lucide-react';

export default function ViewServices() {
  const [active, setActive] = useState('All');
  const [rate, setRate] = useState(17687);

  useEffect(() => {
    fetch('/api/rate')
      .then(r => r.json())
      .then(d => { if (d.rate) setRate(d.rate); })
      .catch(() => { });
  }, []);

  const cats = ['All', 'Instagram', 'TikTok', 'YouTube', 'Twitter', 'Facebook'];
  const svcs = [
    { id: 197, cat: 'Instagram', name: 'Followers – High Quality', priceUSD: 0.80, min: '10', max: '10K', ic: <Instagram size={22} style={{ color: '#E1306C' }} /> },
    { id: 198, cat: 'Instagram', name: 'Likes – Real Users', priceUSD: 0.30, min: '10', max: '50K', ic: <Instagram size={22} style={{ color: '#E1306C' }} /> },
    { id: 302, cat: 'TikTok', name: 'Views – Ultra Fast', priceUSD: 0.05, min: '100', max: '1M', ic: <Play size={22} fill="currentColor" /> },
    { id: 303, cat: 'TikTok', name: 'Followers – Real', priceUSD: 1.20, min: '50', max: '50K', ic: <Play size={22} fill="currentColor" /> },
    { id: 415, cat: 'YouTube', name: 'Subscribers – Real', priceUSD: 15.50, min: '50', max: '5K', ic: <Youtube size={22} style={{ color: '#FF0000' }} /> },
    { id: 416, cat: 'YouTube', name: 'Views – High Retention', priceUSD: 1.50, min: '500', max: '500K', ic: <Youtube size={22} style={{ color: '#FF0000' }} /> },
    { id: 550, cat: 'Twitter', name: 'Retweets – Non Drop', priceUSD: 1.20, min: '20', max: '20K', ic: <Twitter size={22} style={{ color: '#1DA1F2' }} /> },
    { id: 700, cat: 'Facebook', name: 'Page Likes – Real', priceUSD: 0.95, min: '50', max: '50K', ic: <Facebook size={22} style={{ color: '#1877F2' }} /> },
  ];

  const toIDR = (usd) => Math.round(usd * rate).toLocaleString('id-ID');

  const shown = active === 'All' ? svcs : svcs.filter(s => s.cat === active);

  return (
    <div className="fu">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Service List</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Semua layanan tersedia dengan harga terbaik.</p>
      </div>
      <div style={{ display: 'flex', gap: 7, marginBottom: 18, flexWrap: 'wrap' }}>
        {cats.map(c => (
          <button key={c} onClick={() => setActive(c)}
            style={{ padding: '5px 13px', borderRadius: 20, border: `1.5px solid ${active === c ? 'var(--blue)' : 'var(--border)'}`, background: active === c ? 'var(--blue-l)' : 'transparent', color: active === c ? 'var(--blue)' : 'var(--text2)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            {c}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px,1fr))', gap: 16 }}>
        {shown.map(s => (
          <div key={s.id} className="card" style={{ padding: 20, transition: 'transform .2s, box-shadow .2s', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow2)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.ic}</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg2)', padding: '3px 8px', borderRadius: 6 }}>ID: {s.id}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{s.cat}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>{s.name}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue)', marginBottom: 12 }}>
              Rp {toIDR(s.priceUSD)}
              <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}> / 1K</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 12, color: 'var(--text3)' }}>
              <span>Min {s.min} – Max {s.max}</span>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', fontWeight: 700, fontSize: 12, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Detail</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}