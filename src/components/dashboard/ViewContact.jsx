import { useRouter } from 'next/router';
import { MessageCircle, Send, ExternalLink, Radio, LifeBuoy, ArrowRight } from 'lucide-react';

const CHAT_CHANNELS = [
    {
        id: 'wa',
        label: 'WhatsApp',
        desc: 'Chat langsung dengan admin kami.',
        icon: <MessageCircle size={24} />,
        color: '#25D366',
        link: 'https://wa.me/6283843306230',
        btnLabel: 'Chat WhatsApp',
        tag: 'Respon cepat',
    },
    {
        id: 'tg',
        label: 'Telegram',
        desc: 'Chat langsung lewat Telegram.',
        icon: <Send size={24} />,
        color: '#229ED9',
        link: 'https://t.me/specterzsz',
        btnLabel: 'Chat Telegram',
        tag: 'Respon cepat',
    },
];

const FOLLOW_CHANNELS = [
    {
        id: 'wa-channel',
        label: 'Channel WhatsApp',
        desc: 'Update layanan & promo terbaru.',
        icon: <Radio size={24} />,
        color: '#25D366',
        link: 'https://whatsapp.com/channel/YOUR_CHANNEL',
        btnLabel: 'Join Channel',
    },
    {
        id: 'tg-channel',
        label: 'Channel Telegram',
        desc: 'Update layanan & promo terbaru.',
        icon: <Radio size={24} />,
        color: '#229ED9',
        link: 'https://t.me/YOUR_CHANNEL',
        btnLabel: 'Join Channel',
    },
];

function ContactCard({ c }) {
    return (
        <a
            href={c.link}
            target="_blank"
            rel="noreferrer"
            className="card contact-card"
            style={{ '--c': c.color, padding: 22 }}
        >
            <span className="cc-glow" aria-hidden />
            <div className="cc-top">
                <div className="cc-icon">{c.icon}</div>
                {c.tag && (
                    <span className="cc-tag">
                        <span className="cc-dot" aria-hidden />
                        {c.tag}
                    </span>
                )}
            </div>
            <div className="cc-label">{c.label}</div>
            <div className="cc-desc">{c.desc}</div>
            <span className="cc-btn">
                {c.btnLabel} <ExternalLink size={13} />
            </span>
        </a>
    );
}

export default function ViewContact({ onOpenTicket, ticketHref }) {
    const router = useRouter();
    const handleTicket = () => {
        // 1) Kalau parent kasih handler sendiri, pakai itu.
        if (onOpenTicket) return onOpenTicket();
        // 2) Kalau Tickets adalah halaman/route terpisah, pakai href-nya.
        if (ticketHref) return router.push(ticketHref);
        // 3) Default: dashboard pakai tab switcher (URL tetap /dashboard).
        //    Tekan tombol "Tickets" yang sudah ada di navigasi.
        const tabs = Array.from(document.querySelectorAll('button, a, [role="button"]'))
            .filter(el => el.offsetParent &&
                el.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === 'tickets');
        if (tabs.length) {
            // Pilih yang paling bawah (navigasi bawah), bukan breadcrumb.
            tabs.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
            tabs[0].click();
        }
    };

    return (
        <div className="fu contact-page">
            <div style={{ marginBottom: 26 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Hubungi Kami</h1>
                <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Butuh bantuan? Pilih kanal yang paling cepat buat kamu.</p>
            </div>

            <div className="contact-group-label">Chat langsung dengan tim</div>
            <div className="contact-grid">
                {CHAT_CHANNELS.map(c => <ContactCard key={c.id} c={c} />)}
            </div>

            <div className="contact-group-label" style={{ marginTop: 26 }}>Ikuti kanal resmi</div>
            <div className="contact-grid">
                {FOLLOW_CHANNELS.map(c => <ContactCard key={c.id} c={c} />)}
            </div>

            <button type="button" className="card ticket-cta" onClick={handleTicket}>
                <div className="ticket-icon">
                    <LifeBuoy size={22} />
                </div>
                <div className="ticket-text">
                    <div className="ticket-title">Punya masalah teknis?</div>
                    <div className="ticket-desc">Buka tiket dukungan — tim kami akan menindaklanjuti pesananmu.</div>
                </div>
                <ArrowRight className="ticket-arrow" size={18} />
            </button>

            <style dangerouslySetInnerHTML={{
                __html: `
                .contact-page { max-width: 920px; }

                .contact-group-label {
                    font-size: 12px; font-weight: 700; letter-spacing: .04em;
                    text-transform: uppercase; color: var(--text3); margin-bottom: 12px;
                }

                .contact-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 14px;
                }

                /* ── Contact card ── */
                .contact-card {
                    position: relative; overflow: hidden; isolation: isolate;
                    display: block; text-decoration: none;
                    border: 1.5px solid color-mix(in srgb, var(--c) 28%, transparent);
                    background: color-mix(in srgb, var(--c) 7%, var(--white));
                    transition: transform .25s cubic-bezier(.34,1.56,.64,1),
                                box-shadow .25s ease, border-color .25s ease;
                }
                .contact-card:hover {
                    transform: translateY(-4px);
                    border-color: color-mix(in srgb, var(--c) 55%, transparent);
                    box-shadow: 0 16px 36px color-mix(in srgb, var(--c) 20%, transparent);
                }
                .contact-card:focus-visible {
                    outline: 2px solid var(--c); outline-offset: 3px;
                }
                .cc-glow {
                    position: absolute; top: -45px; right: -45px; width: 130px; height: 130px;
                    border-radius: 50%; z-index: 0; pointer-events: none;
                    background: radial-gradient(circle, color-mix(in srgb, var(--c) 26%, transparent), transparent 70%);
                    opacity: .5; transition: opacity .3s ease;
                }
                .contact-card:hover .cc-glow { opacity: 1; }

                .cc-top {
                    position: relative; z-index: 1;
                    display: flex; align-items: center; justify-content: space-between;
                    margin-bottom: 14px;
                }
                .cc-icon {
                    width: 50px; height: 50px; border-radius: 15px;
                    display: flex; align-items: center; justify-content: center;
                    color: var(--c);
                    background: color-mix(in srgb, var(--c) 14%, transparent);
                    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 25%, transparent);
                }
                .cc-tag {
                    display: inline-flex; align-items: center; gap: 6px;
                    font-size: 11px; font-weight: 700; color: var(--c);
                    background: color-mix(in srgb, var(--c) 12%, transparent);
                    padding: 4px 9px 4px 8px; border-radius: 20px; white-space: nowrap;
                }
                .cc-dot {
                    position: relative; width: 6px; height: 6px; border-radius: 50%;
                    background: var(--c); flex-shrink: 0;
                }
                .cc-dot::after {
                    content: ''; position: absolute; inset: 0; border-radius: 50%;
                    background: var(--c); animation: ccPing 1.8s cubic-bezier(0,0,.2,1) infinite;
                }
                @keyframes ccPing {
                    0% { transform: scale(1); opacity: .6; }
                    80%, 100% { transform: scale(2.8); opacity: 0; }
                }

                .cc-label {
                    position: relative; z-index: 1;
                    font-weight: 800; font-size: 16px; color: var(--text); margin-bottom: 5px;
                }
                .cc-desc {
                    position: relative; z-index: 1;
                    font-size: 13px; color: var(--text3); line-height: 1.6; margin-bottom: 18px;
                }
                .cc-btn {
                    position: relative; z-index: 1;
                    display: inline-flex; align-items: center; gap: 7px;
                    padding: 9px 16px; border-radius: 11px;
                    background: var(--c); color: #fff; font-weight: 700; font-size: 13px;
                    font-family: 'Outfit', sans-serif;
                    box-shadow: 0 4px 14px color-mix(in srgb, var(--c) 40%, transparent);
                }
                .cc-btn svg { transition: transform .25s ease; }
                .contact-card:hover .cc-btn svg { transform: translate(2px, -2px); }

                /* ── Support ticket CTA ── */
                .ticket-cta {
                    width: 100%; margin-top: 22px; padding: 18px;
                    display: flex; align-items: center; gap: 14px; text-align: left;
                    cursor: pointer; font-family: 'Outfit', sans-serif;
                    border: 1px solid var(--border);
                    transition: transform .2s ease, box-shadow .25s ease, border-color .25s ease;
                }
                .ticket-cta:hover {
                    transform: translateY(-2px);
                    border-color: color-mix(in srgb, var(--blue) 45%, transparent);
                    box-shadow: 0 12px 30px color-mix(in srgb, var(--blue) 16%, transparent);
                }
                .ticket-cta:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
                .ticket-icon {
                    width: 46px; height: 46px; border-radius: 13px; flex-shrink: 0;
                    background: var(--blue-l); color: var(--blue);
                    display: flex; align-items: center; justify-content: center;
                }
                .ticket-text { flex: 1; min-width: 0; }
                .ticket-title { font-weight: 700; font-size: 14px; color: var(--text); margin-bottom: 3px; }
                .ticket-desc { font-size: 13px; color: var(--text3); line-height: 1.55; }
                .ticket-arrow { color: var(--blue); flex-shrink: 0; transition: transform .25s ease; }
                .ticket-cta:hover .ticket-arrow { transform: translateX(4px); }

                @media (prefers-reduced-motion: reduce) {
                    .contact-card, .ticket-cta, .cc-btn svg, .ticket-arrow { transition: none; }
                    .contact-card:hover, .ticket-cta:hover { transform: none; }
                    .cc-dot::after { animation: none; display: none; }
                }
                `
            }} />
        </div>
    );
}