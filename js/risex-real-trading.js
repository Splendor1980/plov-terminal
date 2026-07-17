// ============================================================
// js/risex-real-trading.js - REAL TRADING MODULE
// ============================================================
// Rise Mainnet (chainId 4153)
// Баланс: через backend proxy с динамическим адресом (Firestore)
// Торговля: через risex-client SDK (CDN)
// ============================================================

// ── Получение реального баланса (с использованием Firestore адреса) ─

async function getRealBalance() {
    if (!signerAddress) {
        console.warn('getRealBalance: no signer connected yet');
        return 0;
    }

    try {
        const usdc = (window.RISEX_CONTRACTS && RISEX_CONTRACTS.usdc) || FALLBACK_USDC_ADDRESS;
        const url  = `${RISEX_API.rest}/v1/account/balance?account=${signerAddress}&token=${usdc}`;

        console.log('📊 Fetching balance:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            console.warn('⚠️ Balance request failed:', response.status);
            return 0;
        }

        const raw  = await response.json();
        const data = raw.data || raw;

        let balance = parseFloat(
            data.balance ?? data.free ?? data.available ?? data.equity ?? 0
        );

        if (isNaN(balance)) balance = 0;
        if (balance > 1e15) balance = balance / 1e18; // значение в wei
        if (balance < 0) balance = 0;

        console.log('✅ Real USDC Balance loaded:', balance, 'USDC');
        return balance;

    } catch (error) {
        console.error('❌ getRealBalance failed:', error);
        return 0;
    }
}

// ── Инициализация risex-client SDK ──────────────────────────

let risexClient = null;

async function initRisexClient() {
    if (!signerAddress || !signerKey) {
        console.warn('initRisexClient: signer not ready');
        return null;
    }

    try {
        // SDK должен быть подключен через CDN в index.html
        if (typeof window.risexClient === 'undefined') {
            console.warn('risex-client SDK not loaded (CDN)');
            return null;
        }

        const { ExchangeClient } = window.risexClient;

        risexClient = new ExchangeClient({
            account: signerAddress,
            signerKey: signerKey   // приватный ключ
        });

        await risexClient.init();
        console.log('✅ risex-client SDK initialized');
        return risexClient;

    } catch (error) {
        console.error('❌ initRisexClient failed:', error);
        return null;
    }
}

// ── Размещение реального ордера через SDK ───────────────────

async function placeRealOrder(side, amountUsdc, leverage) {
    if (!signer || !signerAddress) {
        addToLog('❌ Signer not connected', 'error');
        return false;
    }

    if (!lastPrice || lastPrice <= 0) {
        addToLog('❌ No price data available', 'error');
        return false;
    }

    // Проверка баланса
    const realBalance = await getRealBalance();
    if (realBalance < amountUsdc) {
        addToLog(`❌ Insufficient balance. Have: ${realBalance.toFixed(2)}, need: ${amountUsdc}`, 'error');
        return false;
    }

    addToLog('⏳ Placing real order on RISEx...', 'pending');

    try {
        // Инициализировать SDK если еще не инициализирован
        if (!risexClient) {
            risexClient = await initRisexClient();
        }

        if (risexClient) {
            // ── Через SDK (правильно) ──────────────────────
            const positionSize = (amountUsdc * leverage) / lastPrice;

            let result;
            if (side.toLowerCase() === 'long') {
                result = await risexClient.marketBuy(currentMarket, positionSize);
            } else {
                result = await risexClient.marketSell(currentMarket, positionSize);
            }

            addToLog(`✅ ${side.toUpperCase()} opened at $${lastPrice.toFixed(2)}`, 'success');
            addToLog(`📊 Size: ${positionSize.toFixed(6)} × ${leverage}x`, 'success');
            if (result && result.order_id) {
                addToLog(`📋 Order ID: ${result.order_id}`, 'meta');
            }

            position = {
                side: side.toLowerCase(),
                size: positionSize,
                entryPrice: lastPrice,
                leverage: leverage,
                margin: amountUsdc,
                orderId: result?.order_id || null,
                timestamp: Date.now()
            };

            updatePositionUI(position);
            saveStats(side, amountUsdc * leverage, true);

            if (typeof addMyTrade === 'function') {
                addMyTrade(side, lastPrice, positionSize, leverage, result?.order_id);
            }

            return true;

        } else {
            // ── Fallback: ручной ордер ──────────────────
            addToLog('⚠️ SDK not available, trying manual order...', 'warning');
            return await placeManualOrder(side, amountUsdc, leverage);
        }

    } catch (error) {
        console.error('Place order error:', error);
        addToLog(`❌ Failed to place order: ${error.message}`, 'error');
        return false;
    }
}

// ── Ручное размещение ордера (fallback) ─────────────────────

async function placeManualOrder(side, amountUsdc, leverage) {
    try {
        const positionSize = (amountUsdc * leverage) / lastPrice;

        const response = await fetch(`${RISEX_API.rest}/v1/orders/place`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                market_id: currentMarket,
                account: signerAddress,
                side: side.toLowerCase() === 'long' ? 0 : 1,
                quantity: positionSize.toString(),
                price: lastPrice.toString(),
                leverage: leverage.toString(),
                nonce: Date.now(),
                expiry: Math.floor(Date.now() / 1000) + 3600
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `API error: ${response.status}`);
        }

        const result = await response.json();

        if (result.order_id) {
            addToLog(`✅ ${side.toUpperCase()} opened at $${lastPrice.toFixed(2)}`, 'success');
            addToLog(`📋 Order ID: ${result.order_id}`, 'meta');
            return true;
        }

        throw new Error('No order ID in response');

    } catch (error) {
        console.error('Manual order error:', error);
        addToLog(`❌ Manual order failed: ${error.message}`, 'error');
        return false;
    }
}

// ── Закрытие позиции через SDK ──────────────────────────────

async function closeRealPosition() {
    if (!position || !position.size || position.size <= 0) {
        addToLog('❌ No open position', 'error');
        return false;
    }

    addToLog('⏳ Closing position on RISEx...', 'pending');

    try {
        if (!risexClient) {
            risexClient = await initRisexClient();
        }

        if (risexClient) {
            // Через SDK - самый простой способ
            await risexClient.closePosition(currentMarket);

            addToLog(`✅ Position closed at $${lastPrice.toFixed(2)}`, 'success');

            const pnl = position.unrealizedPnL || 0;
            position = null;
            updatePositionUI(null);

            if (pnl > 0) addToLog(`💰 Profit: $${pnl.toFixed(2)}`, 'success');
            else if (pnl < 0) addToLog(`📉 Loss: $${pnl.toFixed(2)}`, 'error');

            return true;
        } else {
            addToLog('❌ SDK not available for closing position', 'error');
            return false;
        }

    } catch (error) {
        console.error('Close position error:', error);
        addToLog(`❌ Failed to close position: ${error.message}`, 'error');
        return false;
    }
}

// ── Загрузка реальной позиции ───────────────────────────────

async function loadRealPosition() {
    if (!isLoggedIn || !signerAddress) return;

    try {
        const response = await fetch(
            `${RISEX_API.rest}/v1/account/position?market_id=${currentMarket}&account=${signerAddress}`
        );

        if (!response.ok) return;

        const data = await response.json();

        if (data && (data.size || data.quantity)) {
            const parseValue = (val) => {
                const n = parseFloat(val);
                return n > 1e15 ? n / 1e18 : n;
            };

            position = {
                side: data.side === 0 ? 'long' : 'short',
                size: parseValue(data.size || data.quantity),
                entryPrice: parseValue(data.avg_entry_price || data.entry_price || 0),
                leverage: parseValue(data.leverage || currentLeverage),
                unrealizedPnL: parseValue(data.unrealizedPnL || data.pnl || 0),
                orderId: data.order_id || null,
                timestamp: data.timestamp || Date.now()
            };

            updatePositionUI(position);
            console.log('✅ Real position loaded:', position);
        } else {
            position = null;
        }

    } catch (error) {
        console.warn('Load position error:', error);
    }
}

// ── История ордеров ─────────────────────────────────────────

async function fetchOrderHistory(limit = 10) {
    if (!signerAddress) return [];

    try {
        const response = await fetch(
            `${RISEX_API.rest}/v1/account/orders?account=${signerAddress}&limit=${limit}`
        );

        if (!response.ok) return [];

        const data = await response.json();
        return data.orders || [];

    } catch (error) {
        console.warn('Fetch orders error:', error);
        return [];
    }
}

// ── Экспорты ───────────────────────────────────────────────

window.placeRealOrder     = placeRealOrder;
window.getRealBalance     = getRealBalance;
window.loadRealPosition   = loadRealPosition;
window.closeRealPosition  = closeRealPosition;
window.fetchOrderHistory  = fetchOrderHistory;
window.initRisexClient    = initRisexClient;

console.log('%cReal Trading Module loaded', 'color:#00ff9d;font-weight:bold');
