// ============================================================
// api/check-payment.js - BACKEND для Vercel
// ============================================================
// Proxy для RISEx API (обход CORS)
// НЕ использует require('ethers') - только встроенный fetch
// ============================================================

const USDC_ADDRESS    = '0xe436820ba0c69702c1d3e601d421c0ef38262739';
const PAYMENT_ADDRESS = '0x3A7B2c686b2ED20798011D17141DD74123521a4b';
const RISE_RPC        = 'https://mainnet.riselabs.xyz';
const RISEX_API_REST  = 'https://api.rise.trade';

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action, userAddress, txHash } = req.query;

    // ── Balance ────────────────────────────────────────────

    if (action === 'balance' && userAddress) {
        try {
            // Запрос к RISEx API с &token= (с backend'а - без CORS!)
            const url = `${RISEX_API_REST}/v1/account/balance?account=${userAddress}&token=${USDC_ADDRESS}`;
            console.log('Fetching balance:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            const text = await response.text();
            console.log('RISEx response:', response.status, text);

            if (!response.ok) {
                return res.status(200).json({
                    balance: 0,
                    error: text,
                    status: response.status
                });
            }

            const data = JSON.parse(text);
            return res.status(200).json(data);

        } catch (error) {
            console.error('Balance error:', error.message);
            return res.status(200).json({ balance: 0, error: error.message });
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
