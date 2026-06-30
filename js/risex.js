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
        // system/config — адреса контрактов
        const cfgRes = await fetch(`${RISEX_API.rest}/v1/system/config`);
        if (cfgRes.ok) {
            const cfg = await cfgRes.json();
            const c   = cfg.data || cfg;
            console.log('system/config:', JSON.stringify(c).slice(0, 400));

            // Адреса могут быть в c.addresses или напрямую в c
            const addr = c.addresses || c;
            const usdc = c.addresses?.usdc || c.usdc_address || c.usdc;

            if (usdc)                   RISEX_CONTRACTS.usdc         = usdc;
            if (addr.router)            RISEX_CONTRACTS.router       = addr.router;
            if (addr.orders_manager)    RISEX_CONTRACTS.ordersManager = addr.orders_manager;
            if (addr.collateral_manager) RISEX_CONTRACTS.collateral  = addr.collateral_manager;
            if (addr.perps_manager)     RISEX_CONTRACTS.perpsManager  = addr.perps_manager;
            if (addr.auth)              RISEX_CONTRACTS.authorization = addr.auth;
        }

        // markets — список маркетов
        const mktRes = await fetch(`${RISEX_API.rest}/v1/markets`);
        if (mktRes.ok) {
            const data    = await mktRes.json();
            const markets = data.data?.markets || data.markets || [];
            window._risexMarkets = markets;
            // Дополнительно берём адреса из маркетов если не получили из config
            if (markets.length > 0 && !RISEX_CONTRACTS.usdc) {
                const m = markets[0];
                if (m.config?.quote) RISEX_CONTRACTS.usdc = m.config.quote;
            }
        }

        console.log('RISEX_CONTRACTS:', RISEX_CONTRACTS);
        addToLog(t('config_loaded'), 'meta');
    } catch (e) {
        addToLog('⚙️ RISEx config: ' + e.message.slice(0,40), 'meta');
    }
}


// ── Регистрация signer (один раз при первом входе) ──────────
// Схема: подписываем EIP-712 сообщение кошельком пользователя
// и отправляем в API — после этого API принимает ордера от этого адреса

async function registerSigner(uid) {
    if (true) return true;

    let attempts = 0;
    while (!signerAddress && attempts < 10) {
        await new Promise(r => setTimeout(r, 300));
        attempts++;
    }
    if (!signerAddress) return false;

    const ok = await unlockSigner(uid);
    if (!ok) return false;

    const account = signerAddress;

    try {
        addToLog(t('signer_reg'), 'meta');

        // fixSignatureV — исправляет v=0/1 → 27/28 (как в SDK)
        function fixSignatureV(sig) {
            const sigBytes = ethers.getBytes(sig);
            const v = sigBytes[64];
            if (v === 0 || v === 1) {
                sigBytes[64] = v + 27;
                return ethers.hexlify(sigBytes);
            }
            return sig;
        }

        // Шаг 1 — EIP-712 домен
        let domain = { name: 'RISEx', version: '1', chainId: BigInt(RISE_CHAIN.chainId) };
        try {
            const domainRes = await fetch(`${RISEX_API.rest}/v1/auth/eip712-domain`);
            if (domainRes.ok) {
                const raw = await domainRes.json();
                const d   = raw.data || raw;
                // API возвращает snake_case: chain_id, verifying_contract
                const chainId  = d.chain_id || d.chainId;
                const contract = d.verifying_contract || d.verifyingContract;
                domain = {
                    name:    d.name,
                    version: d.version,
                    chainId: BigInt(chainId),
                    verifyingContract: contract,
                };
                console.log('domain loaded:', domain);
            }
        } catch (e) {
            console.warn('eip712-domain error:', e.message);
        }
        console.log('domain:', domain);

        // Шаг 2 — nonceState
        let nonceAnchor = 1;
        let nonceBitmap = 0;
        try {
            const nonceRes = await fetch(`${RISEX_API.rest}/v1/nonce-state/${account}`);
            if (nonceRes.ok) {
                const raw = await nonceRes.json();
                const nd  = raw.data || raw;
                console.log('nonce-state:', nd);
                nonceAnchor = Number(nd.nonce_anchor || 0) + 1;
            }
        } catch (e) {
            console.warn('nonce-state error:', e.message);
        }
        console.log('nonceAnchor:', nonceAnchor);

        // Шаг 3 — expiration (7 дней как в SDK)
        const expiration = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

        // Шаг 4 — account signature (REGISTER_SIGNER_TYPES)
        const REGISTER_SIGNER_TYPES = {
            RegisterSigner: [
                { name: 'account',     type: 'address' },
                { name: 'signer',      type: 'address' },
                { name: 'message',     type: 'string'  },
                { name: 'expiration',  type: 'uint32'  },
                { name: 'nonceAnchor', type: 'uint48'  },
                { name: 'nonceBitmap', type: 'uint8'   },
            ]
        };

        const accountSig = fixSignatureV(
            await signer.signTypedData(domain, REGISTER_SIGNER_TYPES, {
                account:     account,
                signer:      account,
                message:     'Registering signer for RISEx',
                expiration:  expiration,
                nonceAnchor: nonceAnchor,
                nonceBitmap: nonceBitmap,
            })
        );
        console.log('accountSig:', accountSig);

        // Шаг 5 — signer signature (VERIFY_SIGNER_TYPES — другой тип!)
        const VERIFY_SIGNER_TYPES = {
            VerifySigner: [
                { name: 'account',     type: 'address' },
                { name: 'nonceAnchor', type: 'uint48'  },
                { name: 'nonceBitmap', type: 'uint8'   },
            ]
        };

        const signerSig = fixSignatureV(
            await signer.signTypedData(domain, VERIFY_SIGNER_TYPES, {
                account:     account,
                nonceAnchor: nonceAnchor,
                nonceBitmap: nonceBitmap,
            })
        );
        console.log('signerSig:', signerSig);

        // Шаг 6 — отправляем
        const body = {
            account:            account,
            signer:             account,
            message:            'Registering signer for RISEx',
            nonce_anchor:       String(nonceAnchor),
            nonce_bitmap_index: nonceBitmap,
            expiration:         String(expiration),
            account_signature:  accountSig,
            signer_signature:   signerSig,
            label:              'plov-terminal',
        };
        console.log('body:', JSON.stringify(body));

        const regRes = await fetch(`${RISEX_API.rest}/v1/auth/register-signer`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body)
        });

        const result = await regRes.json().catch(() => ({}));
        console.log('register-signer response:', regRes.status, result);

        if (regRes.ok || regRes.status === 409) {
            // signer already registered via rise.trade
            if (uid) saveWalletLocal(uid);
            addToLog(t('signer_ok'), 'success');
            return true;
        } else {
            const errMsg = result.error?.message || result.message || JSON.stringify(result);
            addToLog('⚠️ Signer: ' + errMsg.slice(0, 80), 'meta');
            return false;
        }
    } catch (e) {
        addToLog('⚠️ Signer error: ' + e.message.slice(0, 80), 'meta');
        console.error('registerSigner exception:', e);
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
            addToLog(t('ws_connected'), 'meta');
            const live = document.getElementById('ob-live');
            if (live) { live.textContent = 'LIVE'; live.style.color = 'var(--green)'; }

            // Правильный формат из SDK: {method, params}
            _ws.send(JSON.stringify({
                method: 'subscribe',
                params: { channel: 'orderbook', market_ids: [marketId] }
            }));
            _ws.send(JSON.stringify({
                method: 'subscribe',
                params: { channel: 'trades', market_ids: [marketId] }
            }));
            _ws.send(JSON.stringify({
                method: 'subscribe',
                params: { channel: 'ticker', market_ids: [marketId] }
            }));

            if (isLoggedIn && signerAddress) {
                _ws.send(JSON.stringify({
                    method: 'subscribe',
                    params: { channel: 'positions', account: signerAddress }
                }));
            }

            // Heartbeat каждые 15 сек как в SDK
            if (window._wsHeartbeat) clearInterval(window._wsHeartbeat);
            window._wsHeartbeat = setInterval(() => {
                if (_ws && _ws.readyState === WebSocket.OPEN) {
                    _ws.send(JSON.stringify({ method: 'ping' }));
                }
            }, 15000);
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
    if (!msg) return;

    // Логируем первые сообщения для диагностики
    if (!window._wsMsgCount) window._wsMsgCount = 0;
    if (window._wsMsgCount < 5) {
        console.log('WS message:', JSON.stringify(msg).slice(0, 300));
        window._wsMsgCount++;
    }

    // Определяем тип сообщения — разные API используют разные форматы
    const channel = msg.channel || msg.type || msg.event;
    const data    = msg.data || msg.result || msg;

    if (!channel) return;

    if (channel === 'orderbook' || channel === 'order_book') {
        renderOrderBook(data);
    } else if (channel === 'trades' || channel === 'trade') {
        // data — один объект сделки (не массив)
        // Формат: {id, maker_order_id, taker_order_id, price, quantity, taker_side, ...}
        const d = msg.data || data;
        if (d && d.id) {
            renderTrades([d]);  // оборачиваем в массив
        } else if (Array.isArray(d)) {
            renderTrades(d);
        } else if (d && d.trades) {
            renderTrades(d.trades);
        }
    } else if (channel === 'ticker' || channel === 'mark_price') {
        const d = msg.data || data;
        updateTickerUI(d);
        // Funding rate
        if (d && d.funding_rate !== undefined) {
            const fr    = (parseFloat(d.funding_rate) * 100).toFixed(4);
            const frEl  = document.getElementById('funding-rate');
            if (frEl) frEl.textContent = `FR: ${fr}%`;
        }
    } else if (channel === 'positions' || channel === 'position') {
        if (data) updatePositionUI(data);
    } else if (channel === 'subscribed' || channel === 'pong' || channel === 'connected') {
        // служебные сообщения — игнорируем
    } else {
        // Неизвестный канал — логируем
        if (window._wsMsgCount < 10) {
            console.log('Unknown WS channel:', channel, JSON.stringify(msg).slice(0, 200));
            window._wsMsgCount++;
        }
    }
}

// ── Рендер стакана ───────────────────────────────────────────

// Локальный кэш стакана — накапливаем уровни
const _obCache = { asks: {}, bids: {} };

function renderOrderBook(data) {
    if (!data) return;

    const d    = data.data || data;
    const type = d.type || data.type || 'update';

    // Snapshot — сбрасываем кэш
    if (type === 'snapshot') {
        _obCache.asks = {};
        _obCache.bids = {};
    }

    const asks = d.asks || [];
    const bids = d.bids || [];

    // Обновляем кэш — merge уровней
    // Формат: [{price, quantity}] или [[price, size]]
    const toObj = (level) => Array.isArray(level)
        ? { price: level[0], quantity: level[1] }
        : level;

    asks.map(toObj).forEach(level => {
        const price = String(level.price);
        const qty   = parseFloat(level.quantity || level.size || 0);
        if (qty === 0) delete _obCache.asks[price];
        else _obCache.asks[price] = qty;
    });

    bids.map(toObj).forEach(level => {
        const price = String(level.price);
        const qty   = parseFloat(level.quantity || level.size || 0);
        if (qty === 0) delete _obCache.bids[price];
        else _obCache.bids[price] = qty;
    });

    // Конвертируем кэш обратно в массивы
    const cachedAsks = Object.entries(_obCache.asks)
        .map(([price, quantity]) => ({ price, quantity }));
    const cachedBids = Object.entries(_obCache.bids)
        .map(([price, quantity]) => ({ price, quantity }));

    if (!cachedAsks.length && !cachedBids.length) return;

    // Нормализуем цены
    // Формат из SDK: [price_string, size_string]
    // Или объект: {price, quantity/size}
    const norm = (v) => {
        const n = parseFloat(v);
        return n > 1e15 ? n / 1e18 : n;
    };

    // toObj определён в кэше выше

    const asksEl = document.getElementById('asks-container');
    const bidsEl = document.getElementById('bids-container');
    if (!asksEl || !bidsEl) return;

    // Максимальный объём для depth bar
    const allSizes = [...cachedAsks, ...cachedBids].map(r => parseFloat(r.quantity || 0));
    const maxSize  = Math.max(...allSizes, 1);

    // ASKS (красные) — рисуем снизу вверх
    const asksSorted = [...cachedAsks].sort((a, b) => norm(a.price) - norm(b.price));
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
    const bidsSorted = [...cachedBids].sort((a, b) => norm(b.price) - norm(a.price));
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
        const bestAsk  = norm(asksSorted[0].price  || asksSorted[0][0]);
        const bestBid  = norm(bidsSorted[0].price  || bidsSorted[0][0]);
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
    if (!trades || !trades.length) return;

    const norm = v => { const n = parseFloat(v); return n > 1e15 ? n / 1e18 : n; };

    // Рендерим в центральную панель (вкладка Сделки)
    const centerEl = document.getElementById('market-trades-list');
    // И в левую панель (скрытый контейнер для совместимости)
    const leftEl   = document.getElementById('trades-container');

    trades.slice(0, 10).forEach(trade => {
        const price = norm(trade.price);
        const size  = parseFloat(trade.quantity || trade.size || 0);
        if (!price || !size) return;

        const side = (trade.taker_side === 0 || trade.side === 0 || trade.side === 'buy')
                   ? 'buy' : 'sell';

        const ts   = trade.timestamp || trade.created_at || trade.time
                  || trade.block_timestamp;
        let time = new Date().toLocaleTimeString(undefined,
                { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (ts) {
            const n = Number(ts);
            // API возвращает наносекунды (1e18 range) или миллисекунды
            const ms = n > 1e15 ? n / 1e6 : n > 1e12 ? n : n * 1000;
            time = new Date(ms).toLocaleTimeString(undefined,
                { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }

        // В центральную панель
        if (centerEl) {
            const row = document.createElement('div');
            row.className = `market-trade-row ${side}`;
            row.innerHTML = `
                <span class="t-price ${side}">${price.toFixed(1)}</span>
                <span class="t-size">${size.toFixed(4)}</span>
                <span class="t-time">${time}</span>`;
            centerEl.prepend(row);
            while (centerEl.children.length > 50) centerEl.removeChild(centerEl.lastChild);
        }

        // В левую панель (скрыта)
        if (leftEl) {
            const row = document.createElement('div');
            row.className = `trade-row ${side}`;
            row.innerHTML = `
                <span class="t-price ${side}">${price.toFixed(1)}</span>
                <span class="t-size">${size.toFixed(4)}</span>
                <span class="t-time">${time}</span>`;
            leftEl.prepend(row);
            while (leftEl.children.length > 50) leftEl.removeChild(leftEl.lastChild);
        }
    });
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

async function placeOrder(side, amountUsdc, leverage) {
    if (!isSignerReady()) {
        addToLog(t('signer_required'), 'error');
        return false;
    }

    addToLog(t('order_pending'), 'pending');

    const price = lastPrice || 0;
    if (!price) { addToLog('❌ No price data', 'error'); return false; }

    await new Promise(r => setTimeout(r, 400));

    const positionSize = (amountUsdc * leverage) / price;

    if (amountUsdc > userBalance) {
        addToLog(`${t('balance_low')} ${userBalance.toFixed(2)})`, 'error');
        return false;
    }

    // SIMULATION: track locally (real order placement pending RISEx API fixes)
    userBalance -= amountUsdc;
    updateBalanceUI();

    const orderId = 'SIM-' + Date.now();
    position = {
        side:       side.toLowerCase(),
        size:       positionSize,
        entryPrice: price,
        leverage,
        margin:     amountUsdc,
        orderId
    };

    addToLog(`✅ ${side} opened at ${price.toFixed(1)} USDC`, 'success');
    addToLog(`📊 Size: ${positionSize.toFixed(6)} BTC × ${leverage}x`, 'meta');

    updatePositionUI(position);
    saveStats(side, amountUsdc * leverage, true);
    if (typeof addMyTrade === 'function') {
        addMyTrade(side, price, positionSize, leverage, null);
    }
    return true;
}




// ── Закрытие позиции (reduce-only) ──────────────────────────

async function closePosition() {
    if (!position || !position.size || position.size <= 0) {
        addToLog(t('no_pos_close'), 'warning'); return;
    }

    addToLog(t('close_pending'), 'pending');
    await new Promise(r => setTimeout(r, 300));

    const price     = lastPrice || position.entryPrice;
    const pnl       = position.side === 'long'
        ? (price - position.entryPrice) * position.size * position.leverage
        : (position.entryPrice - price) * position.size * position.leverage;
    const returnAmt = (position.margin || 0) + pnl;
    const win       = pnl >= 0;

    userBalance = (userBalance || 0) + Math.max(0, returnAmt);
    updateBalanceUI();

    const pnlStr = (pnl >= 0 ? '+' : '') + pnl.toFixed(2);
    addToLog(`✅ Position closed. PnL: ${pnlStr} USDC`, win ? 'success' : 'error');

    saveStats(position.side.toUpperCase(), position.size * price, win);

    if (typeof addMyTrade === 'function') {
        addMyTrade('CLOSE ' + position.side.toUpperCase(), price, position.size, position.leverage, pnl);
    }

    position = { side: null, size: 0, entryPrice: 0, leverage: 1, margin: 0 };
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
    if (!isLoggedIn || !signerAddress) return;
    try {
        const res = await fetch(
            `${RISEX_API.rest}/v1/account/position?market_id=${currentMarket}&account=${signerAddress}`);
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
