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

    let attempts = 0;
    while (!userWallet.address && attempts < 10) {
        await new Promise(r => setTimeout(r, 300));
        attempts++;
    }
    if (!userWallet.address) return false;

    const ok = await unlockSigner(uid);
    if (!ok) return false;

    const account = userWallet.address;

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
            userWallet.signerRegistered = true;
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
            // ticker канал не поддерживается — пропускаем

            if (isLoggedIn && userWallet.address) {
                _ws.send(JSON.stringify({
                    method: 'subscribe',
                    params: { channel: 'positions', account: userWallet.address }
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
        renderTrades(data.trades || data.fills || (Array.isArray(data) ? data : []));
    } else if (channel === 'ticker' || channel === 'mark_price') {
        updateTickerUI(data);
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

    const ok = await unlockSigner(uid);
    if (!ok) return false;

    if (!userWallet.signerRegistered) {
        await registerSigner(uid);
    }

    try {
        addToLog(t('order_pending'), 'pending');

        const price = lastPrice || await fetchMarkPrice();
        if (!price) { addToLog('❌ Не удалось получить цену', 'error'); return false; }

        // ── Константы ────────────────────────────────────────
        const ACTION_PLACE_ORDER_HASH = ethers.keccak256(
            ethers.toUtf8Bytes('RISE_PERPS_PLACE_ORDER_V1')
        );
        const V3_FLAG_PERMIT = 0x01;

        // ── Параметры ордера ─────────────────────────────────
        const marketSide    = side === 'LONG' ? 0 : 1;
        const orderType     = 1;   // Market
        const timeInForce   = 3;   // ImmediateOrCancel
        const postOnly      = false;
        const reduceOnly    = false;
        const stpMode       = 1;   // ExpireMaker
        const builderId     = 0;
        const clientOrderId = 0n;
        const ttlUnits      = 0;

        // Конвертируем размер в size_steps
        // 1 step = 0.000001 BTC (стандарт для BTC-PERP)
        const positionSize = (amountUsdc * leverage) / price;
        const sizeSteps    = Math.floor(positionSize * 1e6);
        const priceTicks   = 0; // 0 для market ордера

        // ── encodeOrderData (88-bit compressed) ──────────────
        let orderFlags = 0;
        if (marketSide & 1)   orderFlags |= 0x01;
        if (postOnly)         orderFlags |= 0x02;
        if (reduceOnly)       orderFlags |= 0x04;
        orderFlags |= (stpMode    & 3) << 3;
        orderFlags |= (orderType  & 1) << 5;
        orderFlags |= (timeInForce & 3) << 6;

        let orderData = 0n;
        orderData |= BigInt(currentMarket & 0xFFFF)   << 70n;
        orderData |= BigInt(sizeSteps & 0xFFFFFFFF)   << 38n;
        orderData |= BigInt(priceTicks & 0xFFFFFF)    << 14n;
        orderData |= BigInt(orderFlags & 0xFF)         << 6n;
        orderData |= BigInt((1 & 0x1F) << 1);          // headerVersion=1

        // ── computeHeaderFlags ───────────────────────────────
        let headerFlags = V3_FLAG_PERMIT; // 0x01

        // ── encodeOrder → hash ───────────────────────────────
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'uint8', 'uint256', 'uint16', 'uint64', 'uint16'],
            [
                ACTION_PLACE_ORDER_HASH,
                headerFlags,
                orderData,
                builderId,
                clientOrderId,
                ttlUnits,
            ]
        );
        const orderHash = ethers.keccak256(encoded);
        console.log('orderHash:', orderHash);

        // ── EIP-712 домен ────────────────────────────────────
        let domain = { name: 'RISEx', version: '1', chainId: BigInt(RISE_CHAIN.chainId) };
        try {
            const dr = await fetch(`${RISEX_API.rest}/v1/auth/eip712-domain`);
            if (dr.ok) {
                const raw = await dr.json();
                const d   = raw.data || raw;
                domain = {
                    name:              d.name,
                    version:           d.version,
                    chainId:           BigInt(d.chain_id || d.chainId),
                    verifyingContract: d.verifying_contract || d.verifyingContract,
                };
            }
        } catch {}

        // ── nonceState ───────────────────────────────────────
        let nonceAnchor      = 0;
        let nonceBitmapIndex = 0;
        try {
            const nr  = await fetch(`${RISEX_API.rest}/v1/nonce-state/${userWallet.address}`);
            if (nr.ok) {
                const raw = await nr.json();
                const nd  = raw.data || raw;
                nonceAnchor      = Number(nd.nonce_anchor || 0);
                nonceBitmapIndex = Number(nd.current_bitmap_index || 0);
                // Если bitmap переполнен — берём следующий anchor
                if (nonceBitmapIndex > 200) {
                    nonceAnchor += 1;
                    nonceBitmapIndex = 0;
                }
            }
        } catch {}

        // ── target (router) ──────────────────────────────────
        const target = '0xaadde0cea454f2bcb26f46ed54c5709b7bb34a7e';

        // ── deadline ─────────────────────────────────────────
        const deadline = Math.floor(Date.now() / 1000) + 300; // 5 минут

        // ── fixSignatureV ────────────────────────────────────
        function fixSig(sig) {
            const bytes = ethers.getBytes(sig);
            if (bytes.length === 65 && bytes[64] < 27) bytes[64] += 27;
            return ethers.hexlify(bytes);
        }

        // ── hexToBase64 ──────────────────────────────────────
        function hexToBase64(hex) {
            const bytes = ethers.getBytes(hex);
            return btoa(String.fromCharCode(...bytes));
        }

        // ── VERIFY_WITNESS_TYPES ─────────────────────────────
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

        // ── Подпись ───────────────────────────────────────────
        const rawSig = fixSig(
            await signer.signTypedData(domain, VERIFY_WITNESS_TYPES, {
                account:     userWallet.address,
                target,
                hash:        orderHash,
                nonceAnchor: nonceAnchor,
                nonceBitmap: nonceBitmapIndex,
                deadline,
            })
        );
        const signatureB64 = hexToBase64(rawSig);

        // ── Тело запроса ─────────────────────────────────────
        const body = {
            market_id:        currentMarket,
            side:             marketSide,
            order_type:       orderType,
            price_ticks:      priceTicks,
            size_steps:       sizeSteps,
            time_in_force:    timeInForce,
            post_only:        postOnly,
            reduce_only:      reduceOnly,
            stp_mode:         stpMode,
            ttl_units:        ttlUnits,
            client_order_id:  '0',
            builder_id:       builderId,
            permit: {
                account:           userWallet.address,
                signer:            userWallet.address,
                target,
                hash:              orderHash,
                nonce_anchor:      nonceAnchor,
                nonce_bitmap_index: nonceBitmapIndex,
                deadline,
                signature:         signatureB64,
            }
        };
        console.log('order body:', JSON.stringify(body));

        const res = await fetch(`${RISEX_API.rest}/v1/orders/place`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body)
        });

        const result = await res.json().catch(() => ({}));
        console.log('order response:', res.status, result);

        if (res.ok) {
            const orderId = result.data?.order_id || result.order_id || '?';
            addToLog(`${t('order_success')} ID: ${orderId}`, 'success');
            addToLog(`💰 ${amountUsdc} USDC × ${leverage}x`, 'meta');

            position = {
                side:       side.toLowerCase(),
                size:       positionSize,
                entryPrice: price,
                leverage,
                orderId
            };
            updatePositionUI(position);
            saveStats(side, amountUsdc * leverage, true);
            return true;
        } else {
            const msg = result.error?.message || result.message || JSON.stringify(result);
            addToLog(`${t('order_error')} ${String(msg).slice(0, 100)}`, 'error');
            return false;
        }

    } catch (e) {
        addToLog(`${t('order_error')} ${e.message.slice(0, 100)}`, 'error');
        console.error('placeOrder exception:', e);
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
