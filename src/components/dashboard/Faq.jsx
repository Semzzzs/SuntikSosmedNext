import { useState } from 'react';
import {
  ChevronDown, HelpCircle, MessageCircle, Search,
  Info, Wallet, ShoppingCart, Wrench, LayoutGrid, ArrowRight, Ticket
} from 'lucide-react';

const FAQS = [
  {
    category: 'Umum',
    items: [
      {
        q: 'Apa itu SuntikSosmed?',
        a: 'SuntikSosmed adalah platform layanan SMM (Social Media Marketing) yang membantu kamu meningkatkan followers, likes, views, dan engagement di berbagai platform media sosial seperti Instagram, TikTok, YouTube, Facebook, dan lainnya.',
      },
      {
        q: 'Apakah layanan ini aman?',
        a: 'Ya, semua layanan kami menggunakan metode yang aman dan tidak melanggar kebijakan platform. Namun kami tetap menyarankan untuk tidak menggunakan layanan secara berlebihan dalam waktu singkat.',
      },
      {
        q: 'Berapa lama order diproses?',
        a: 'Sebagian besar order dimulai dalam beberapa menit hingga 1 jam setelah pembayaran dikonfirmasi. Untuk beberapa layanan premium, proses bisa memakan waktu lebih lama sesuai deskripsi layanan.',
      },
    ],
  },
  {
    category: 'Pembayaran & Saldo',
    items: [
      {
        q: 'Metode pembayaran apa yang tersedia?',
        a: 'Saat ini kami menerima pembayaran via QRIS (GoPay, OVO, Dana, ShopeePay, dan semua e-wallet/m-banking yang mendukung QRIS) serta Transfer Manual. Pembayaran QRIS terkonfirmasi otomatis, sedangkan transfer manual dikonfirmasi oleh admin.',
      },
      {
        q: 'Berapa minimum deposit?',
        a: 'Minimum deposit via QRIS adalah Rp 10.000, sedangkan via Transfer Manual minimum Rp 5.000.',
      },
      {
        q: 'Apakah saldo bisa di-refund?',
        a: 'Saldo yang sudah masuk tidak dapat di-refund ke rekening/dompet. Saldo hanya bisa digunakan untuk melakukan order di platform ini.',
      },
      {
        q: 'Kenapa saldo saya belum masuk?',
        a: 'Untuk QRIS, saldo biasanya masuk otomatis dalam beberapa menit setelah pembayaran berhasil. Untuk Transfer Manual, saldo masuk setelah admin mengonfirmasi pembayaran kamu. Jika lebih dari 1 jam belum masuk, silakan buka tiket support dengan menyertakan bukti pembayaran.',
      },
    ],
  },
  {
    category: 'Order & Layanan',
    items: [
      {
        q: 'Bagaimana cara melakukan order?',
        a: 'Pilih menu "New Order" → Pilih Kategori → Pilih Service → Masukkan Link target → Masukkan Quantity → Klik "Place Order". Pastikan saldo kamu mencukupi sebelum order.',
      },
      {
        q: 'Apa yang terjadi jika order gagal atau tidak selesai?',
        a: 'Jika order gagal atau tidak mencapai jumlah yang dipesan, saldo akan di-refund secara otomatis atau order akan dilanjutkan sesuai kebijakan layanan. Kamu bisa cek status di menu "My Orders".',
      },
      {
        q: 'Apakah ada garansi refill?',
        a: 'Beberapa layanan memiliki garansi refill (biasanya ditandai dengan "Refill" di nama layanan). Jika followers/likes drop dalam periode garansi, kamu bisa request refill melalui tiket support.',
      },
      {
        q: 'Apakah link yang dimasukkan harus publik?',
        a: 'Ya, akun/konten yang ditarget harus bersifat publik (tidak di-private) agar layanan dapat diproses. Pastikan akun kamu tidak dalam mode privat sebelum melakukan order.',
      },
    ],
  },
  {
    category: 'Teknis',
    items: [
      {
        q: 'Kenapa layanan tidak muncul?',
        a: 'Layanan mungkin sedang dalam maintenance atau stok habis sementara. Coba refresh halaman atau cek kembali beberapa menit kemudian.',
      },
      {
        q: 'Bagaimana cara menghubungi support?',
        a: 'Kamu bisa menghubungi kami melalui menu "Contact" untuk chat langsung via WhatsApp atau Telegram, atau buka tiket di menu "Tickets" untuk masalah yang membutuhkan penanganan lebih lanjut.',
      },
    ],
  },
];

// Ikon + warna khas tiap kategori (mengkode isi, bukan sekadar hiasan)
const CAT_META = {
  'Umum': { icon: <Info size={17} />, color: '#2563EB' },
  'Pembayaran & Saldo': { icon: <Wallet size={17} />, color: '#10B981' },
  'Order & Layanan': { icon: <ShoppingCart size={17} />, color: '#8B5CF6' },
  'Teknis': { icon: <Wrench size={17} />, color: '#F59E0B' },
};
const metaFor = (cat) => CAT_META[cat] || { icon: <HelpCircle size={17} />, color: '#2563EB' };

function FAQItem({ q, a, color, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`faq-item${open ? ' open' : ''}`} style={{ '--c': color }}>
      <button className="faq-q" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className="faq-q-text">{q}</span>
        <span className="faq-toggle"><ChevronDown size={15} /></span>
      </button>
      <div className="faq-a-wrap">
        <div className="faq-a-inner">
          <div className="faq-a">{a}</div>
        </div>
      </div>
    </div>
  );
}

export default function Faq({ setMenu }) {
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const categories = ['Semua', ...FAQS.map(f => f.category)];

  // Saat mencari, cari di semua kategori; kalau tidak, hormati filter kategori.
  const base = (activeCategory === 'Semua' || q)
    ? FAQS
    : FAQS.filter(f => f.category === activeCategory);

  const sections = base
    .map(f => ({
      ...f,
      items: q ? f.items.filter(it => `${it.q} ${it.a}`.toLowerCase().includes(q)) : f.items,
    }))
    .filter(f => f.items.length > 0);

  const totalCount = FAQS.reduce((s, f) => s + f.items.length, 0);
  const countFor = (cat) => cat === 'Semua' ? totalCount : (FAQS.find(f => f.category === cat)?.items.length || 0);

  // Navigasi ke menu lain: pakai setMenu kalau ada, jika tidak klik tab yang sudah ada.
  const goTo = (menuId) => {
    if (setMenu) return setMenu(menuId);
    const tabs = Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .filter(el => el.offsetParent && el.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === menuId.toLowerCase());
    if (tabs.length) {
      tabs.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
      tabs[0].click();
    }
  };

  return (
    <div className="fu faq-page">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Pertanyaan Umum (FAQ)</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Temukan jawaban atas pertanyaan yang sering ditanyakan.</p>
      </div>

      {/* Search */}
      <div className="faq-search">
        <Search size={16} />
        <input
          className="inp"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Cari pertanyaan… (mis. deposit, refill, QRIS)"
          style={{ paddingLeft: 40, fontSize: 14 }}
        />
      </div>

      {/* Category filter */}
      <div className="faq-cats">
        {categories.map(c => {
          const m = c === 'Semua' ? { icon: <LayoutGrid size={15} />, color: '#2563EB' } : metaFor(c);
          const active = activeCategory === c;
          return (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`faq-cat${active ? ' active' : ''}`}
              style={{ '--c': m.color }}
            >
              {m.icon}{c}
              <span className="faq-count">{countFor(c)}</span>
            </button>
          );
        })}
      </div>

      {/* FAQ sections */}
      {sections.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sections.map(section => {
            const m = metaFor(section.category);
            return (
              <div key={section.category} className="card faq-section" style={{ '--c': m.color, padding: '8px 20px 6px' }}>
                <div className="faq-section-head">
                  <span className="faq-section-icon">{m.icon}</span>
                  <span className="faq-section-title">{section.category}</span>
                  <span className="faq-section-count">{section.items.length} pertanyaan</span>
                </div>
                {section.items.map((item, i) => (
                  <FAQItem
                    key={`${section.category}-${i}-${q ? 'q' : ''}`}
                    q={item.q}
                    a={item.a}
                    color={m.color}
                    defaultOpen={!!q}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card faq-empty">
          <div className="faq-empty-icon"><Search size={24} /></div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>Tidak ada hasil untuk “{query}”</div>
          <div style={{ fontSize: 13 }}>Coba kata kunci lain, atau hubungi kami lewat tombol di bawah.</div>
        </div>
      )}

      {/* Still need help */}
      <div className="card faq-help">
        <div className="faq-help-icon"><MessageCircle size={22} /></div>
        <div className="faq-help-text">
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 3 }}>Masih ada pertanyaan?</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Tim kami siap bantu lewat chat langsung atau tiket support.</div>
        </div>
        <div className="faq-help-actions">
          <button className="faq-help-btn primary" onClick={() => goTo('Contact')}>
            <MessageCircle size={14} /> Hubungi Kami
          </button>
          <button className="faq-help-btn ghost" onClick={() => goTo('Tickets')}>
            <Ticket size={14} /> Buka Tiket
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .faq-page { max-width: 860px; }

        /* Search */
        .faq-search { position: relative; margin-bottom: 18px; }
        .faq-search > svg {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: var(--text3); pointer-events: none;
        }
        .faq-search input { width: 100%; }

        /* Category pills */
        .faq-cats { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 22px; }
        .faq-cat {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 12px 7px 13px; border-radius: 22px;
          border: 1.5px solid var(--border); background: transparent;
          color: var(--text2); font-weight: 700; font-size: 13px; cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif; transition: all .16s;
        }
        .faq-cat:hover {
          border-color: color-mix(in srgb, var(--c) 50%, transparent);
          color: var(--c);
        }
        .faq-cat.active { background: var(--c); border-color: var(--c); color: #fff; }
        .faq-count {
          font-size: 11px; font-weight: 800; line-height: 1; padding: 3px 7px;
          border-radius: 10px; background: color-mix(in srgb, currentColor 16%, transparent);
        }

        /* Section card */
        .faq-section-head { display: flex; align-items: center; gap: 10px; padding: 12px 2px 10px; }
        .faq-section-icon {
          width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent);
        }
        .faq-section-title { font-weight: 800; font-size: 14px; color: var(--text); }
        .faq-section-count { margin-left: auto; font-size: 12px; font-weight: 600; color: var(--text3); }

        /* Accordion item */
        .faq-item { border-top: 1px solid var(--border); }
        .faq-q {
          width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px 2px;
          background: none; border: none; cursor: pointer; text-align: left;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .faq-q-text { flex: 1; font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.5; transition: color .2s; }
        .faq-q:hover .faq-q-text, .faq-item.open .faq-q-text { color: var(--c); }
        .faq-q:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; border-radius: 6px; }
        .faq-toggle {
          width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          color: var(--text3); background: var(--bg2);
          transition: background .2s, color .2s, transform .28s ease;
        }
        .faq-item.open .faq-toggle {
          background: color-mix(in srgb, var(--c) 14%, transparent);
          color: var(--c); transform: rotate(180deg);
        }
        .faq-a-wrap { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .3s ease; }
        .faq-item.open .faq-a-wrap { grid-template-rows: 1fr; }
        .faq-a-inner { overflow: hidden; min-height: 0; }
        .faq-a { padding: 0 0 16px; font-size: 13.5px; color: var(--text2); line-height: 1.75; }

        /* Empty state */
        .faq-empty { padding: 46px 20px; text-align: center; color: var(--text3); }
        .faq-empty-icon {
          width: 56px; height: 56px; border-radius: 16px; margin: 0 auto 14px;
          display: flex; align-items: center; justify-content: center;
          background: var(--bg2); color: var(--text3);
        }

        /* Help card */
        .faq-help {
          margin-top: 16px; padding: 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
          background: linear-gradient(135deg, color-mix(in srgb, var(--blue) 9%, var(--white)), var(--white));
          border: 1px solid color-mix(in srgb, var(--blue) 22%, transparent);
        }
        .faq-help-icon {
          width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--blue); color: #fff;
        }
        .faq-help-text { flex: 1; min-width: 180px; }
        .faq-help-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .faq-help-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 15px; border-radius: 10px; font-weight: 700; font-size: 13px;
          cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; transition: transform .18s ease, box-shadow .2s ease;
        }
        .faq-help-btn:hover { transform: translateY(-1px); }
        .faq-help-btn.primary { background: var(--blue); color: #fff; border: none; box-shadow: 0 4px 14px color-mix(in srgb, var(--blue) 38%, transparent); }
        .faq-help-btn.ghost { background: var(--white); color: var(--blue); border: 1.5px solid color-mix(in srgb, var(--blue) 30%, transparent); }
        .faq-help-btn:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }

        @media (prefers-reduced-motion: reduce) {
          .faq-a-wrap, .faq-toggle, .faq-help-btn, .faq-q-text { transition: none; }
          .faq-help-btn:hover { transform: none; }
        }
        `
      }} />
    </div>
  );
}