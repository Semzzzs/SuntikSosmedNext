import { MessageCircle, Send, ExternalLink, Radio } from 'lucide-react';

const CONTACTS = [
    {
        id: 'wa',
        label: 'WhatsApp',
        desc: 'Chat langsung dengan admin',
        icon: <MessageCircle size={26} />,
        color: '#25D366',
        bg: 'rgba(37,211,102,.08)',
        border: 'rgba(37,211,102,.25)',
        link: 'https://wa.me/YOUR_NUMBER',
        btnLabel: 'Chat WhatsApp',
    },
    {
        id: 'tg',
        label: 'Telegram',
        desc: 'Chat langsung via Telegram',
        icon: <Send size={26} />,
        color: '#229ED9',
        bg: 'rgba(34,158,217,.08)',
        border: 'rgba(34,158,217,.25)',
        link: 'https://t.me/YOUR_USERNAME',
        btnLabel: 'Chat Telegram',
    },
    {
        id: 'wa-channel',
        label: 'Channel WhatsApp',
        desc: 'Follow untuk update & promo',
        icon: <Radio size={26} />,
        color: '#25D366',
        bg: 'rgba(37,211,102,.06)',
        border: 'rgba(37,211,102,.2)',
        link: 'https://whatsapp.com/channel/YOUR_CHANNEL',
        btnLabel: 'Join Channel',
    },
    {
        id: 'tg-channel',
        label: 'Channel Telegram',
        desc: 'Follow untuk update & promo',
        icon: <Radio size={26} />,
        color: '#229ED9',
        bg: 'rgba(34,158,217,.06)',
        border: 'rgba(34,158,217,.2)',
        link: 'https://t.me/YOUR_CHANNEL',
        btnLabel: 'Join Channel',
    },
];

export default function ViewContact() {
    return (
        <div className="fu">
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Hubungi Kami</h1>
                <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Butuh bantuan? Hubungi kami melalui salah satu platform berikut.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                {CONTACTS.map(c => (
                    <div key={c.id} className="card" style={{ padding: 24, border: `1.5px solid ${c.border}`, background: c.bg }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: `${c.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, marginBottom: 14 }}>{c.icon}</div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 5 }}>{c.label}</div>
                        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.6 }}>{c.desc}</div>
                        <a href={c.link} target="_blank" rel="noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, background: c.color, color: '#fff', fontWeight: 700, fontSize: 13.5, textDecoration: 'none', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                            {c.btnLabel} <ExternalLink size={13} />
                        </a>
                    </div>
                ))}
            </div>

            <div className="card" style={{ marginTop: 16, padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--blue-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MessageCircle size={22} style={{ color: 'var(--blue)' }} />
                </div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 3 }}>Atau buka Support Ticket</div>
                    <div style={{ fontSize: 13, color: 'var(--text3)' }}>Untuk masalah teknis, kamu juga bisa mengajukan tiket dukungan.</div>
                </div>
            </div>
        </div>
    );
}