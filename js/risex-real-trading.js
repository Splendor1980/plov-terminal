// ── Получение реального баланса (с использованием Firestore адреса) ─

async function getRealBalance() {
    if (!currentUser || !currentUser.uid) {
        console.warn('getRealBalance: no currentUser');
        return 0;
    }

    try {
        // Запрашиваем баланс через backend, передавая uid
        const url = `/api/check-payment?action=balance&uid=${currentUser.uid}`;

        console.log('📊 Fetching balance via proxy:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Balance proxy error:', response.status, errorData);
            
            // Если ошибка 404 или 400 - значит RISEx не подключен
            if (response.status === 404 || response.status === 400) {
                console.warn('⚠️ RISEx wallet not connected for this user');
            }
            
            return 0;
        }

        const data = await response.json();
        console.log('✅ Balance response:', data);

        let balance = parseFloat(
            data.balance ?? data.free ?? data.available ?? data.equity ?? 0
        );

        if (typeof balance === 'string') balance = parseFloat(balance);
        if (balance > 1e15) balance = balance / 1e18;
        if (isNaN(balance) || balance < 0) balance = 0;

        console.log('✅ Real USDC Balance loaded:', balance, 'USDC');
        return balance;

    } catch (error) {
        console.error('❌ getRealBalance failed:', error);
        return 0;
    }
}
