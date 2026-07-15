// ============================================================
// api/check-payment.js - BACKEND для Vercel
// ============================================================
// Proxy для RISEx API (обход CORS)
// ============================================================

const https = require('https');
const http = require('http');
const url = require('url');

// Константы
const RISE_RPC       = 'https://mainnet.riselabs.xyz';
const USDC_ADDRESS   = '0xe436820ba0c69702c1d3e601d421c0ef38262739';
const PAYMENT_ADDRESS = '0x3A7B2c686b2ED20798011D17141DD74123521a4b';
const RISEX_API_REST = 'https://api.rise.trade';

// ── CORS Headers ────────────────────────────────────────────

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── HTTP GET через https module ────────────────────────────

function httpGet(urlString) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new url.URL(urlString);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        protocol.get(urlString, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, data });
            });
        }).on('error', reject);
    });
}

// ── Main Handler ────────────────────────────────────────────

module.exports = async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action, userAddress, txHash } = req.query;

    // ── Balance ────────────────────────────────────────────

    if (action === 'balance' && userAddress) {
        try {
            console.log(`[balance] Fetching for ${userAddress}`);

            const risexUrl = `${RISEX_API_REST}/v1/account/balance?account=${userAddress}&token=${USDC_ADDRESS}`;
            console.log(`[balance] URL: ${risexUrl}`);

            const { status, data } = await httpGet(risexUrl);
            console.log(`[balance] Status: ${status}, Data: ${data.slice(0, 100)}`);

            if (status !== 200) {
                console.error(`[balance] API returned ${status}`);
                return res.status(status).json({ error: `RISEx API error ${status}`, source: 'risex' });
            }

            try {
                const parsed = JSON.parse(data);
                console.log(`[balance] Parsed: ${JSON.stringify(parsed).slice(0, 100)}`);
                return res.status(200).json(parsed);
            } catch (parseErr) {
                console.error(`[balance] Parse error: ${parseErr.message}`);
                return res.status(200).json({ balance: 0, error: 'Parse error', source: 'error' });
            }

        } catch (error) {
            console.error(`[balance] Error: ${error.message}`);
            return res.status(500).json({ error: error.message, source: 'error' });
        }
    }

    // ── Config ─────────────────────────────────────────────

    if (action === 'config') {
        return res.status(200).json({
            paymentAddress: PAYMENT_ADDRESS,
            usdcAddress:    USDC_ADDRESS,
            riseRpc:        RISE_RPC,
            risexApi:       RISEX_API_REST,
            subscriptionCost:   '1 USDC',
            subscriptionPeriod: '30 days',
            chainId: 4153
        });
    }

    // ── Unknown ────────────────────────────────────────────

    return res.status(400).json({
        error: 'Invalid request',
        message: 'action required: balance | config'
    });
};
