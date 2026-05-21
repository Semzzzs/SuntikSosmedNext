import { useState } from 'react';
import { Key, CheckCircle, Copy, AlertCircle } from 'lucide-react';

export default function ViewAPI() {
  const [copied, setCopied] = useState(false);
  const apiKey = 'smm_live_8f7d6e5c4b3a2f1e9d0c';
  return (
    <div className="fu">
      <div style={{ marginBottom: 18 }}><h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Developer API</h1><p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Integrate SuntikSosmed into your app with our REST API.</p></div>
      <div className="card" style={{ padding: 22, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}><Key size={15} style={{ color: 'var(--blue)' }} /> Your API Key</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="inp mono" type="password" readOnly value={apiKey} style={{ flex: 1, fontSize: 13 }} />
          <button className="btn btn-blue" style={{ borderRadius: 10, padding: '0 18px', flexShrink: 0 }} onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            {copied ? <CheckCircle size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div style={{ background: 'var(--red-l)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 9, padding: '9px 13px', marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertCircle size={13} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>Keep your API key private. Never share it publicly or commit to version control.</span>
        </div>
      </div>
      <div style={{ background: '#0F172A', borderRadius: 16, padding: '20px 22px', overflow: 'auto' }} className="ns">
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F56' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FFBD2E' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#27C93F' }} />
          <span style={{ fontSize: 11, color: '#6E7681', marginLeft: 8, fontFamily: "'JetBrains Mono',monospace" }}>Example — Add Order</span>
        </div>
        <pre style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: '#E6EDF3', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>{`fetch("https://suntikSosmed.com/api/v2", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    key: "YOUR_API_KEY",
    action: "add",
    service: 197,
    link: "https://instagram.com/p/...",
    quantity: 1000
  })
})`}</pre>
      </div>
    </div>
  );
}
