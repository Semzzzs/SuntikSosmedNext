import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, MessageCircle } from 'lucide-react';

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
        a: 'Saat ini kami menerima pembayaran via QRIS (GoPay, OVO, Dana, ShopeePay, dll) dan Cryptocurrency (BTC, ETH, USDT, BNB). Deposit via Crypto mendapatkan bonus saldo 5% untuk transaksi di atas Rp 1.000.000.',
      },
      {
        q: 'Berapa minimum deposit?',
        a: 'Minimum deposit via QRIS adalah Rp 5.000, sedangkan via Cryptocurrency minimum Rp 10.000.',
      },
      {
        q: 'Apakah saldo bisa di-refund?',
        a: 'Saldo yang sudah masuk tidak dapat di-refund ke rekening/dompet. Saldo hanya bisa digunakan untuk melakukan order di platform ini.',
      },
      {
        q: 'Kenapa saldo saya belum masuk?',
        a: 'Proses konfirmasi pembayaran biasanya memakan waktu 5–15 menit untuk QRIS, dan 1–3 konfirmasi untuk Crypto. Jika lebih dari 1 jam belum masuk, silakan buka tiket support.',
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

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", textAlign: 'left', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{q}</span>
        {open
          ? <ChevronUp size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} />
          : <ChevronDown size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{ paddingBottom: 16, fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.75 }}>
          {a}
        </div>
      )}
    </div>
  );
}

export default function ViewNotifications() {
  const [activeCategory, setActiveCategory] = useState('Semua');
  const categories = ['Semua', ...FAQS.map(f => f.category)];

  const filtered = activeCategory === 'Semua'
    ? FAQS
    : FAQS.filter(f => f.category === activeCategory);

  return (
    <div className="fu">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Pertanyaan Umum (FAQ)</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Temukan jawaban atas pertanyaan yang sering ditanyakan.</p>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        {categories.map(c => (
          <button key={c} onClick={() => setActiveCategory(c)}
            style={{ padding: '7px 16px', borderRadius: 20, border: `1.5px solid ${activeCategory === c ? 'var(--blue)' : 'var(--border)'}`, background: activeCategory === c ? 'var(--blue)' : 'transparent', color: activeCategory === c ? '#fff' : 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'all .15s' }}>
            {c}
          </button>
        ))}
      </div>

      {/* FAQ sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filtered.map(section => (
          <div key={section.category} className="card" style={{ padding: '6px 22px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0 10px', borderBottom: '1px solid var(--border)' }}>
              <HelpCircle size={15} style={{ color: 'var(--blue)' }} />
              <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--blue)' }}>{section.category}</span>
            </div>
            {section.items.map((item, i) => (
              <FAQItem key={i} q={item.q} a={item.a} />
            ))}
          </div>
        ))}
      </div>

      {/* Still need help */}
      <div className="card" style={{ marginTop: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16, background: 'var(--blue-l)', border: '1px solid var(--border2)' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MessageCircle size={22} style={{ color: '#fff' }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 3 }}>Masih ada pertanyaan?</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Hubungi kami via menu <strong>Contact</strong> atau buka tiket di menu <strong>Tickets</strong>.</div>
        </div>
      </div>
    </div>
  );
}