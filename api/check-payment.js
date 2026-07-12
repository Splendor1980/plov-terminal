// ============================================================
// api/check-payment.js - Payment & Balance Verification API
// Vercel Serverless Function
// ============================================================

export default async function handler(req, res) {
    const { action, userAddress } = req.query;

    // ── Balance Action ──────────────────────────────────────

    if (action === 'balance' && userAddress) {
        try {
            // USDC контракт на Rise Mainnet
            const usdcAddress = "0xe436820ba0c69702c1d3e601d421c0ef38262739";

            // Прямой запрос к RISEx API с правильным параметром token
            const risexResponse = await fetch(
                `https://api.rise.trade/v1/account/balance?account=${userAddress}&token=${usdcAddress}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!risexResponse.ok) {
                const errorText = await risexResponse.text();
                console.error('RISEx API error:', risexResponse.status, errorText);
                return res.status(risexResponse.status).json({
                    error: 'RISEx API error',
                    details: errorText,
                    status: risexResponse.status
                });
            }

            const data = await risexResponse.json();
            console.log('Balance fetched successfully for', userAddress, ':', data);
            return res.status(200).json(data);

        } catch (error) {
            console.error('Balance handler error:', error);
            return res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }

    // ── Config Action ──────────────────────────────────────

    if (action === 'config') {
        return res.status(200).json({
            paymentAddress: '0x3A7B2c686b2ED20798011D17141DD74123521a4b',
            usdcAddress: '0xe436820ba0c69702c1d3e601d421c0ef38262739',
            riseRpc: 'https://mainnet.riselabs.xyz',
            subscriptionCost: '1 USDC',
            subscriptionPeriod: '30 days',
            chainId: 4153
        });
    }

    // ── Unknown Action ─────────────────────────────────────

    return res.status(400).json({
        error: 'Invalid request',
        message: 'action parameter required (balance, check, status, config)'
    });
}
