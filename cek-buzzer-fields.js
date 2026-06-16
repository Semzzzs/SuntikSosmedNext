// Cek struktur field service BuzzerPanel — TANPA dotenv.
// Taruh di root project (sejajar .env.local), lalu jalankan:
//   node cek-buzzer-fields.js
//
// Output: 1 objek service mentah utuh + daftar nama field.

const fs = require('fs');
const path = require('path');

// --- Baca .env.local manual (tanpa dependency) ---
function loadEnv(file) {
    const out = {};
    try {
        const raw = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
        for (let line of raw.split('\n')) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;
            const eq = line.indexOf('=');
            if (eq === -1) continue;
            let key = line.slice(0, eq).trim();
            let val = line.slice(eq + 1).trim();
            // buang tanda kutip pembungkus kalau ada
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            out[key] = val;
        }
    } catch (e) {
        console.error('Gagal baca', file, '-', e.message);
    }
    return out;
}

const env = loadEnv('.env.local');
const KEY = env.BUZZER_API_KEY || process.env.BUZZER_API_KEY;
const SECRET = env.BUZZER_SECRET_KEY || process.env.BUZZER_SECRET_KEY;
const URL = env.BUZZER_API_URL || process.env.BUZZER_API_URL || 'https://buzzerpanel.id';

if (!KEY || !SECRET) {
    console.error('BUZZER_API_KEY / BUZZER_SECRET_KEY tidak ditemukan di .env.local');
    console.error('Key yang kebaca di .env.local:', Object.keys(env).filter(k => k.includes('BUZZER')));
    process.exit(1);
}

(async () => {
    try {
        const res = await fetch(`${URL}/api/json.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ api_key: KEY, secret_key: SECRET, action: 'services' }).toString(),
        });
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); }
        catch { console.log('Respons BUKAN JSON:\n', text.slice(0, 600)); return; }

        const arr = Array.isArray(json) ? json : (json.data || json.services || json.result || json.results || []);
        console.log('HTTP status:', res.status);
        console.log('Jumlah service:', arr.length);
        if (!arr.length) {
            console.log('Array kosong. Respons mentah:\n', JSON.stringify(json, null, 2).slice(0, 600));
            return;
        }
        console.log('\n=== SATU SERVICE MENTAH (semua field) ===');
        console.log(JSON.stringify(arr[0], null, 2));
        console.log('\n=== NAMA FIELD ===');
        console.log(Object.keys(arr[0]));
    } catch (e) {
        console.error('Fetch gagal:', e.message);
    }
})();