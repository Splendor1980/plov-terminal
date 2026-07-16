// ============================================================
// api/check-payment.js - BACKEND для Vercel
// ============================================================

const https = require('https');
const http = require('http');
const url = require('url');

const RISE_RPC       = 'https://mainnet.riselabs.xyz';
const USDC_ADDRESS   = '0xe436820ba0c69702c1d3e601d421c0ef38262739';
const PAYMENT_ADDRESS = '0x3A7B2c686b2ED20798011D17141DD74123521a4b';
const RISEX_API_REST = 'https://api.rise.trade/api';  // ✅ ДОБАВЛЕН /api!

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

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

module.exports = async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action, userAddress } = req.query;

    // ── Balance (с правильным базовым URL + &token=) ──────

    if (action === 'balance' && userAddress) {
        try {
            console.log(`[balance] Fetching for ${userAddress}`);

            // ✅ ПРАВИЛЬНЫЙ URL с /api и &token=
            const risexUrl = `${RISEX_API_REST}/v1/account/balance?account=${userAddress}&token=${USDC_ADDRESS}`;
            console.log(`[balance] URL: ${risexUrl}`);

            const { status, data } = await httpGet(risexUrl);
            console.log(`[balance] Status: ${status}`);

            if (status !== 200) {
                console.error(`[balance] API returned ${status}`);
                return res.status(status).json({ 
                    error: `RISEx API error ${status}`, 
                    source: 'risex' 
                });
            }

            let parsed;
            try {
                parsed = JSON.parse(data);
                console.log(`[balance] Parsed successfully`);
            } catch (parseErr) {
                console.error(`[balance] Parse error: ${parseErr.message}`);
                return res.status(200).json({ balance: "0", free: "0", available: "0" });
            }

            // Нормализация ответа
            const balance = parsed.balance || parsed.free || parsed.available || parsed.equity || 0;
            return res.status(200).json({
                balance: balance,
                free: parsed.free || balance,
                available: parsed.available || balance,
                equity: parsed.equity || balance
            });

        } catch (error) {
            console.error(`[balance] Error: ${error.message}`);
            return res.status(500).json({ 
                error: error.message, 
                source: 'proxy' 
            });
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
