// ============================================================
// js/risex.js — ПОЛНАЯ ИНТЕГРАЦИЯ С RISEx API
// REST + WebSocket стакан + регистрация signer + ордера
// ============================================================

let _ws            = null;
let _wsReconnTimer = null;
let _obRunning     = false;

// ── Загрузка системного конфига (адреса контрактов) ─────────

async function loadSystemConfig() {
    try {
        const res  = await fetch(`${RISEX_API.rest}/v1/markets`);
        if (!res.ok) return;
        const data = await res.json();
        const markets = data.data?.markets || data.markets || [];
        // Берём адреса контрактов из первого маркета
        if (markets.length > 0) {
            const m = markets[0];
            if (m.config?.quote)            RISEX_CONTRACTS.usdc         = m.config.quote;
            if (m.config?.perps_manager)    RISEX_CONTRACTS.perpsManager  = m.config.perps_manager;
            if (m.config?.authorization)    RISEX_CONTRACTS.authorization = m.config.authorization;
        }
        // Сохраняем полный список маркетов для использования
        window._risexMarkets = markets;
        addToLog(t('config_loaded'), 'meta');

    } catch (e) {
        addToLog('⚙️ RISEx config: ' + e.message.slice(0,40), 'meta');
    }
}

// ── Регистрация signer (один раз при первом входе) ──────────
// Схема: подписываем EIP-712 сообщение кошельком пользователя
// и отправляем в API — после этого API принимает ордера от этого адреса

async function registerSigner(uid) {
    if (userWallet.signerRegistered) return true;

    // Ждём пока адрес точно загрузится
    let attempts = 0;
    while (!userWallet.address && attempts < 10) {
        await new Promise(r => setTimeout(r, 300));
        attempts++;
    }
    if (!userWallet.address) {
        console.warn('registerSigner: адрес кошелька не загружен');
        return false;
    }

    const ok = await unlockSigner(uid);
    if (!ok) return false;

    // Сохраняем адрес локально чтобы не потерять
    const account = userWallet.address;
    console.log('registerSigner: account =', account);

    try {
        addToLog(t('signer_reg'), 'meta');

        const nonce = Math.floor(Date.now() / 1000).toString();

        const domain = { name: 'RISE', version: '1', chainId: RISE_CHAIN.chainId };

        const accountTypes = {
            AuthorizeAddress: [
                { name: 'authorizedAddress', type: 'address' },
                { name: 'nonce',             type: 'string'  },
            ]
        };
        const accountSig = await signer.signTypedData(domain, accountTypes, {
            authorizedAddress: account, nonce
        });

        const body = {
            account:           account,
            authorized_signer: account,
            signature:         accountSig,
            nonce
        };
        console.log('register-signer body:', JSON.stringify(body));

        const regRes = await fetch(`${RISEX_API.rest}/v1/auth/register-signer`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body)
        });

        const result = await regRes.json().catch(() => ({}));
        console.log('register-signer response:', regRes.status, result);

        if (regRes.ok || regRes.status === 409) {
            userWallet.signerRegistered = true;
            if (uid) saveWalletLocal(uid);
            addToLog(t('signer_ok'), 'success');
            return true;
        } else {
            const errMsg = result.error?.message || result.message || JSON.stringify(result);
            addToLog('⚠️ Signer ' + regRes.status + ': ' + errMsg.slice(0,80), 'meta');
            return false;
        }
    } catch (e) {
        addToLog('⚠️ Signer error: ' + e.message.slice(0, 60), 'meta');
        return false;
    }
}


// ── WebSocket стакан ─────────────────────────────────────────

function startOrderBook(marketId = 1) {
    if (_obRunning) stopOrderBook();
    _obRunning = true;
    _connectWS(marketId);
}

function stopOrderBook() {
    _obRunning = false;
    if (_wsReconnTimer) { clearTimeout(_wsReconnTimer); _wsReconnTimer = null; }
    if (_ws) { try { _ws.close(); } catch {} _ws = null; }
    const live = document.getElementById('ob-live');
    if (live) { live.textContent = 'OFF'; live.style.color = 'var(--red)'; }
}

function _connectWS(marketId) {
    if (!_obRunning) return;
    try {
        _ws = new WebSocket(RISEX_API.ws);

        _ws.onopen = () => {
            addToLog('📡 WebSocket подключён', 'meta');
            const live = document.getElementById('ob-live');
            if (live) { live.textContent = 'LIVE'; live.style.color = 'var(--green)'; }
            // Подписка на стакан и сделки
            _ws.send(JSON.stringify({
                channel: 'orderbook', market_ids: [marketId] }));
            _ws.send(JSON.stringify({
                channel: 'trades', market_ids: [marketId] }));
            _ws.send(JSON.stringify({
                channel: 'ticker', market_ids: [marketId] }));
            // Если авторизован — приватные каналы
            if (isLoggedIn && userWallet.address) {
                _ws.send(JSON.stringify({
                    channel: 'positions', account: userWallet.address }));
            }
        };

        _ws.onmessage = (e) => {
            try { _handleWsMessage(JSON.parse(e.data)); } catch {}
        };

        _ws.onclose = () => {
            if (!_obRunning) return;
            const live = document.getElementById('ob-live');
            if (live) { live.textContent = 'RECONN'; live.style.color = 'var(--orange)'; }
            _wsReconnTimer = setTimeout(() => _connectWS(marketId), 3000);
        };

        _ws.onerror = () => { try { _ws.close(); } catch {} };

    } catch (e) {
        addToLog('❌ WS ошибка: ' + e.message, 'error');
        _wsReconnTimer = setTimeout(() => _connectWS(marketId), 5000);
    }
}

function _handleWsMessage(msg) {
    if (!msg || !msg.channel) return;

    if (msg.channel === 'orderbook') {
        renderOrderBook(msg.data || msg);
    } else if (msg.channel === 'trades') {
        renderTrades(msg.data || msg.trades || []);
    } else if (msg.channel === 'ticker') {
        const d = msg.data || msg;
        updateTickerUI(d);
    } else if (msg.channel === 'positions') {
        const d = msg.data || msg;
        if (d) updatePositionUI(d);
    }
}

// ── Рендер стакана ───────────────────────────────────────────

function renderOrderBook(data) {
    if (!data) return;
    const asks = data.asks || [];
    const bids = data.bids || [];

    // Нормализуем цены (могут быть в 1e18)
    const norm = (v) => {
        const n = parseFloat(v);
        return n > 1e15 ? n / 1e18 : n;
    };

    const asksEl = document.getElementById('asks-container');
    const bidsEl = document.getElementById('bids-container');
    if (!asksEl || !bidsEl) return;

    // Максимальный объём для depth bar
    const allSizes = [...asks, ...bids].map(r => parseFloat(r.quantity || r.size || 0));
    const maxSize  = Math.max(...allSizes, 1);

    // ASKS (красные) — рисуем снизу вверх
    const asksSorted = [...asks].sort((a, b) => norm(a.price) - norm(b.price));
    asksEl.innerHTML = '';
    asksSorted.slice(0, 10).forEach(level => {
        const price = norm(level.price);
        const size  = parseFloat(level.quantity || level.size || 0);
        const total = price * size;
        const pct   = (size / maxSize * 100).toFixed(1);
        const row   = document.createElement('div');
        row.className = 'ob-row';
        row.innerHTML = `
            <span class="ob-price">${price.toFixed(1)}</span>
            <span class="ob-size">${size.toFixed(4)}</span>
            <span class="ob-total">${total.toFixed(2)}</span>
            <div class="ob-depth-bar" style="width:${pct}%"></div>`;
        row.onclick = () => {
            const inp = document.getElementById('amount-input');
            if (inp) inp.value = size.toFixed(2);
        };
        asksEl.appendChild(row);
    });

    // BIDS (зелёные)
    const bidsSorted = [...bids].sort((a, b) => norm(b.price) - norm(a.price));
    bidsEl.innerHTML = '';
    bidsSorted.slice(0, 10).forEach(level => {
        const price = norm(level.price);
        const size  = parseFloat(level.quantity || level.size || 0);
        const total = price * size;
        const pct   = (size / maxSize * 100).toFixed(1);
        const row   = document.createElement('div');
        row.className = 'ob-row';
        row.innerHTML = `
            <span class="ob-price">${price.toFixed(1)}</span>
            <span class="ob-size">${size.toFixed(4)}</span>
            <span class="ob-total">${total.toFixed(2)}</span>
            <div class="ob-depth-bar" style="width:${pct}%"></div>`;
        row.onclick = () => {
            const inp = document.getElementById('amount-input');
            if (inp) inp.value = size.toFixed(2);
        };
        bidsEl.appendChild(row);
    });

    // Спред
    if (asksSorted.length && bidsSorted.length) {
        const bestAsk  = norm(asksSorted[0].price);
        const bestBid  = norm(bidsSorted[0].price);
        const spread   = (bestAsk - bestBid).toFixed(1);
        const spreadEl = document.getElementById('spread-value');
        if (spreadEl) spreadEl.textContent = spread + ' USDC';

        // Обновляем цену из стакана если нет тикера
        if (lastPrice === 0) {
            lastPrice = (bestAsk + bestBid) / 2;
            updatePriceUI(lastPrice);
        }
    }
}

function renderTrades(trades) {
    const el = document.getElementById('trades-container');
    if (!el || !trades.length) return;

    const norm = v => { const n = parseFloat(v); return n > 1e15 ? n / 1e18 : n; };

    // Добавляем только новые сделки сверху
    trades.slice(0, 5).forEach(trade => {
        const price = norm(trade.price);
        const size  = parseFloat(trade.quantity || trade.size || 0);
        const side  = (trade.side === 0 || trade.side === 'buy' || trade.taker_side === 0)
                      ? 'buy' : 'sell';
        const time  = trade.timestamp
            ? new Date(trade.timestamp).toLocaleTimeString('ru-RU',
                { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : new Date().toLocaleTimeString('ru-RU',
                { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const row = document.createElement('div');
        row.className = `trade-row ${side}`;
        row.innerHTML = `
            <span class="t-price">${price.toFixed(1)}</span>
            <span class="t-size">${size.toFixed(4)}</span>
            <span class="t-time">${time}</span>`;
        el.prepend(row);
    });

    // Оставляем только последние 30
    while (el.children.length > 30) el.removeChild(el.lastChild);
}

function updateTickerUI(data) {
    if (!data) return;
    const norm = v => { const n = parseFloat(v); return n > 1e15 ? n / 1e18 : n; };

    if (data.mark_price || data.last_price || data.price) {
        const price = norm(data.mark_price || data.last_price || data.price);
        if (price > 0) { lastPrice = price; updatePriceUI(price); }
    }
    if (data.funding_rate !== undefined) {
        const fr    = (parseFloat(data.funding_rate) * 100).toFixed(4);
        const frEl  = document.getElementById('funding-rate');
        if (frEl) frEl.textContent = `FR: ${fr}%`;
    }
}

// ── Размещение ордера ────────────────────────────────────────

async function placeOrder(side, amountUsdc, leverage, uid) {
    if (!isLoggedIn || !userWallet.address) {
        addToLog(t('login_required'), 'error'); return false;
    }

    // Разблокируем подписант
    const ok = await unlockSigner(uid);
    if (!ok) return false;

    // Регистрируем если ещё нет
    if (!userWallet.signerRegistered) {
        await registerSigner(uid);
    }

    try {
        addToLog(`🚀 ${side} ${amountUsdc} USDC ×${leverage}...`, 'pending');

        // Получаем лучшую цену из стакана
        const price = lastPrice || await fetchMarkPrice();
        if (!price) { addToLog('❌ Не удалось получить цену', 'error'); return false; }

        // Для рыночного ордера — скользим на 0.5%
        const execPrice = side === 'LONG'
            ? price * 1.005
            : price * 0.995;

        // Размер позиции = (amount * leverage) / price
        const positionSize = (amountUsdc * leverage) / price;

        // Timestamp + expiry (28 дней для testnet)
        const now    = Date.now();
        const expiry = now + 28 * 24 * 60 * 60 * 1000;

        // EIP-712 подпись ордера
        const domain = {
            name:    'RISEx',
            version: '1',
            chainId: RISE_CHAIN.chainId,
        };
        const orderTypes = {
            Order: [
                { name: 'market_id',   type: 'uint32'  },
                { name: 'account',     type: 'address' },
                { name: 'side',        type: 'uint8'   },
                { name: 'quantity',    type: 'uint128'  },
                { name: 'price',       type: 'uint128'  },
                { name: 'order_type',  type: 'uint8'   },
                { name: 'leverage',    type: 'uint32'  },
                { name: 'nonce',       type: 'uint64'  },
                { name: 'expiry',      type: 'uint64'  },
            ]
        };

        // Конвертируем в wei-формат (1e18)
        const qtyWei   = BigInt(Math.floor(positionSize * 1e18));
        const priceWei = BigInt(Math.floor(execPrice * 1e18));

        const orderValue = {
            market_id:  currentMarket,
            account:    userWallet.address,
            side:       side === 'LONG' ? 0 : 1,
            quantity:   qtyWei,
            price:      priceWei,
            order_type: 1,   // Market
            leverage:   leverage,
            nonce:      BigInt(now),
            expiry:     BigInt(expiry),
        };

        const signature = await signer.signTypedData(domain, orderTypes, orderValue);

        // Отправляем ордер
        const res = await fetch(`${RISEX_API.rest}/v1/orders/place`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                market_id:  currentMarket,
                account:    userWallet.address,
                side:       side === 'LONG' ? 0 : 1,
                quantity:   qtyWei.toString(),
                price:      priceWei.toString(),
                order_type: 1,
                leverage:   leverage,
                nonce:      now.toString(),
                expiry:     expiry.toString(),
                signature
            })
        });

        const result = await res.json().catch(() => ({}));

        if (res.ok) {
            const orderId = result.order_id || result.id || '?';
            addToLog(`✅ ${side} исполнен! ID: ${orderId}`, 'success');
            addToLog(`💰 ${amountUsdc} USDC × ${leverage}x = ~${(positionSize).toFixed(6)} BTC`, 'meta');

            // Обновляем локальную позицию
            position = {
                side:       side.toLowerCase(),
                size:       positionSize,
                entryPrice: price,
                leverage:   leverage,
                orderId
            };
            updatePositionUI(position);
            await fetchBalance();
            saveStats(side, amountUsdc * leverage, true);
            return true;
        } else {
            const msg = result.message || result.error || result.detail || JSON.stringify(result);
            addToLog(`❌ Ошибка ордера: ${String(msg).slice(0, 80)}`, 'error');
            return false;
        }

    } catch (e) {
        addToLog('❌ ' + (e.message || e).toString().slice(0, 80), 'error');
        return false;
    }
}

// ── Закрытие позиции (reduce-only) ──────────────────────────

async function closePosition() {
    if (!position || position.size <= 0) {
        addToLog('⚠️ Нет позиции для закрытия', 'warning'); return;
    }
    const closeSide = position.side === 'long' ? 'SHORT' : 'LONG';
    addToLog(`🔄 Закрываем позицию (${closeSide})...`, 'pending');
    // Для закрытия отправляем тот же размер в обратную сторону
    await placeOrder(closeSide, position.size * lastPrice, 1, currentUser.uid);
    position = { side: null, size: 0, entryPrice: 0, leverage: 1 };
    updatePositionUI(null);
}

// ── Получить mark price напрямую через REST ──────────────────

async function fetchMarkPrice() {
    try {
        const res  = await fetch(`${RISEX_API.rest}/v1/markets`);
        if (!res.ok) return null;
        const data = await res.json();
        const markets = data.data?.markets || data.markets || [];
        const market  = markets.find(m => String(m.market_id) === String(currentMarket));
        if (!market) return null;
        const norm = v => { const n = parseFloat(v); return n > 1e15 ? n / 1e18 : n; };
        return norm(
            market.mark_price || market.last_price ||
            market.ticker?.mark_price || market.ticker?.last_price || 0
        );
    } catch { return null; }
}

// ── Загрузить позицию из API ─────────────────────────────────

async function fetchPosition() {
    if (!isLoggedIn || !userWallet.address) return;
    try {
        const res = await fetch(
            `${RISEX_API.rest}/v1/account/position?market_id=${currentMarket}&account=${userWallet.address}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && (data.size || data.quantity)) {
            const norm = v => { const n = parseFloat(v); return n > 1e15 ? n / 1e18 : n; };
            position = {
                side:       data.side === 0 ? 'long' : 'short',
                size:       norm(data.size || data.quantity),
                entryPrice: norm(data.avg_entry_price || data.entry_price || 0),
                leverage:   data.leverage || currentLeverage
            };
            updatePositionUI(position);
        }
    } catch {}
}

window.loadSystemConfig  = loadSystemConfig;
window.registerSigner    = registerSigner;
window.startOrderBook    = startOrderBook;
window.stopOrderBook     = stopOrderBook;
window.renderOrderBook   = renderOrderBook;
window.renderTrades      = renderTrades;
window.placeOrder        = placeOrder;
window.closePosition     = closePosition;
window.fetchMarkPrice    = fetchMarkPrice;
window.fetchPosition     = fetchPosition;
console.log('%cRISEx loaded', 'color:#00ff9d');
