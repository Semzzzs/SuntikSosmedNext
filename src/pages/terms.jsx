import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import {
    ArrowLeft, Target, Moon, Sun, FileText, Wallet, ShieldCheck,
    RefreshCw, AlertTriangle, Scale, Settings, Bell, ChevronUp, Mail, UserCheck
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

const SECTIONS = [
    {
        id: 'penerimaan',
        icon: <FileText size={18} />,
        title: '1. Penerimaan Syarat',
        body: 'Dengan mendaftar dan menggunakan layanan SuntikSosmed, kamu dianggap telah membaca, memahami, dan menyetujui seluruh syarat dan ketentuan yang tercantum dalam dokumen ini, beserta Kebijakan Privasi yang menyertainya. Jika kamu tidak menyetujui salah satu ketentuan di sini, mohon untuk tidak melanjutkan pendaftaran atau penggunaan layanan kami.',
    },
    {
        id: 'deskripsi-layanan',
        icon: <Target size={18} />,
        title: '2. Deskripsi Layanan',
        body: 'SuntikSosmed adalah platform Social Media Marketing (SMM) yang menyediakan layanan penambahan followers, likes, views, komentar, dan bentuk engagement lain untuk berbagai platform media sosial seperti Instagram, TikTok, YouTube, Facebook, Twitter/X, Telegram, dan Spotify. Seluruh layanan diproses secara otomatis oleh sistem berdasarkan link atau username publik yang dimasukkan pengguna saat melakukan order.',
    },
    {
        id: 'akun-pengguna',
        icon: <UserCheck size={18} />,
        title: '3. Akun Pengguna',
        body: 'Beberapa ketentuan terkait kepemilikan dan penggunaan akun:',
        list: [
            'Kamu bertanggung jawab penuh atas kerahasiaan dan keamanan akun beserta password milikmu.',
            'Satu orang hanya diperbolehkan memiliki satu akun aktif, kecuali untuk keperluan reseller yang telah disetujui secara terpisah oleh tim kami.',
            'Informasi yang kamu berikan saat pendaftaran harus akurat dan dapat dipertanggungjawabkan.',
            'Kami berhak menangguhkan atau menghentikan akun yang terindikasi melakukan penyalahgunaan sistem, kecurangan, atau pelanggaran terhadap ketentuan ini.',
        ],
    },
    {
        id: 'saldo-pembayaran',
        icon: <Wallet size={18} />,
        title: '4. Saldo & Pembayaran',
        body: 'Ketentuan mengenai saldo dan transaksi pembayaran di platform kami:',
        list: [
            'Top up saldo dilakukan melalui metode QRIS yang mendukung pembayaran dari berbagai bank dan e-wallet di Indonesia.',
            'Saldo yang telah di-top up bersifat non-refundable (tidak dapat ditarik kembali dalam bentuk uang tunai), kecuali terjadi kesalahan sistem yang murni berasal dari pihak kami.',
            'Saldo tidak memiliki masa kedaluwarsa dan hanya dapat digunakan untuk transaksi di dalam platform SuntikSosmed.',
            'Setiap transaksi yang sudah berhasil diproses tidak dapat dibatalkan secara sepihak oleh pengguna.',
        ],
    },
    {
        id: 'garansi-refill',
        icon: <RefreshCw size={18} />,
        title: '5. Garansi & Refill',
        body: 'Sebagian layanan kami dilengkapi dengan garansi refill yang berlaku sesuai ketentuan yang tertera pada masing-masing layanan saat order dibuat. Garansi refill tidak berlaku apabila penurunan jumlah (drop) disebabkan oleh hal-hal berikut:',
        list: [
            'Akun pengguna diubah menjadi mode privat setelah order diproses.',
            'Konten, postingan, atau akun target dihapus oleh pengguna sendiri.',
            'Terjadi pelanggaran kebijakan dari platform media sosial terkait (Instagram, TikTok, dll).',
            'Faktor lain di luar kendali wajar SuntikSosmed, termasuk perubahan algoritma platform pihak ketiga.',
        ],
    },
    {
        id: 'larangan',
        icon: <AlertTriangle size={18} />,
        title: '6. Larangan Penggunaan',
        body: 'Pengguna dilarang melakukan hal-hal berikut saat menggunakan layanan SuntikSosmed:',
        list: [
            'Menggunakan layanan untuk tujuan ilegal atau yang melanggar hukum yang berlaku.',
            'Melakukan chargeback atau sanggahan pembayaran yang tidak berdasar setelah transaksi berhasil.',
            'Mencoba mengeksploitasi celah, bug, atau kerentanan pada sistem kami.',
            'Menggunakan layanan untuk merugikan, melecehkan, atau menipu pihak ketiga.',
            'Melakukan reverse-engineering, scraping otomatis, atau upaya akses tidak sah terhadap sistem kami.',
        ],
        note: 'Pelanggaran terhadap ketentuan di atas dapat berakibat penangguhan atau penghapusan akun secara permanen tanpa pengembalian saldo.',
    },
    {
        id: 'batasan-tanggung-jawab',
        icon: <Scale size={18} />,
        title: '7. Batasan Tanggung Jawab',
        body: 'SuntikSosmed berupaya memberikan layanan terbaik, namun perlu dipahami bahwa kami tidak bertanggung jawab atas tindakan yang diambil oleh platform media sosial pihak ketiga, termasuk namun tidak terbatas pada penangguhan akun, penghapusan konten, atau perubahan kebijakan yang terjadi sebagai dampak dari penggunaan layanan SMM. Pengguna disarankan untuk memahami dan menerima risiko ini sebelum melakukan order, sesuai dengan kebijakan masing-masing platform media sosial yang digunakan.',
    },
    {
        id: 'perubahan-layanan',
        icon: <Settings size={18} />,
        title: '8. Perubahan Layanan',
        body: 'Kami berhak mengubah harga, menambah, mengurangi, atau menghentikan layanan tertentu sewaktu-waktu tanpa pemberitahuan terlebih dahulu, mengikuti perubahan dari penyedia layanan SMM yang kami gunakan di balik sistem (backend provider). Perubahan harga tidak berlaku surut terhadap order yang sudah berhasil diproses sebelumnya.',
    },
    {
        id: 'perubahan-ketentuan',
        icon: <Bell size={18} />,
        title: '9. Perubahan Ketentuan',
        body: 'Syarat dan ketentuan ini dapat diperbarui dari waktu ke waktu mengikuti perkembangan layanan, kebutuhan operasional, atau regulasi yang berlaku. Penggunaan layanan secara berkelanjutan setelah perubahan dipublikasikan dianggap sebagai bentuk persetujuan terhadap ketentuan yang telah diperbarui. Tanggal pembaruan terakhir selalu tercantum di bagian atas halaman ini.',
    },
    {
        id: 'hukum-yang-berlaku',
        icon: <Scale size={18} />,
        title: '10. Hukum yang Berlaku',
        body: 'Syarat dan ketentuan ini tunduk pada dan ditafsirkan sesuai dengan hukum yang berlaku di Republik Indonesia. Segala sengketa yang timbul sehubungan dengan penggunaan layanan ini akan diupayakan diselesaikan terlebih dahulu secara musyawarah antara kedua belah pihak.',
    },
];

function useScrollTop() {
    const [show, setShow] = useState(false);
    useEffect(() => {
        const onScroll = () => setShow(window.scrollY > 480);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    return show;
}

export default function TermsOfService() {
    const router = useRouter();
    const { dark, toggle } = useTheme();
    const showTop = useScrollTop();

    return (
        <div className={`root${dark ? ' dark' : ''}`} style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
            <Head>
                <title>Syarat & Ketentuan — SuntikSosmed</title>
                <meta name="description" content="Syarat dan ketentuan penggunaan layanan SuntikSosmed." />
            </Head>

            {/* ── BLOB BG — selaras dengan landing page ── */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                {!dark && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #EAF1FF 0%, #F4F8FF 45%, #EAF2FF 100%)' }} />}
                {dark && <div style={{ position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)', width: 1100, height: 700, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(37,99,235,.18) 0%, rgba(37,99,235,.06) 35%, transparent 65%)', filter: 'blur(20px)' }} />}
                <div style={{ position: 'absolute', top: -120, left: -100, width: 500, height: 500, borderRadius: '50%', background: dark ? 'radial-gradient(circle, rgba(37,99,235,.12) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(37,99,235,.14) 0%, transparent 65%)' }} />
                <div style={{ position: 'absolute', bottom: -100, right: -100, width: 420, height: 420, borderRadius: '50%', background: dark ? 'radial-gradient(circle, rgba(59,130,246,.08) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(59,130,246,.1) 0%, transparent 65%)' }} />
            </div>

            {/* ── NAVBAR — konsisten dengan landing page ── */}
            <nav style={{ position: 'relative', zIndex: 50, maxWidth: 1160, margin: '0 auto', padding: '18px 16px 0' }}>
                <div style={{
                    background: dark ? 'rgba(15,15,20,.97)' : 'rgba(255,255,255,.96)',
                    backdropFilter: 'blur(20px)',
                    border: dark ? '1px solid var(--border)' : '1px solid rgba(37,99,235,.12)',
                    borderRadius: 14,
                    padding: '10px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    boxShadow: dark ? '0 4px 24px rgba(37,99,235,.08)' : '0 4px 24px rgba(37,99,235,.12), 0 1px 0 rgba(255,255,255,.8)',
                }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 800, fontSize: 16, color: 'var(--text)', textDecoration: 'none', flexShrink: 0 }}>
                        <img src="/logo.png" alt="SS" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                        <span>Suntik<span style={{ background: 'var(--blue)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Sosmed</span></span>
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <button onClick={toggle} aria-label="Ganti tema" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 11, flexShrink: 0 }}>
                            {dark ? <Sun size={17} /> : <Moon size={17} />}
                        </button>
                        <button onClick={() => router.push('/register')} style={{ background: 'var(--blue)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: '#fff', fontFamily: "'Outfit','Plus Jakarta Sans',sans-serif", padding: '8px 16px', borderRadius: 50, whiteSpace: 'nowrap' }}>
                            Daftar
                        </button>
                    </div>
                </div>
            </nav>

            <div style={{ position: 'relative', zIndex: 10, maxWidth: 880, margin: '0 auto', padding: '36px 16px 72px' }}>

                <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text2)', textDecoration: 'none', fontSize: 13.5, fontWeight: 600, marginBottom: 28 }}>
                    <ArrowLeft size={15} /> Kembali ke Beranda
                </Link>

                {/* ── HEADER ── */}
                <div style={{ marginBottom: 36 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                        background: dark ? 'linear-gradient(135deg, rgba(37,99,235,.18), rgba(37,99,235,.06))' : 'linear-gradient(135deg, #FFFFFF, #EAF1FF)',
                        border: dark ? '1px solid rgba(96,165,250,.26)' : '1px solid rgba(37,99,235,.22)',
                        borderRadius: 30, padding: '5px 14px', fontSize: 12, fontWeight: 700, marginBottom: 18,
                        color: dark ? '#93C5FD' : 'var(--blue)',
                    }}>
                        <FileText size={13} /> Ketentuan Layanan
                    </div>
                    <h1 style={{ fontSize: 'clamp(28px, 5.5vw, 42px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1.15, marginBottom: 12 }}>
                        Syarat & Ketentuan
                    </h1>
                    <p style={{ fontSize: 13.5, color: 'var(--text3)', fontWeight: 600, marginBottom: 18 }}>Terakhir diperbarui: 19 Juni 2026</p>
                    <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.8, maxWidth: 680 }}>
                        Dokumen ini mengatur hak, kewajiban, dan batasan tanggung jawab antara kamu sebagai pengguna dan SuntikSosmed sebagai penyedia layanan. Mohon dibaca dengan saksama sebelum menggunakan layanan kami.
                    </p>
                </div>

                {/* ── DAFTAR ISI ── */}
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 22px', marginBottom: 32, boxShadow: 'var(--shadow)' }}>
                    <p style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>Daftar Isi</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
                        {SECTIONS.map(s => (
                            <a key={s.id} href={`#${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text2)', textDecoration: 'none', padding: '5px 0' }}>
                                <span style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--blue-l)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</span>
                                {s.title.replace(/^\d+\.\s/, '')}
                            </a>
                        ))}
                    </div>
                </div>

                {/* ── SECTIONS ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {SECTIONS.map((s) => (
                        <div key={s.id} id={s.id} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 18, padding: '24px 26px', scrollMarginTop: 90, boxShadow: 'var(--shadow)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <span style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--blue-l)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</span>
                                <h2 style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{s.title}</h2>
                            </div>
                            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.8, margin: s.list ? '0 0 14px' : 0 }}>{s.body}</p>
                            {s.list && (
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                                    {s.list.map((item, j) => (
                                        <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.7 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', marginTop: 7, flexShrink: 0 }} />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {s.note && (
                                <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 12, fontSize: 13, color: '#EF4444', lineHeight: 1.7, fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                                    {s.note}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* ── CTA KONTAK ── */}
                <div style={{ marginTop: 32, background: 'var(--blue)', borderRadius: 20, padding: '28px 26px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                            <Mail size={20} style={{ color: '#fff' }} />
                        </div>
                        <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Ada pertanyaan soal ketentuan ini?</h3>
                        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.8)', marginBottom: 18, maxWidth: 420, margin: '0 auto 18px' }}>
                            Tim kami siap membantu menjelaskan syarat dan ketentuan melalui kanal kontak resmi kami.
                        </p>
                        <button onClick={() => window.open('https://wa.me/6283843306230', '_blank')} style={{ background: '#fff', border: 'none', borderRadius: 50, padding: '11px 24px', fontSize: 13.5, fontWeight: 800, color: 'var(--blue)', cursor: 'pointer', fontFamily: "'Outfit','Plus Jakarta Sans',sans-serif" }}>
                            Hubungi Kami
                        </button>
                    </div>
                </div>

                {/* ── LINK SILANG ── */}
                <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text3)' }}>
                    Lihat juga{' '}
                    <Link href="/privacy" style={{ color: 'var(--blue)', fontWeight: 700, textDecoration: 'none' }}>Kebijakan Privasi</Link>
                    {' '}kami.
                </p>
            </div>

            {/* ── SCROLL TO TOP ── */}
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Kembali ke atas"
                style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 60,
                    width: 44, height: 44, borderRadius: 13,
                    background: 'var(--blue)', border: 'none', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(37,99,235,.4)',
                    opacity: showTop ? 1 : 0, pointerEvents: showTop ? 'auto' : 'none',
                    transform: showTop ? 'translateY(0)' : 'translateY(12px)',
                    transition: 'opacity .25s, transform .25s',
                }}>
                <ChevronUp size={20} />
            </button>
        </div>
    );
}