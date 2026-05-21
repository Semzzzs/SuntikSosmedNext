import { Users } from 'lucide-react';

export default function ViewReferral() {
  return (
    <div className="fu">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Affiliate Program</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Earn commission by referring new users.</p>
      </div>

      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--blue-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Users size={30} style={{ color: 'var(--blue)' }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Referral Program Coming Soon</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text2)', maxWidth: 380, margin: '0 auto 24px', lineHeight: 1.7 }}>
          The referral program is not available via smmsoc.com API. Contact smmsoc.com support to get your referral link directly from their dashboard.
        </p>
        <a href="https://smmsoc.com/account" target="_blank" rel="noreferrer" className="btn btn-blue" style={{ borderRadius: 10, padding: '11px 22px', textDecoration: 'none' }}>
          Go to smmsoc.com Account →
        </a>
      </div>
    </div>
  );
}