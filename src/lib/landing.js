// src/lib/landing.js
//
// Ambil layanan REAL dari SMMSOC untuk halaman landing SEO (Opsi B).

import { createClient } from '@supabase/supabase-js';

const SMM_URL = process.env.SMM_API_URL || 'https://smmsoc.com';
const SMM_KEY = process.env.SMM_API_KEY;

const FALLBACK_RATE = 17689;

let _cache = null;
const CACHE_TTL = 5 * 60 * 1000;

function getServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

async function fetchSmmServices() {
    if (!SMM_KEY) {
        console.error('[landing] SMM_API_KEY belum diset.');
        return [];
    }
    try {
        const res = await fetch(`${SMM_URL}/api/v2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ key: SMM_KEY, action: 'services' }).toString(),
        });
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.error('[landing] fetch SMMSOC gagal:', e.message);
        return [];
    }
}

async function fetchRate(supabase) {
    try {
        if (supabase) {
            const { data } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'rate_override')
                .maybeSingle();
            const ov = data?.value ? parseInt(data.value, 10) : 0;
            if (ov && ov >= 1000) return ov;
        }
    } catch { /* lanjut ke live */ }

    try {
        const r = await fetch('https://open.er-api.com/v6/latest/USD');
        const d = await r.json();
        if (d?.result === 'success' && d?.rates?.IDR) return Math.round(d.rates.IDR);
    } catch { /* lanjut ke fallback */ }

    return FALLBACK_RATE;
}

async function fetchMarkup(supabase) {
    let markup = 1;
    let rules = { categories: {}, services: {} };
    if (!supabase) return { markup, rules };
    try {
        const { data: mk } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'markup')
            .maybeSingle();
        if (mk?.value) {
            const m = parseFloat(mk.value);
            if (!isNaN(m) && m >= 1) markup = m;
        }
        const { data: rl } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'markup_rules')
            .maybeSingle();
        if (rl?.value) {
            const p = JSON.parse(rl.value);
            rules = { categories: p.categories || {}, services: p.services || {} };
        }
    } catch { /* pakai default */ }
    return { markup, rules };
}

async function fetchDisabled(supabase) {
    if (!supabase) return new Set();
    try {
        const { data } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'disabled_services')
            .maybeSingle();
        const arr = data?.value ? JSON.parse(data.value) : [];
        return new Set((Array.isArray(arr) ? arr : []).map(String));
    } catch {
        return new Set();
    }
}

async function loadAll() {
    if (_cache && Date.now() - _cache.ts < CACHE_TTL) return _cache;

    const supabase = getServiceClient();
    const [services, rate, markupData, disabled] = await Promise.all([
        fetchSmmServices(),
        fetchRate(supabase),
        fetchMarkup(supabase),
        fetchDisabled(supabase),
    ]);

    _cache = {
        services,
        rate,
        markup: markupData.markup,
        rules: markupData.rules,
        disabled,
        ts: Date.now(),
    };
    return _cache;
}

const TYPE_KEYWORDS = {
    followers: ['follower', 'followers'],
    likes: ['like', 'likes'],
    views: ['view', 'views'],
    subscriber: ['subscriber', 'subscribers', 'subs'],
    member: ['member', 'members'],
    comments: ['comment', 'comments'],
};

function matchesPlatform(svc, platform) {
    if (!platform) return true;
    const hay = `${svc.category || ''} ${svc.name || ''}`.toLowerCase();
    return hay.includes(platform.toLowerCase());
}

function matchesType(svc, type) {
    if (!type) return true;
    const kws = TYPE_KEYWORDS[type] || [type];
    const hay = `${svc.name || ''} ${svc.category || ''}`.toLowerCase();
    return kws.some((kw) => hay.includes(kw));
}

export async function getServicesForLanding(filter, limit = 24) {
    const all = await loadAll();
    const { services, rate, markup, rules, disabled } = all;

    let rows = services.filter((s) => !disabled.has(String(s.service)));

    if (filter && filter.platform) {
        rows = rows.filter((s) => matchesPlatform(s, filter.platform));
    }
    if (filter && filter.type) {
        rows = rows.filter((s) => matchesType(s, filter.type));
    }

    const normalized = rows
        .map((s) => {
            const baseUSD = parseFloat(s.rate || 0);
            const effMarkup =
                rules.services?.[String(s.service)] ??
                rules.categories?.[s.category] ??
                markup;
            const priceIDR = Math.round(baseUSD * rate * effMarkup);
            return {
                id: s.service ?? null,
                name: s.name ?? 'Layanan',
                category: s.category ?? '',
                price: priceIDR,
                min: s.min ?? null,
                max: s.max ?? null,
            };
        })
        .filter((s) => s.id !== null && s.price > 0)
        .sort((a, b) => a.price - b.price)
        .slice(0, limit);

    return { services: normalized, rate };
}