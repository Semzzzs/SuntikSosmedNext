import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import {
    ArrowLeft, Target, Moon, Sun, ShieldCheck, Database, Lock,
    Users, Cookie, Bell, ChevronUp, Mail
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

const SECTIONS = [
    {
        id: 'data-dikumpulkan',
        icon: <Database size={18} />,
        title: '1. Data yang Kami Kumpulkan',
        body: 'Saat kamu mendaftar dan menggunakan SuntikSosmed, kami mengumpulkan beberapa jenis data agar layanan dapat berjalan dengan baik:',
        list: [
            'Data akun — alamat email dan password (disimpan dalam bentuk terenkripsi/hash, bukan teks biasa).',
            'Data transaksi — riwayat top up saldo, metode pembayaran (QRIS), dan nominal transaksi.',
            'Data order — riwayat layanan yang dipesan, beserta link atau username publik yang kamu masukkan saat order.',
            'Data teknis — alamat IP, jenis perangkat, dan browser, untuk keperluan keamanan dan pencegahan penyalahgunaan sistem.',
        ],
        note: 'Kami tidak pernah meminta, meminta akses, atau menyimpan password akun media sosial kamu dalam bentuk apa pun.',
    },
    {
        id: 'penggunaan-data',
        icon: <Users size={18} />,
        title: '2. Bagaimana Data Digunakan',
        body: 'Data yang kamu berikan digunakan secara terbatas untuk kepentingan operasional layanan, di antaranya:',
        list: [
            'Memproses pesanan dan mengelola saldo akun kamu secara akurat.',
            'Memberikan dukungan pelanggan saat kamu mengajukan pertanyaan atau keluhan.',
            'Mendeteksi dan mencegah aktivitas mencurigakan atau penyalahgunaan sistem.',
            'Mengirimkan notifikasi penting terkait akun, seperti konfirmasi pembayaran atau status order.',
            'Meningkatkan kualitas layanan berdasarkan pola penggunaan secara agregat dan anonim.',
        ],
        note: 'Kami tidak menjual, menyewakan, atau membagikan data pribadi kamu kepada pihak ketiga untuk tujuan pemasaran tanpa persetujuan eksplisit.',
    },
    {
        id: 'keamanan',
        icon: <Lock size={18} />,
        title: '3. Penyimpanan & Keamanan Data',
        body: 'Keamanan data pengguna adalah prioritas utama kami. Beberapa langkah yang kami terapkan:',
        list: [
            'Data disimpan menggunakan infrastruktur cloud dengan enkripsi mengikuti standar industri.',
            'Password disimpan dalam bentuk hash satu arah, sehingga tidak dapat dibaca bahkan oleh tim internal kami.',
            'Akses ke data sensitif dibatasi hanya untuk personel yang membutuhkan untuk menjalankan tugasnya.',
            'Kami melakukan pemantauan rutin terhadap potensi celah keamanan pada sistem.',
        ],
        note: 'Meskipun kami berupaya menjaga keamanan data semaksimal mungkin, tidak ada sistem digital yang sepenuhnya bebas risiko. Jika terjadi insiden keamanan yang berdampak pada data kamu, kami akan menginformasikannya sesuai ketentuan yang berlaku.',
    },
    {
        id: 'pihak-ketiga',
        icon: <ShieldCheck size={18} />,
        title: '4. Berbagi Data dengan Pihak Ketiga',
        body: 'Kami bekerja sama dengan beberapa penyedia layanan pihak ketiga yang terpercaya untuk mendukung operasional platform, antara lain penyedia pemrosesan pembayaran QRIS dan penyedia infrastruktur server/hosting. Pihak ketiga ini hanya menerima data minimum yang diperlukan untuk menjalankan fungsinya, dan terikat kewajiban menjaga kerahasiaan data sesuai praktik standar industri masing-masing.',
    },
    {
        id: 'hak-pengguna',
        icon: <Users size={18} />,
        title: '5. Hak Kamu sebagai Pengguna',
        body: 'Sebagai pemilik data, kamu memiliki hak untuk:',
        list: [
            'Meminta akses dan salinan data pribadi yang kami simpan tentang kamu.',
            'Meminta koreksi apabila terdapat data yang tidak akurat.',
            'Meminta penghapusan akun beserta data pribadi terkait.',
            'Menarik persetujuan atas pemrosesan data tertentu, sepanjang tidak melanggar kewajiban hukum yang berlaku.',
        ],
        note: 'Permintaan penghapusan akun dapat memengaruhi riwayat transaksi dan saldo yang tersisa, sehingga tidak dapat dikembalikan setelah proses penghapusan selesai.',
    },
    {
        id: 'cookie',
        icon: <Cookie size={18} />,
        title: '6. Penggunaan Cookie',
        body: 'Kami menggunakan cookie dan teknologi serupa untuk menjaga sesi login kamu tetap aktif, mengingat preferensi tampilan (seperti mode terang/gelap), serta untuk keperluan analitik dasar guna memahami dan meningkatkan kualitas layanan. Kamu dapat menonaktifkan cookie melalui pengaturan browser, namun beberapa fitur situs mungkin tidak berfungsi secara optimal jika cookie dinonaktifkan.',
    },
    {
        id: 'anak',
        icon: <ShieldCheck size={18} />,
        title: '7. Privasi Anak di Bawah Umur',
        body: 'Layanan kami ditujukan untuk pengguna berusia 17 tahun ke atas atau yang telah memiliki kapasitas hukum untuk melakukan transaksi sesuai peraturan yang berlaku di wilayah masing-masing. Kami tidak secara sengaja mengumpulkan data dari anak di bawah umur tanpa persetujuan orang tua atau wali.',
    },
    {
        id: 'perubahan',
        icon: <Bell size={18} />,
        title: '8. Perubahan Kebijakan Privasi',
        body: 'Kebijakan privasi ini dapat diperbarui dari waktu ke waktu mengikuti perkembangan layanan, teknologi, atau regulasi yang berlaku. Perubahan signifikan akan diinformasikan melalui email terdaftar atau pemberitahuan pada dashboard akun kamu. Tanggal pembaruan terakhir selalu tercantum di bagian atas halaman ini.',
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

export default function PrivacyPolicy() {
    const router = useRouter();
    const { dark, toggle } = useTheme();
    const showTop = useScrollTop();

    return (
        <div className={`root${dark ? ' dark' : ''}`} style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
            <Head>
                <title>Kebijakan Privasi — SuntikSosmed</title>
                <meta name="description" content="Kebijakan privasi SuntikSosmed mengenai pengumpulan, penggunaan, dan perlindungan data pengguna." />
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
                        <ShieldCheck size={13} /> Privasi & Keamanan Data
                    </div>
                    <h1 style={{ fontSize: 'clamp(28px, 5.5vw, 42px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1.15, marginBottom: 12 }}>
                        Kebijakan Privasi
                    </h1>
                    <p style={{ fontSize: 13.5, color: 'var(--text3)', fontWeight: 600, marginBottom: 18 }}>Terakhir diperbarui: 19 Juni 2026</p>
                    <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.8, maxWidth: 680 }}>
                        SuntikSosmed menghargai privasi setiap pengguna. Dokumen ini menjelaskan secara transparan data apa saja yang kami kumpulkan, bagaimana data tersebut digunakan dan dilindungi, serta hak-hak yang kamu miliki sebagai pengguna layanan kami.
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
                                <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--blue-l)', borderRadius: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, fontWeight: 500 }}>
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
                        <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Ada pertanyaan soal privasi kamu?</h3>
                        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.8)', marginBottom: 18, maxWidth: 420, margin: '0 auto 18px' }}>
                            Tim kami siap membantu menjawab pertanyaan seputar data dan privasi melalui kanal kontak resmi kami.
                        </p>
                        <button onClick={() => window.open('https://wa.me/6283843306230', '_blank')} style={{ background: '#fff', border: 'none', borderRadius: 50, padding: '11px 24px', fontSize: 13.5, fontWeight: 800, color: 'var(--blue)', cursor: 'pointer', fontFamily: "'Outfit','Plus Jakarta Sans',sans-serif" }}>
                            Hubungi Kami
                        </button>
                    </div>
                </div>

                {/* ── LINK SILANG ── */}
                <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text3)' }}>
                    Lihat juga{' '}
                    <Link href="/terms" style={{ color: 'var(--blue)', fontWeight: 700, textDecoration: 'none' }}>Syarat & Ketentuan</Link>
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