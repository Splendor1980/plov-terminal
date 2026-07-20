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
            if (addr.operator_hub)      RISEX_CONTRACTS.operatorHub   = addr.operator_hub;
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
    let attempts = 0;
    while (!signerAddress && attempts < 10) {
        await new Promise(r => setTimeout(r, 300));
        attempts++;
    }
    if (!signerAddress) return false;

    const ok = await unlockSigner(uid);
    if (!ok) return false;

    const account = riseAccountAddress || signerAddress; // см. RISEX_CORE_SPEC.md §1

    // RegisterSigner подписывается ключом АККАУНТА (не signer'а). У нас есть
    // только ключ signer'а — так что если account ≠ signer, мы физически не
    // можем это подписать (ключ от account — это Rabby/MetaMask, PLOV его
    // никогда не получает). В delegate-режиме авторизация уже должна быть
    // сделана на rise.trade → API → Authorize API Wallet — просто доверяем ей.
    if (account !== signerAddress) {
        addToLog('ℹ️ Delegate signer — доверяем авторизации на rise.trade', 'meta');
        return true;
    }

    try {
        addToLog(t('signer_reg'), 'meta');

        const domain = await fetchEip712Domain();

        // Структура и точный текст message взяты из исходников официального
        // SDK risex-client@0.1.11 (createRegisterSignerSignatures) — доковый
        // текст (uint256 nonce без account) оказался устаревшим/неверным.
        const REGISTER_SIGNER_MESSAGE = 'Registering signer for RISEx';
        const expiration = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 дней

        let authNonceAnchor = 1;
        const authNonceBitmap = 0;
        try {
            const nres = await fetch(`${RISEX_API.rest}/v1/nonce-state/${account}`);
            if (nres.ok) {
                const nraw = await nres.json();
                const nd   = nraw.data || nraw;
                authNonceAnchor = Number(nd.nonce_anchor || 0) + 1;
            }
        } catch (e) { console.warn('nonce-state error:', e.message); }

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
                account, signer: signerAddress, message: REGISTER_SIGNER_MESSAGE,
                expiration, nonceAnchor: authNonceAnchor, nonceBitmap: authNonceBitmap,
            })
        );

        const VERIFY_SIGNER_TYPES = {
            VerifySigner: [
                { name: 'account',     type: 'address' },
                { name: 'nonceAnchor', type: 'uint48'  },
                { name: 'nonceBitmap', type: 'uint8'   },
            ]
        };
        const signerSig = fixSignatureV(
            await signer.signTypedData(domain, VERIFY_SIGNER_TYPES, {
                account, nonceAnchor: authNonceAnchor, nonceBitmap: authNonceBitmap,
            })
        );

        const body = {
            account, signer: signerAddress, message: REGISTER_SIGNER_MESSAGE,
            nonce_anchor: String(authNonceAnchor), nonce_bitmap_index: authNonceBitmap,
            expiration: String(expiration),
            account_signature: accountSig,
            signer_signature:  signerSig,
            label: 'plov-terminal',
        };
        console.log('register-signer body:', JSON.stringify(body));

        const regRes  = await fetch(`${RISEX_API.rest}/v1/auth/register-signer`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body)
        });
        const result = await regRes.json().catch(() => ({}));
        console.log('register-signer response:', regRes.status, result);

        if (regRes.ok || regRes.status === 409) {
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

// fixSignatureV — исправляет v=0/1 → 27/28
// RISEx ожидает permit.signature как base64 (OpenAPI format:byte —
// стандартная конвенция protobuf/grpc-gateway для bytes-полей), не hex.
// Подтверждено математически: наша 132-символьная hex-строка, ошибочно
// прочитанная сервером как base64, даёт ровно 99 байт (132/4*3=99) —
// именно это число сервер и вернул в ошибке.
function hexSigToBase64(hexSig) {
    const clean = hexSig.startsWith('0x') ? hexSig.slice(2) : hexSig;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function fixSignatureV(sig) {
    const sigBytes = ethers.getBytes(sig);
    const v = sigBytes[64];
    if (v === 0 || v === 1) {
        sigBytes[64] = v + 27;
        return ethers.hexlify(sigBytes);
    }
    return sig;
}

// GET /v1/auth/eip712-domain — общий домен для всех подписей (order/cancel/register)
let _eip712DomainCache = null;
async function fetchEip712Domain() {
    if (_eip712DomainCache) return _eip712DomainCache;
    let domain = { name: 'RISEx', version: '1', chainId: BigInt(RISE_CHAIN.chainId) };
    try {
        const res = await fetch(`${RISEX_API.rest}/v1/auth/eip712-domain`);
        if (res.ok) {
            const raw = await res.json();
            const d   = raw.data || raw;
            domain = {
                name:    d.name,
                version: d.version,
                chainId: BigInt(d.chain_id || d.chainId),
                verifyingContract: d.verifying_contract || d.verifyingContract,
            };
        }
    } catch (e) {
        console.warn('eip712-domain error:', e.message);
    }
    _eip712DomainCache = domain;
    return domain;
}





// ── WebSocket стакан ─────────────────────────────────────────

function startOrderBook(marketId = 1) {
    if (_obRunning) stopOrderBook();
    _obRunning = true;
    _connectWS(marketId);

    // Polling fallback — если WS не работает, берём данные из REST
    if (window._obPollInterval) clearInterval(window._obPollInterval);
    window._obPollInterval = setInterval(async () => {
        if (_ws && _ws.readyState === WebSocket.OPEN) return;
        try {
            const res  = await fetch(`${RISEX_API.rest}/v1/markets`);
            if (!res.ok) return;
            const data = await res.json();
            const mkts = data.data?.markets || data.markets || [];
            const mkt  = mkts.find(m => String(m.market_id) === String(marketId));
            if (!mkt) return;
            const norm = v => { const n = parseFloat(v); return n > 1e15 ? n / 1e18 : n; };
            const price = norm(mkt.mark_price || mkt.last_price || mkt.index_price || 0);
            if (price > 0) { lastPrice = price; updatePriceUI(price); }
            if (mkt.funding_rate !== undefined) {
                const fr = (parseFloat(mkt.funding_rate) * 100).toFixed(4);
                const frEl = document.getElementById('funding-rate');
                if (frEl) frEl.textContent = `FR: ${fr}%`;
            }
        } catch {}
    }, 3000);
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

    // Всегда mainnet в продакшене
    const wsUrl = (typeof USE_MAINNET !== 'undefined' && USE_MAINNET)
        ? 'wss://ws.rise.trade/ws'
        : (RISEX_API.ws || 'wss://ws.rise.trade/ws');

    console.log('WS connecting to:', wsUrl);

    try {
        _ws = new WebSocket(wsUrl);

        _ws.onopen = () => {
            console.log('WS connected to', wsUrl);
            addToLog(t('ws_connected'), 'meta');
            const live = document.getElementById('ob-live');
            if (live) { live.textContent = 'LIVE'; live.style.color = 'var(--green)'; }

            _ws.send(JSON.stringify({ method: 'subscribe', params: { channel: 'orderbook', market_ids: [marketId] } }));
            _ws.send(JSON.stringify({ method: 'subscribe', params: { channel: 'trades',    market_ids: [marketId] } }));
            // Ticker канал не поддерживается в текущей версии RISEx
            // _ws.send(JSON.stringify({ method: 'subscribe', params: { channel: 'ticker',    market_ids: [marketId] } }));

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

        _ws.onerror = (e) => {
            console.warn('WS error:', e);
            try { _ws.close(); } catch {}
        };

    } catch (e) {
        console.error('WS connect failed:', e.message);
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
        // Не доверяем сырой форме WS-пейлоада напрямую (не подтверждена
        // вживую) — просто триггерим уже проверенный REST-путь с нормализацией.
        if (typeof loadRealPosition === 'function') loadRealPosition();
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
            if (inp) inp.value = total.toFixed(2); // total (price×size, USDC) — не raw BTC size
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
            if (inp) inp.value = total.toFixed(2); // total (price×size, USDC) — не raw BTC size
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

// ============================================================
// ── Подпись и размещение реальных ордеров ────────────────────
// См. RISEX_CORE_SPEC.md §5-7. Полностью заменяет прежнюю
// зависимость от несуществующего UMD-бандла risex-client и
// неподписанный "manual fallback".
// ============================================================

function getMarketConfig(marketId) {
    const markets = window._risexMarkets || [];
    return markets.find(m => String(m.market_id) === String(marketId));
}

function toSizeSteps(humanSize, marketId) {
    const m    = getMarketConfig(marketId);
    const step = parseFloat(m?.config?.step_size || '0.001') || 0.001;
    return Math.max(1, Math.round(humanSize / step));
}

function toPriceTicks(humanPrice, marketId) {
    const m    = getMarketConfig(marketId);
    const tick = parseFloat(m?.config?.step_price || '0.1') || 0.1;
    return Math.max(1, Math.round(humanPrice / tick));
}

// ── Точные константы и кодирование ордера — извлечены из исходников
// официального SDK risex-client@0.1.11 (npm), т.к. в публичной доке
// формула для PlaceOrder не расписана (в отличие от isolated-margin/
// leverage/margin-mode). Полное совпадение 1-в-1 с dist/esm/index.mjs.
const ACTION_PLACE_ORDER        = 'RISE_PERPS_PLACE_ORDER_V1';
const ACTION_CANCEL_ORDER       = 'RISE_PERPS_CANCEL_ORDER_V1';
const ACTION_CANCEL_ALL_ORDERS  = 'RISE_PERPS_CANCEL_ALL_ORDERS_V1';
const ACTION_PLACE_ORDER_HASH       = ethers.keccak256(ethers.toUtf8Bytes(ACTION_PLACE_ORDER));
const ACTION_CANCEL_ORDER_HASH      = ethers.keccak256(ethers.toUtf8Bytes(ACTION_CANCEL_ORDER));
const ACTION_CANCEL_ALL_ORDERS_HASH = ethers.keccak256(ethers.toUtf8Bytes(ACTION_CANCEL_ALL_ORDERS));

const V3_FLAG_PERMIT        = 1;
const V3_FLAG_BUILDER       = 2;
const V3_FLAG_CLIENT_ID     = 4;
const V3_FLAG_PERMIT_ERC1271 = 9;
const V3_FLAG_TTL           = 16;

// Один битово-упакованный uint256 (НЕ 47 сырых байт — это была ошибочная
// версия из integration.md). side/post_only/reduce_only/stp_mode/order_type/
// time_in_force упаковываются в один байт orderFlags, а market_id/size_steps/
// price_ticks/orderFlags/headerVersion — в uint256 через битовые сдвиги.
function encodeOrderDataPacked(p) {
    let orderFlags = 0;
    if (p.side & 1)   orderFlags |= 1;
    if (p.post_only)  orderFlags |= 2;
    if (p.reduce_only) orderFlags |= 4;
    orderFlags |= (p.stp_mode & 3) << 3;
    orderFlags |= (p.order_type & 1) << 5;
    orderFlags |= (p.time_in_force & 3) << 6;

    const headerVersion = 1;
    let data = 0n;
    data |= BigInt(p.market_id & 65535) << 70n;
    data |= BigInt(p.size_steps & 4294967295) << 38n;
    data |= BigInt(p.price_ticks & 16777215) << 14n;
    data |= BigInt(orderFlags & 255) << 6n;
    data |= BigInt((headerVersion & 31) << 1);
    return data;
}

function computeHeaderFlags(builderId, clientOrderId, ttlUnits, isErc1271 = false) {
    let flags = isErc1271 ? V3_FLAG_PERMIT_ERC1271 : V3_FLAG_PERMIT;
    if (builderId !== 0)      flags |= V3_FLAG_BUILDER;
    if (clientOrderId !== 0n) flags |= V3_FLAG_CLIENT_ID;
    if (ttlUnits !== 0)       flags |= V3_FLAG_TTL;
    return flags;
}

function computeOrderHash(p) {
    const orderData      = encodeOrderDataPacked(p);
    const clientOrderId  = BigInt(p.client_order_id ?? '0');
    const headerFlags    = computeHeaderFlags(p.builder_id ?? 0, clientOrderId, p.ttl_units ?? 0);

    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'uint8', 'uint256', 'uint16', 'uint64', 'uint16'],
        [ACTION_PLACE_ORDER_HASH, headerFlags, orderData, p.builder_id ?? 0, clientOrderId, p.ttl_units ?? 0]
    );
    return ethers.keccak256(encoded);
}

function computeCancelOrderHash(marketId, restingOrderId) {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'uint256', 'uint256'],
        [ACTION_CANCEL_ORDER_HASH, BigInt(marketId), BigInt(restingOrderId)]
    );
    return ethers.keccak256(encoded);
}

// Общий helper для nonce-state — та же логика, что createPermitParams() в
// SDK. Используется VerifyWitness-подписями (ордера) и PermitSingle (TP/SL budget).
async function getNonceState(account) {
    const MAX_BITMAP_INDEX = 207;
    let nonceAnchor = 1, nonceBitmap = 0;
    try {
        const res = await fetch(`${RISEX_API.rest}/v1/nonce-state/${account}`);
        if (res.ok) {
            const raw = await res.json();
            const nd  = raw.data || raw;
            nonceAnchor = Number(nd.nonce_anchor || 0);
            nonceBitmap = Number(nd.current_bitmap_index || 0);
            if (nonceBitmap > MAX_BITMAP_INDEX) {
                nonceAnchor += 1;
                nonceBitmap = 0;
            }
        }
    } catch (e) {
        console.warn('nonce-state error:', e.message);
    }
    return { nonceAnchor, nonceBitmap };
}

// Общий permit VerifyWitness — подтверждён трижды в доке (isolated-margin/
// leverage/margin-mode) и совпадает 1-в-1 с официальным SDK.
async function signVerifyWitness({ account, target, hash, deadline }) {
    const domain = await fetchEip712Domain();
    const { nonceAnchor, nonceBitmap } = await getNonceState(account);

    const VERIFY_WITNESS_TYPES = {
        VerifyWitness: [
            { name: 'account',     type: 'address' },
            { name: 'target',      type: 'address' },
            { name: 'hash',        type: 'bytes32' },
            { name: 'nonceAnchor', type: 'uint48'  },
            { name: 'nonceBitmap', type: 'uint8'   },
            { name: 'deadline',    type: 'uint32'  },
        ]
    };

    const signature = fixSignatureV(
        await signer.signTypedData(domain, VERIFY_WITNESS_TYPES, {
            account, target, hash, nonceAnchor, nonceBitmap, deadline,
        })
    );

    const sigByteLen = (signature.length - 2) / 2;
    console.log('signature:', signature, '| length (chars):', signature.length, '| bytes:', sigByteLen);
    if (sigByteLen !== 65) {
        throw new Error(`Signature is ${sigByteLen} bytes, expected 65 — bug before sending to API`);
    }

    return { nonceAnchor, nonceBitmap, signature };
}

// order_type: 0=Market, 1=Limit (OpenAPI, подтверждено бизнес-валидацией
// сервера "market orders require FOK or IOC" — значит 0 распознаётся именно
// как Market).
const ORDER_TYPE = { MARKET: 0, LIMIT: 1 };
const TIF         = { GTC: 0, GTT: 1, FOK: 2, IOC: 3 };

async function signAndPlaceOrder({ marketId, side, humanSize, humanPrice, orderType = ORDER_TYPE.MARKET, timeInForce = TIF.IOC, postOnly = false, reduceOnly = false, stpMode = 0 }) {
    if (!signer || !signerAddress) throw new Error('Signer not connected');
    if (!RISEX_CONTRACTS.router)   throw new Error('Router address not loaded (system/config)');

    const account  = riseAccountAddress || signerAddress;
    const target   = RISEX_CONTRACTS.router;
    const deadline = Math.floor(Date.now() / 1000) + 300;

    const sizeSteps  = toSizeSteps(humanSize, marketId);
    // Market-ордера всегда price_ticks=0 (подтверждено SDK: marketBuy/marketSell
    // всегда шлют 0 — лимитная цена не имеет смысла для рыночного ордера).
    const priceTicks = orderType === ORDER_TYPE.MARKET ? 0 : toPriceTicks(humanPrice, marketId);

    const orderParams = {
        market_id: Number(marketId), size_steps: sizeSteps, price_ticks: priceTicks,
        side, post_only: postOnly, reduce_only: reduceOnly, stp_mode: stpMode,
        order_type: orderType, time_in_force: timeInForce,
        builder_id: 0, client_order_id: '0', ttl_units: 0,
    };
    const orderHash = computeOrderHash(orderParams);

    const { nonceAnchor, nonceBitmap, signature } =
        await signVerifyWitness({ account, target, hash: orderHash, deadline });

    const body = {
        ...orderParams,
        permit: {
            account, signer: signerAddress,
            nonce_anchor: String(nonceAnchor), nonce_bitmap_index: nonceBitmap,
            deadline, signature: hexSigToBase64(signature),
        }
    };
    console.log('place-order body:', JSON.stringify(body));

    const res = await fetch(`${RISEX_API.rest}/v1/orders/place`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
    });
    const result = await res.json().catch(() => ({}));
    console.log('place-order response:', res.status, result);

    if (!res.ok) {
        throw new Error(result.error?.message || result.message || `API error ${res.status}`);
    }
    return result;
}

// ⚠️ Требует resting_order_id (из GET /v1/orders/open) — не «наш» client_order_id.
async function signAndCancelOrder(marketId, orderId, restingOrderId) {
    if (!signer || !signerAddress) throw new Error('Signer not connected');
    if (!RISEX_CONTRACTS.router)   throw new Error('Router address not loaded (system/config)');

    const account  = riseAccountAddress || signerAddress;
    const target   = RISEX_CONTRACTS.router;
    const deadline = Math.floor(Date.now() / 1000) + 300;

    const cancelHash = computeCancelOrderHash(marketId, restingOrderId);

    const { nonceAnchor, nonceBitmap, signature } =
        await signVerifyWitness({ account, target, hash: cancelHash, deadline });

    const body = {
        market_id: Number(marketId),
        order_id:  orderId, // оригинальный order_id (0x...), НЕ resting_order_id — тот только для хэша
        permit: {
            account, signer: signerAddress,
            nonce_anchor: String(nonceAnchor), nonce_bitmap_index: nonceBitmap,
            deadline, signature: hexSigToBase64(signature),
        }
    };

    const res = await fetch(`${RISEX_API.rest}/v1/orders/cancel`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(result.error?.message || result.message || `API error ${res.status}`);
    }
    return result;
}

window.signAndPlaceOrder  = signAndPlaceOrder;

// ============================================================
// ── TP/SL (Take Profit / Stop Loss) ──────────────────────────
// ============================================================
// См. RISEX_CORE_SPEC.md §12. Два разных подписанта:
//  - Approve budget (одноразово) — подписывает АККАУНТ (Rabby/MetaMask),
//    не delegate signer — PLOV не может это подписать сам, как и
//    register-signer в своё время.
//  - Place/Cancel TP/SL ордер — подписывает delegate signer (как обычные
//    ордера), в схеме прямо есть поле signer.
// ============================================================

const TPSL_SIDE        = { BUY: 'BUY', SELL: 'SELL' };
const TPSL_STOP_TYPE    = { TAKE_PROFIT: 0, STOP_LOSS: 1, NONE: 2 };
const TPSL_ORDER_TYPE   = { MARKET: 'MARKET', LIMIT: 'LIMIT' };
const TPSL_PRICE_OPTION = { LAST_TRADED_PRICE: 0, MARK_PRICE: 1, NONE: 2 };
const TPSL_TIF          = { GTC: 'GTC', GTT: 'GTT', FOK: 'FOK', IOC: 'IOC' };

// ── Approve budget (один раз, через Rabby/MetaMask) ─────────
async function approveTpSlBudget(budgetUsd, expiryDays = 365) {
    if (!window.ethereum) throw new Error('Кошелёк (MetaMask/Rabby) не найден в браузере');
    if (!RISEX_CONTRACTS.operatorHub) throw new Error('operator_hub не загружен (system/config)');

    const account = riseAccountAddress || signerAddress;

    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    await browserProvider.send('eth_requestAccounts', []);
    const accountSigner = await browserProvider.getSigner();
    const realAccount   = await accountSigner.getAddress();
    if (realAccount.toLowerCase() !== account.toLowerCase()) {
        throw new Error(`Кошелёк в браузере (${realAccount.slice(0,8)}...) не совпадает с account (${account.slice(0,8)}...). Переключи аккаунт в Rabby.`);
    }

    const domain = await fetchEip712Domain();
    const { nonceAnchor, nonceBitmap } = await getNonceState(account);

    const budgetWad = ethers.parseUnits(String(budgetUsd), 18);
    const allowanceExpiry = Math.floor(Date.now() / 1000) + expiryDays * 24 * 60 * 60;

    const PERMIT_SINGLE_TYPES = {
        PermitSingle: [
            { name: 'account',          type: 'address' },
            { name: 'operator',         type: 'address' },
            { name: 'budget',           type: 'uint96'  },
            { name: 'allowanceExpiry',  type: 'uint32'  },
            { name: 'nonceAnchor',      type: 'uint48'  },
            { name: 'nonceBitmap',      type: 'uint8'   },
        ]
    };

    const signature = fixSignatureV(
        await accountSigner.signTypedData(domain, PERMIT_SINGLE_TYPES, {
            account, operator: RISEX_CONTRACTS.operatorHub,
            budget: budgetWad, allowanceExpiry, nonceAnchor, nonceBitmap,
        })
    );

    const body = {
        account, operator: RISEX_CONTRACTS.operatorHub,
        budget: budgetWad.toString(),
        allowance_expiry: allowanceExpiry,
        nonce_anchor: String(nonceAnchor), nonce_bitmap_index: nonceBitmap,
        signature, // hex, НЕ base64 (подтверждено примером в доке: "0x1234...")
    };
    console.log('approve-single body:', JSON.stringify(body));

    const res = await fetch(`${RISEX_API.rest}/v1/auth/approve-single`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const result = await res.json().catch(() => ({}));
    console.log('approve-single response:', res.status, result);
    if (!res.ok) throw new Error(result.error?.message || result.message || `API error ${res.status}`);
    return result;
}

// ── Разместить TP или SL ордер (delegate signer) ────────────
async function signAndPlaceTpSlOrder({ marketId, side, humanSize, stopType, stopPrice, limitPrice = '0', orderType = TPSL_ORDER_TYPE.MARKET, stopPriceOption = TPSL_PRICE_OPTION.MARK_PRICE, tif = TPSL_TIF.GTC, sizePercentBps = 10000 }) {
    if (!signer || !signerAddress) throw new Error('Signer not connected');

    const account  = riseAccountAddress || signerAddress;
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const domain   = await fetchEip712Domain();

    const sideStr     = side === 0 ? TPSL_SIDE.BUY : TPSL_SIDE.SELL;
    const sideNum     = side; // 0=Buy,1=Sell — как и в обычных ордерах
    const orderTypeNum = orderType === TPSL_ORDER_TYPE.LIMIT ? 1 : 0;
    const tifNum        = { GTC: 0, GTT: 1, FOK: 2, IOC: 3 }[tif];

    const PLACE_TPSL_TYPES = {
        PlaceTpslOrder: [
            { name: 'account',         type: 'address' },
            { name: 'marketId',        type: 'uint64'  },
            { name: 'side',            type: 'uint8'   },
            { name: 'size',            type: 'string'  },
            { name: 'stopType',        type: 'uint8'   },
            { name: 'stopPrice',       type: 'string'  },
            { name: 'limitPrice',      type: 'string'  },
            { name: 'orderType',       type: 'uint8'   },
            { name: 'stopPriceOption', type: 'uint8'   },
            { name: 'tif',             type: 'uint8'   },
            { name: 'deadline',        type: 'uint32'  },
            { name: 'sizePercentBps',  type: 'uint32'  },
        ]
    };

    const sizeStr      = String(humanSize);
    const stopPriceStr = String(stopPrice);
    const limitPriceStr = String(limitPrice);

    const signature = fixSignatureV(
        await signer.signTypedData(domain, PLACE_TPSL_TYPES, {
            account, marketId: Number(marketId), side: sideNum, size: sizeStr,
            stopType, stopPrice: stopPriceStr, limitPrice: limitPriceStr,
            orderType: orderTypeNum, stopPriceOption, tif: tifNum,
            deadline, sizePercentBps,
        })
    );

    const body = {
        account, market_id: String(marketId), side: sideStr, size: sizeStr,
        stop_type: stopType === TPSL_STOP_TYPE.TAKE_PROFIT ? 'TAKE_PROFIT' : 'STOP_LOSS',
        order_type: orderType, stop_price: stopPriceStr, limit_price: limitPriceStr,
        stop_price_option: stopPriceOption === TPSL_PRICE_OPTION.MARK_PRICE ? 'MARK_PRICE' : 'LAST_TRADED_PRICE',
        tif, signer: signerAddress,
        signature: hexSigToBase64(signature), // format:byte, как и permit.signature ордеров
        deadline, size_percent_bps: sizePercentBps,
    };
    console.log('place-tpsl body:', JSON.stringify(body));

    const res = await fetch(`${RISEX_API.rest}/v1/orders/tpsl`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const result = await res.json().catch(() => ({}));
    console.log('place-tpsl response:', res.status, result);
    if (!res.ok) throw new Error(result.error?.message || result.message || `API error ${res.status}`);
    return result;
}

async function fetchTpSlOrders() {
    const account = riseAccountAddress || signerAddress;
    if (!account) return [];
    try {
        const res = await fetch(`${RISEX_API.rest}/v1/orders/tpsl?account=${account}&market_id=${currentMarket}`);
        if (!res.ok) return [];
        const raw  = await res.json();
        const rows = raw.data ?? raw;
        const orders = Array.isArray(rows) ? rows : (Array.isArray(rows?.orders) ? rows.orders : []);
        return orders;
    } catch (e) {
        console.warn('fetchTpSlOrders error:', e);
        return [];
    }
}

async function cancelTpSlOrder(orderId) {
    if (!signer || !signerAddress) throw new Error('Signer not connected');
    const account  = riseAccountAddress || signerAddress;
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const domain   = await fetchEip712Domain();

    const CANCEL_TPSL_TYPES = {
        CancelTpslOrder: [
            { name: 'account',  type: 'address' },
            { name: 'orderId',  type: 'string'  },
            { name: 'deadline', type: 'uint32'  },
        ]
    };
    const signature = fixSignatureV(
        await signer.signTypedData(domain, CANCEL_TPSL_TYPES, { account, orderId: String(orderId), deadline })
    );

    const body = { account, order_id: String(orderId), deadline, signer: signerAddress, signature: hexSigToBase64(signature) };
    const res = await fetch(`${RISEX_API.rest}/v1/orders/tpsl/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error?.message || result.message || `API error ${res.status}`);
    return result;
}

window.approveTpSlBudget    = approveTpSlBudget;
window.signAndPlaceTpSlOrder = signAndPlaceTpSlOrder;
window.fetchTpSlOrders      = fetchTpSlOrders;
window.cancelTpSlOrder      = cancelTpSlOrder;
window.TPSL_STOP_TYPE       = TPSL_STOP_TYPE;
window.TPSL_PRICE_OPTION    = TPSL_PRICE_OPTION;
window.signAndCancelOrder = signAndCancelOrder;
window.ORDER_TYPE         = ORDER_TYPE;
window.TIF                = TIF;

// ── Размещение ордера ────────────────────────────────────────

async function placeOrder(side, amountUsdc, leverage, uid, orderTypeStr = 'market', limitPrice = null) {
    // Использовать реальную функцию из risex-real-trading.js
    if (typeof placeRealOrder === 'function') {
        return await placeRealOrder(side, amountUsdc, leverage, orderTypeStr, limitPrice);
    }

    // Fallback если модуль не загружен
    addToLog('❌ Real trading module not loaded', 'error');
    return false;
}




// ── Закрытие позиции (reduce-only) ──────────────────────────

async function closePosition() {
    // Использовать реальную функцию из risex-real-trading.js
    if (typeof closeRealPosition === 'function') {
        return await closeRealPosition();
    }

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
