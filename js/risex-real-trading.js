// ============================================================
// js/risex-real-trading.js — REAL TRADING MODULE
// ============================================================
// Rise Mainnet (chainId 4153)
// Баланс: /v1/account/balance (сырой ончейн-баланс кошелька signerAddress)
// Торговля: собственная EIP-712 подпись (см. RISEX_CORE_SPEC.md), без
// внешнего SDK — risex-client не имеет браузерной UMD-сборки (проверено
// в npm registry: только dist/cjs и dist/esm, CDN-тег на UMD всегда 404).
// ============================================================

// ── Получение реального баланса ─────────────────────────────

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

        const raw = await response.json();
        console.log('📊 Raw balance response:', raw);

        // apiGetBalanceResponse: { balance: "<uint256 as string>" } — сырой
        // баланс кошелька в блокчейне (ERC-20 balanceOf), НЕ equity биржевого
        // аккаунта. См. RISEX_CORE_SPEC.md §2.
        const rawBalance = raw.balance ?? raw.data?.balance ?? '0';

        // USDC = 6 знаков после запятой
        let balance = parseFloat(rawBalance) / 1e6;
        if (isNaN(balance) || balance < 0) balance = 0;

        console.log('✅ Real USDC Balance loaded:', balance, 'USDC');
        return balance;

    } catch (error) {
        console.error('❌ getRealBalance failed:', error);
        return 0;
    }
}

// ── Размещение реального ордера (собственная подпись) ───────

async function placeRealOrder(side, amountUsdc, leverage) {
    if (!signer || !signerAddress) {
        addToLog('❌ Signer not connected', 'error');
        return false;
    }
    if (!lastPrice || lastPrice <= 0) {
        addToLog('❌ No price data available', 'error');
        return false;
    }

    const realBalance = await getRealBalance();
    if (realBalance < amountUsdc) {
        addToLog(`❌ Insufficient balance. Have: ${realBalance.toFixed(2)}, need: ${amountUsdc}`, 'error');
        return false;
    }

    addToLog('⏳ Placing real order on RISEx...', 'pending');

    try {
        const positionSize = (amountUsdc * leverage) / lastPrice;
        const sideCode = side.toLowerCase() === 'long' ? 0 : 1; // 0=Buy/Long, 1=Sell/Short

        const result = await signAndPlaceOrder({
            marketId:   currentMarket,
            side:       sideCode,
            humanSize:  positionSize,
            humanPrice: lastPrice,
            orderType:  ORDER_TYPE.MARKET,
            timeInForce: TIF.GTC,
        });

        addToLog(`✅ ${side.toUpperCase()} opened at $${lastPrice.toFixed(2)}`, 'success');
        addToLog(`📊 Size: ${positionSize.toFixed(6)} × ${leverage}x`, 'success');
        if (result?.order_id) addToLog(`📋 Order ID: ${result.order_id}`, 'meta');

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

    } catch (error) {
        console.error('Place order error:', error);
        addToLog(`❌ Failed to place order: ${error.message}`, 'error');
        return false;
    }
}

// ── Закрытие позиции: reduce-only market-ордер в обратную сторону ─

async function closeRealPosition() {
    if (!position || !position.size || position.size <= 0) {
        addToLog('❌ No open position', 'error');
        return false;
    }
    if (!lastPrice || lastPrice <= 0) {
        addToLog('❌ No price data available', 'error');
        return false;
    }

    addToLog('⏳ Closing position on RISEx...', 'pending');

    try {
        const closeSideCode = position.side === 'long' ? 1 : 0; // закрываем встречным ордером

        const result = await signAndPlaceOrder({
            marketId:    currentMarket,
            side:        closeSideCode,
            humanSize:   position.size,
            humanPrice:  lastPrice,
            orderType:   ORDER_TYPE.MARKET,
            timeInForce: TIF.GTC,
            reduceOnly:  true,
        });

        const pnl = position.side === 'long'
            ? (lastPrice - position.entryPrice) * position.size * position.leverage
            : (position.entryPrice - lastPrice) * position.size * position.leverage;

        addToLog(`✅ Position closed at $${lastPrice.toFixed(2)}`, 'success');
        if (pnl > 0) addToLog(`💰 Profit: $${pnl.toFixed(2)}`, 'success');
        else if (pnl < 0) addToLog(`📉 Loss: $${pnl.toFixed(2)}`, 'error');
        if (result?.order_id) addToLog(`📋 Order ID: ${result.order_id}`, 'meta');

        position = null;
        updatePositionUI(null);
        return true;

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

window.placeRealOrder    = placeRealOrder;
window.getRealBalance    = getRealBalance;
window.loadRealPosition  = loadRealPosition;
window.closeRealPosition = closeRealPosition;
window.fetchOrderHistory = fetchOrderHistory;

console.log('%cReal Trading Module loaded', 'color:#00ff9d;font-weight:bold');
