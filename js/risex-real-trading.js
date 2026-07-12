// ── Получение реального баланса ─────────────────────────────

async function getRealBalance() {
    if (!signerAddress) {
        console.warn('getRealBalance: signerAddress not set');
        return 0;
    }

    try {
        const usdcAddress = "0xe436820ba0c69702c1d3e601d421c0ef38262739"; // USDC на Rise Mainnet

        const url = `https://api.rise.trade/v1/account/balance?account=${signerAddress}&token=${usdcAddress}`;
        
        console.log('📊 Fetching balance from RISEx API:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('❌ RISEx balance API error:', response.status);
            const err = await response.json().catch(() => ({}));
            console.error('Error details:', err);
            return 0;
        }

        const data = await response.json();
        console.log('✅ Balance API response:', data);
        
        let balance = parseFloat(data.balance || data.free || data.available || data.equity || 0);

        // Конвертировать если строка
        if (typeof balance === 'string') {
            balance = parseFloat(balance);
        }

        // Конвертировать из wei если нужно
        if (balance > 1e15) {
            balance = balance / 1e18;
        }

        // Санитайз
        if (isNaN(balance) || balance < 0) {
            balance = 0;
        }

        console.log('✅ Real USDC balance loaded:', balance, 'USDC');
        return balance;

    } catch (error) {
        console.error('❌ Get real balance failed:', error);
        return 0;
    }
}
