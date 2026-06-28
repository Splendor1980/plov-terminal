// ============================================================
// api/risex.js — Vercel Serverless прокси для RISEx API
// ============================================================

const RISEX_BASE = 'https://api.testnet.rise.trade';

export default async function handler(req, res) {
    // CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Путь: /api/risex/v1/system/config → /v1/system/config
    const path = req.url.replace(/^\/api\/risex/, '');
    const url  = `${RISEX_BASE}${path}`;

    try {
        const options = {
            method:  req.method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (req.method === 'POST' && req.body) {
            options.body = JSON.stringify(req.body);
        }

        const response = await fetch(url, options);
        const data     = await response.json().catch(() => ({}));

        res.status(response.status).json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
