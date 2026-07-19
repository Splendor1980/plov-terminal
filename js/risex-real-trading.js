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
    const account = riseAccountAddress || signerAddress;
    if (!account) {
        console.warn('getRealBalance: no signer connected yet');
        return 0;
    }

    try {
        // Подтверждено вживую: /v1/account/cross-margin-balance возвращает
        // {"data":{"balance":"6.996176654671112539"}} — реальный Equity/коллатерал
        // аккаунта (то, что на сайте показано как Acct. Equity), уже в human-readable
        // формате (НЕ wei, делить не нужно). Старый /v1/account/balance — это сырой
        // ончейн-баланс кошелька (ERC-20), не то, что нужно для трейдинга — см. RISEX_CORE_SPEC.md §2.
        const url = `${RISEX_API.rest}/v1/account/cross-margin-balance?account=${account}`;

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

        const rawBalance = raw.data?.balance ?? raw.balance ?? '0';
        let balance = parseFloat(rawBalance);
        if (isNaN(balance) || balance < 0) balance = 0;

        console.log('✅ Real USDC Balance loaded:', balance, 'USDC');
        return balance;

    } catch (error) {
        console.error('❌ getRealBalance failed:', error);
        return 0;
    }
}

// ── Размещение реального ордера (собственная подпись) ───────

async function placeRealOrder(side, amountUsdc, leverage, orderTypeStr = 'market', limitPrice = null) {
    if (!signer || !signerAddress) {
        addToLog('❌ Signer not connected', 'error');
        return false;
    }
    if (!lastPrice || lastPrice <= 0) {
        addToLog('❌ No price data available', 'error');
        return false;
    }
    const isLimit = orderTypeStr === 'limit';
    if (isLimit && (!limitPrice || limitPrice <= 0)) {
        addToLog('❌ Limit price required', 'error');
        return false;
    }

    if (typeof fetchBalance === 'function') await fetchBalance();
    const realBalance = userWallet.risexBalance ?? await getRealBalance();
    if (realBalance < amountUsdc) {
        addToLog(`❌ Insufficient balance. Have: ${realBalance.toFixed(2)}, need: ${amountUsdc}`, 'error');
        return false;
    }

    addToLog(isLimit ? '⏳ Placing limit order on RISEx...' : '⏳ Placing real order on RISEx...', 'pending');

    try {
        const execPrice     = isLimit ? limitPrice : lastPrice;
        const positionSize  = (amountUsdc * leverage) / execPrice;
        const sideCode      = side.toLowerCase() === 'long' ? 0 : 1; // 0=Buy/Long, 1=Sell/Short

        const result = await signAndPlaceOrder({
            marketId:    currentMarket,
            side:        sideCode,
            humanSize:   positionSize,
            humanPrice:  execPrice,
            orderType:   isLimit ? ORDER_TYPE.LIMIT : ORDER_TYPE.MARKET,
            timeInForce: isLimit ? TIF.GTC : TIF.IOC, // маркет требует FOK/IOC; лимит обычно GTC
        });

        if (result?.order_id) addToLog(`📋 Order ID: ${result.order_id}`, 'meta');

        if (isLimit) {
            // Лимитный ордер может просто повиснуть в стакане, а не исполниться
            // сразу — в отличие от market/IOC (подтверждено вживую). Поэтому НЕ
            // считаем позицию открытой заранее, только логируем размещение.
            addToLog(`✅ Limit ${side.toUpperCase()} order placed @ $${execPrice.toFixed(2)}`, 'success');
            addToLog(`📊 Size: ${positionSize.toFixed(6)} × ${leverage}x (resting, ждёт исполнения)`, 'meta');
            setTimeout(() => {
                if (typeof loadRealPosition === 'function') loadRealPosition();
                if (typeof fetchOpenOrders   === 'function') fetchOpenOrders();
            }, 2000);
            return true;
        }

        addToLog(`✅ ${side.toUpperCase()} opened at $${execPrice.toFixed(2)}`, 'success');
        addToLog(`📊 Size: ${positionSize.toFixed(6)} × ${leverage}x`, 'success');

        position = {
            side: side.toLowerCase(),
            size: positionSize,
            entryPrice: execPrice,
            leverage: leverage,
            margin: amountUsdc,
            orderId: result?.order_id || null,
            timestamp: Date.now()
        };

        updatePositionUI(position);
        saveStats(side, amountUsdc * leverage, true);

        if (typeof addMyTrade === 'function') {
            addMyTrade(side, execPrice, positionSize, leverage, result?.order_id);
        }

        if (typeof fetchBalance === 'function') fetchBalance();
        setTimeout(() => { if (typeof syncMyTrades === 'function') syncMyTrades(); }, 1500);

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
            timeInForce: TIF.IOC, // маркет-ордера требуют FOK/IOC, GTC не принимается
            reduceOnly:  true,
        });

        const pnl = position.side === 'long'
            ? (lastPrice - position.entryPrice) * position.size
            : (position.entryPrice - lastPrice) * position.size;

        addToLog(`✅ Position closed at $${lastPrice.toFixed(2)}`, 'success');
        const pnlAbs = Math.abs(pnl).toFixed(Math.abs(pnl) < 1 ? 4 : 2);
        if (pnl > 0) addToLog(`💰 Profit: $${pnlAbs}`, 'success');
        else if (pnl < 0) addToLog(`📉 Loss: $${pnlAbs}`, 'error');
        if (result?.order_id) addToLog(`📋 Order ID: ${result.order_id}`, 'meta');

        position = null;
        updatePositionUI(null);
        if (typeof fetchBalance === 'function') fetchBalance();
        setTimeout(() => { if (typeof syncMyTrades === 'function') syncMyTrades(); }, 1500);
        return true;

    } catch (error) {
        console.error('Close position error:', error);
        addToLog(`❌ Failed to close position: ${error.message}`, 'error');
        return false;
    }
}

// ── Загрузка реальной позиции ───────────────────────────────

async function loadRealPosition() {
    const account = riseAccountAddress || signerAddress;
    if (!isLoggedIn || !account) return;

    try {
        const response = await fetch(
            `${RISEX_API.rest}/v1/account/position?market_id=${currentMarket}&account=${account}`
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
    const account = riseAccountAddress || signerAddress;
    if (!account) return [];

    try {
        const response = await fetch(
            `${RISEX_API.rest}/v1/account/orders?account=${account}&limit=${limit}`
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

// ── Открытые (незаполненные/частично заполненные) ордера ────
// GET /v1/orders/open?account=&market_id= — точный путь и форма ответа
// подтверждены исходниками официального SDK (getOpenOrders).

async function fetchOpenOrders() {
    const account = riseAccountAddress || signerAddress;
    const listEl  = document.getElementById('open-orders-list');
    if (!account) return [];

    try {
        const res = await fetch(`${RISEX_API.rest}/v1/orders/open?account=${account}&market_id=${currentMarket}`);
        if (!res.ok) { if (listEl) listEl.innerHTML = '<div class="no-trades muted">No open orders</div>'; return []; }
        const raw = await res.json();
        const orders = raw.data?.orders || raw.orders || [];
        renderOpenOrders(orders);
        return orders;
    } catch (e) {
        console.warn('fetchOpenOrders error:', e);
        return [];
    }
}

function renderOpenOrders(orders) {
    const listEl = document.getElementById('open-orders-list');
    if (!listEl) return;

    if (!orders.length) {
        listEl.innerHTML = '<div class="no-trades muted">No open orders</div>';
        return;
    }

    listEl.innerHTML = orders.map(o => {
        const m         = getMarketConfig(o.market_id);
        const stepPrice = parseFloat(m?.config?.step_price || '0.1') || 0.1;
        const stepSize  = parseFloat(m?.config?.step_size  || '0.001') || 0.001;
        const price     = (o.price_ticks * stepPrice).toFixed(2);
        const size      = (o.size_steps  * stepSize).toFixed(6);
        const sideLabel = o.side === 0 ? 'LONG' : 'SHORT';
        const restingId = o.resting_order_id ?? o.order_id;

        return `<div class="my-trade-row">
            <span class="mt-side ${o.side === 0 ? 'green' : 'red'}">${sideLabel}</span>
            <span class="mt-price">${price}</span>
            <span class="mt-size">${size}</span>
            <span class="mt-lev">${o.reduce_only ? 'reduce' : '—'}</span>
            <button class="btn-sm btn-red" style="padding:2px 8px;font-size:11px;"
                onclick="cancelOpenOrder(${o.market_id}, '${o.order_id}', '${restingId}')">✕</button>
        </div>`;
    }).join('');
}

async function cancelOpenOrder(marketId, orderId, restingOrderId) {
    if (typeof signAndCancelOrder !== 'function') return;
    addToLog('⏳ Cancelling order...', 'pending');
    try {
        await signAndCancelOrder(marketId, orderId, restingOrderId);
        addToLog('✅ Order cancelled', 'success');
    } catch (e) {
        console.error('Cancel order error:', e);
        const msg = String(e.message || '');
        if (/not open/i.test(msg)) {
            // Ордер уже не в состоянии "open" (исполнился или отменён где-то
            // ещё, наш список успел устареть) — не пугаем ошибкой, просто
            // обновляем список и позицию (вдруг это стало реальной позицией).
            addToLog('ℹ️ Order already closed/filled — refreshing', 'meta');
        } else {
            addToLog(`❌ Cancel failed: ${e.message}`, 'error');
        }
    } finally {
        fetchOpenOrders();
        if (typeof loadRealPosition === 'function') loadRealPosition();
    }
}

// ── История сделок с биржи (источник правды) ────────────────
// GET /v1/trade-history?account=&limit= — реальные исполненные fill'ы,
// путь и форма подтверждены исходниками официального SDK (getAccountTradeHistory).
// В отличие от локального myTrades (который живёт только в этом браузере
// и пропадает/расходится с реальностью при закрытии вкладки до синхронизации),
// это правда с сервера.

async function fetchTradeHistory(limit = 30) {
    const account = riseAccountAddress || signerAddress;
    if (!account) return [];

    try {
        const res = await fetch(`${RISEX_API.rest}/v1/trade-history?account=${account}&limit=${limit}`);
        if (!res.ok) return [];
        const raw  = await res.json();
        const rows = raw.data ?? raw;
        const fills = Array.isArray(rows) ? rows : (Array.isArray(rows?.data) ? rows.data : []);

        return fills.map(f => ({
            side:     f.side === 0 ? 'LONG' : 'SHORT',
            price:    parseFloat(f.price) || 0,
            size:     parseFloat(f.size)  || 0,
            leverage: null, // недоступно на уровне отдельного fill'а — не показываем то, чего не знаем
            pnl:      null, // realized PnL — отдельный агрегированный эндпоинт, не по каждой сделке
            time:     new Date(Number(BigInt(f.timestamp || '0') / 1_000_000n) || Date.now()),
            orderId:  f.order_id,
        }));
    } catch (e) {
        console.warn('fetchTradeHistory error:', e);
        return [];
    }
}

async function syncMyTrades() {
    const fills = await fetchTradeHistory(30);
    if (!fills.length) return;
    if (typeof window.setMyTradesFromServer === 'function') {
        window.setMyTradesFromServer(fills);
    }
}

window.fetchTradeHistory = fetchTradeHistory;
window.syncMyTrades      = syncMyTrades;

window.fetchOpenOrders = fetchOpenOrders;
window.cancelOpenOrder = cancelOpenOrder;

console.log('%cReal Trading Module loaded', 'color:#00ff9d;font-weight:bold');
