// ============================================================
// RISEX API CLIENT - FULL FIXED WITH GLOBAL EXPORT
// ============================================================

class RisexAPI {
    constructor() {
        this._ws = null;
        this._wsTimeout = null;
        this._manualClose = false;
        this._subscriptions = new Map();
        this._callbacks = new Map();
        this._pingInterval = null;
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 10;
        this._isConnected = false;
        this._pendingMessages = [];
        this._messageId = 0;
        this._debug = true;
        this._wsUrl = 'wss://ws.rise.trade/ws'; // Жёстко mainnet
        this._currentSymbol = 'BTCUSDT';
        this._orderBookInterval = null;
        this._tradeInterval = null;
        this._tickerInterval = null;
        this._restEnabled = true;

        // Перезаписываем глобальный URL
        if (window.RISEX_API) {
            window.RISEX_API.ws = this._wsUrl;
        }

        console.log('🔌 RisexAPI initialized with WS:', this._wsUrl);
    }

    // ============================================================
    // PUBLIC METHODS
    // ============================================================

    connect() {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            console.log('ℹ️ WebSocket already connected');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            try {
                console.log(`🔌 Connecting to WebSocket: ${this._wsUrl}`);

                this._ws = new WebSocket(this._wsUrl);

                this._ws.onopen = (event) => {
                    console.log('✅✅✅ WEBSOCKET OPENED SUCCESSFULLY!');
                    this._isConnected = true;
                    this._reconnectAttempts = 0;
                    this._startPing();
                    this._flushPendingMessages();

                    const statusEl = document.getElementById('status');
                    if (statusEl) {
                        statusEl.textContent = '🟢 Connected';
                        statusEl.style.color = '#00ff88';
                    }

                    resolve(event);
                };

                this._ws.onmessage = this._handleMessage.bind(this);

                this._ws.onerror = (event) => {
                    console.error('❌ WebSocket error:', event);
                    const statusEl = document.getElementById('status');
                    if (statusEl) {
                        statusEl.textContent = '❌ Error';
                        statusEl.style.color = '#ff4444';
                    }
                    reject(event);
                };

                this._ws.onclose = (event) => {
                    console.log(`🔌 WebSocket closed: code=${event.code}`);
                    this._isConnected = false;
                    this._stopPing();

                    const statusEl = document.getElementById('status');
                    if (statusEl) {
                        statusEl.textContent = '🔴 Disconnected';
                        statusEl.style.color = '#ff4444';
                    }

                    if (!this._manualClose) {
                        this._reconnect();
                    }
                };

                this._wsTimeout = setTimeout(() => {
                    if (this._ws && this._ws.readyState !== WebSocket.OPEN) {
                        console.warn('⚠️ WebSocket connection timeout');
                        this._ws.close();
                        reject(new Error('Connection timeout'));
                    }
                }, 10000);

            } catch (e) {
                console.error('❌ WebSocket init error:', e);
                reject(e);
            }
        });
    }

    disconnect() {
        this._manualClose = true;
        this._stopPing();
        this._stopPolling();
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
        this._isConnected = false;
        console.log('🔌 WebSocket disconnected manually');
    }

    // ============================================================
    // ORDER BOOK METHODS (public API)
    // ============================================================

    startOrderBook(symbol = 1) {
        // symbol: 1 = BTC, 2 = ETH и т.д.
        const symbolMap = {
            1: 'BTCUSDT',
            2: 'ETHUSDT',
            3: 'SOLUSDT',
            4: 'DOGEUSDT'
        };
        
        this._currentSymbol = symbolMap[symbol] || 'BTCUSDT';
        console.log(`🚀 Starting order book for ${this._currentSymbol}`);

        // Сначала пробуем WebSocket
        if (this._isConnected) {
            this.subscribe(`orderbook:${this._currentSymbol}`, (data) => {
                console.log('📊 WS OrderBook:', data);
                this._updateOrderBookUI(data);
            });
            this.subscribe(`ticker:${this._currentSymbol}`, (data) => {
                console.log('📈 WS Ticker:', data);
                this._updateTickerUI(data);
            });
            this.subscribe(`trades:${this._currentSymbol}`, (data) => {
                console.log('📋 WS Trades:', data);
                this._updateTradesUI(data);
            });
        }

        // Запускаем REST polling как fallback
        this._startPolling();
        
        return true;
    }

    stopOrderBook() {
        console.log('⏹️ Stopping order book');
        this._stopPolling();
        // Отписываемся от каналов
        if (this._isConnected) {
            this.unsubscribe(`orderbook:${this._currentSymbol}`);
            this.unsubscribe(`ticker:${this._currentSymbol}`);
            this.unsubscribe(`trades:${this._currentSymbol}`);
        }
    }

    // ============================================================
    // SUBSCRIPTION METHODS
    // ============================================================

    subscribe(channel, callback) {
        if (!this._isConnected) {
            console.warn('⚠️ Not connected, queueing subscription:', channel);
            this._pendingMessages.push({
                type: 'subscribe',
                channel: channel,
                callback: callback
            });
            if (!this._manualClose) {
                this.connect().catch(e => console.warn('Reconnect attempt:', e));
            }
            return;
        }

        const id = ++this._messageId;
        const message = {
            id: id,
            method: 'subscribe',
            params: [channel]
        };

        this._subscriptions.set(id, { channel, callback });
        this._send(message);
        console.log(`📡 Subscribed to ${channel} (id: ${id})`);
    }

    unsubscribe(channel) {
        if (!this._isConnected) {
            console.warn('⚠️ Not connected, cannot unsubscribe');
            return;
        }

        const id = ++this._messageId;
        const message = {
            id: id,
            method: 'unsubscribe',
            params: [channel]
        };

        for (const [key, value] of this._subscriptions) {
            if (value.channel === channel) {
                this._subscriptions.delete(key);
            }
        }

        this._send(message);
        console.log(`📡 Unsubscribed from ${channel}`);
    }

    // ============================================================
    // PRIVATE METHODS
    // ============================================================

    _send(message) {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            const data = JSON.stringify(message);
            this._ws.send(data);
            if (this._debug) {
                console.log(`📤 Sent:`, message);
            }
        } else {
            console.warn('⚠️ Cannot send, WebSocket not open');
            this._pendingMessages.push(message);
            if (!this._manualClose) {
                this.connect().catch(e => console.warn('Reconnect attempt:', e));
            }
        }
    }

    _handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            if (this._debug) {
                console.log(`📥 Received:`, data);
            }

            if (data.type === 'ping') {
                this._send({ type: 'pong' });
                return;
            }

            if (data.type === 'subscription' && data.data) {
                const callback = this._subscriptions.get(data.id);
                if (callback) {
                    callback(data.data);
                }
                return;
            }

            if (data.id && this._callbacks.has(data.id)) {
                const cb = this._callbacks.get(data.id);
                this._callbacks.delete(data.id);
                cb(data);
                return;
            }

        } catch (e) {
            console.error('❌ Failed to parse WebSocket message:', e);
        }
    }

    _startPing() {
        this._stopPing();
        this._pingInterval = setInterval(() => {
            if (this._ws && this._ws.readyState === WebSocket.OPEN) {
                this._send({ type: 'ping' });
            }
        }, 30000);
    }

    _stopPing() {
        if (this._pingInterval) {
            clearInterval(this._pingInterval);
            this._pingInterval = null;
        }
    }

    _flushPendingMessages() {
        console.log(`📦 Flushing ${this._pendingMessages.length} pending messages`);
        while (this._pendingMessages.length > 0) {
            const msg = this._pendingMessages.shift();
            if (msg.type === 'subscribe') {
                this.subscribe(msg.channel, msg.callback);
            } else {
                this._send(msg);
            }
        }
    }

    _reconnect() {
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            console.error('❌ Max reconnect attempts reached');
            return;
        }

        this._reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30000);
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts})`);

        setTimeout(() => {
            if (!this._manualClose) {
                this.connect().catch(() => {});
            }
        }, delay);
    }

    // ============================================================
    // REST POLLING (FALLBACK)
    // ============================================================

    _startPolling() {
        this._stopPolling();
        
        // Получаем ticker каждые 2 секунды
        this._tickerInterval = setInterval(async () => {
            try {
                const data = await this.getTickerRest(this._currentSymbol);
                if (data) this._updateTickerUI(data);
            } catch (e) { /* silent */ }
        }, 2000);

        // Получаем orderbook каждые 5 секунд
        this._orderBookInterval = setInterval(async () => {
            try {
                const data = await this.getOrderBookRest(this._currentSymbol);
                if (data) this._updateOrderBookUI(data);
            } catch (e) { /* silent */ }
        }, 5000);

        // Получаем trades каждые 3 секунды
        this._tradeInterval = setInterval(async () => {
            try {
                const data = await this.getTradesRest(this._currentSymbol);
                if (data && data.trades) this._updateTradesUI(data);
            } catch (e) { /* silent */ }
        }, 3000);

        console.log('🔄 REST polling started');
    }

    _stopPolling() {
        if (this._tickerInterval) {
            clearInterval(this._tickerInterval);
            this._tickerInterval = null;
        }
        if (this._orderBookInterval) {
            clearInterval(this._orderBookInterval);
            this._orderBookInterval = null;
        }
        if (this._tradeInterval) {
            clearInterval(this._tradeInterval);
            this._tradeInterval = null;
        }
        console.log('⏹️ REST polling stopped');
    }

    // ============================================================
    // REST METHODS
    // ============================================================

    async restRequest(endpoint, params = {}) {
        const httpUrl = 'https://api.rise.trade';
        const url = new URL(`${httpUrl}${endpoint}`);
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (e) {
            console.error('❌ REST request failed:', e);
            throw e;
        }
    }

    async getOrderBookRest(symbol) {
        return this.restRequest('/api/v1/orderbook', { symbol });
    }

    async getTickerRest(symbol) {
        return this.restRequest('/api/v1/ticker', { symbol });
    }

    async getTradesRest(symbol, limit = 50) {
        return this.restRequest('/api/v1/trades', { symbol, limit });
    }

    // ============================================================
    // UI UPDATES
    // ============================================================

    _updateOrderBookUI(data) {
        if (!data || !data.bids || !data.asks) return;

        const bidsContainer = document.getElementById('bids');
        const asksContainer = document.getElementById('asks');
        const bidEl = document.getElementById('bid');
        const askEl = document.getElementById('ask');
        const spreadEl = document.getElementById('spread');

        if (bidsContainer && data.bids.length > 0) {
            bidsContainer.innerHTML = data.bids.slice(0, 20).map(([price, size]) => `
                <div class="order-row bid">
                    <span class="price" style="color:#00ff88">$${Number(price).toFixed(2)}</span>
                    <span class="size">${Number(size).toFixed(4)}</span>
                    <div class="depth-bar" style="width:${Math.min(Number(size) / 10, 100)}%"></div>
                </div>
            `).join('');
        }

        if (asksContainer && data.asks.length > 0) {
            asksContainer.innerHTML = data.asks.slice(0, 20).map(([price, size]) => `
                <div class="order-row ask">
                    <span class="price" style="color:#ff4444">$${Number(price).toFixed(2)}</span>
                    <span class="size">${Number(size).toFixed(4)}</span>
                    <div class="depth-bar" style="width:${Math.min(Number(size) / 10, 100)}%"></div>
                </div>
            `).join('');
        }

        if (bidEl && data.bids[0]) bidEl.textContent = Number(data.bids[0][0]).toFixed(2);
        if (askEl && data.asks[0]) askEl.textContent = Number(data.asks[0][0]).toFixed(2);
        if (spreadEl && data.bids[0] && data.asks[0]) {
            spreadEl.textContent = (Number(data.asks[0][0]) - Number(data.bids[0][0])).toFixed(2);
        }
    }

    _updateTickerUI(data) {
        if (!data) return;

        const priceEl = document.getElementById('price');
        const lastPriceEl = document.getElementById('lastPrice');
        const markPriceEl = document.getElementById('markPrice');
        const volumeEl = document.getElementById('volume');
        const openInterestEl = document.getElementById('openInterest');
        const fundingRateEl = document.getElementById('fundingRate');

        if (priceEl && data.lastPrice) {
            priceEl.textContent = '$' + Number(data.lastPrice).toFixed(2);
        }
        if (lastPriceEl && data.lastPrice) {
            lastPriceEl.textContent = '$' + Number(data.lastPrice).toFixed(2);
        }
        if (markPriceEl && data.markPrice) {
            markPriceEl.textContent = '$' + Number(data.markPrice).toFixed(2);
        }
        if (volumeEl && data.volume) {
            volumeEl.textContent = Number(data.volume).toFixed(2);
        }
        if (openInterestEl && data.openInterest) {
            openInterestEl.textContent = Number(data.openInterest).toFixed(2);
        }
        if (fundingRateEl && data.fundingRate !== undefined) {
            fundingRateEl.textContent = (Number(data.fundingRate) * 100).toFixed(4) + '%';
        }
    }

    _updateTradesUI(data) {
        if (!data || !data.trades || data.trades.length === 0) return;

        const container = document.getElementById('trades-list');
        if (!container) return;

        container.innerHTML = data.trades.slice(0, 30).map(trade => `
            <div class="trade-row ${trade.side === 'buy' ? 'buy' : 'sell'}">
                <span class="price">$${Number(trade.price).toFixed(2)}</span>
                <span class="size">${Number(trade.size).toFixed(4)}</span>
                <span class="time">${new Date(trade.time).toLocaleTimeString()}</span>
            </div>
        `).join('');
    }

    // ============================================================
    // LOAD SYSTEM CONFIG
    // ============================================================

    async loadSystemConfig() {
        const url = 'https://raw.githubusercontent.com/risechain/rise-contracts/main/config/mainnet.json';
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const config = await response.json();
            console.log('✅ System config loaded:', config);
            window.SYSTEM_CONFIG = config;
            
            if (config.contracts) {
                window.RISEX_CONTRACTS = {
                    usdc: config.contracts.usdc,
                    perpsManager: config.contracts.perpsManager,
                    authorization: config.contracts.authorization,
                    router: config.contracts.router,
                    ordersManager: config.contracts.ordersManager
                };
                console.log('✅ RISEX_CONTRACTS:', window.RISEX_CONTRACTS);
            }
            return config;
        } catch (e) {
            console.error('❌ Failed to load system config:', e);
            return null;
        }
    }
}

// ============================================================
// === ГЛОБАЛЬНЫЙ ЭКСПОРТ (ОБЯЗАТЕЛЬНО!) ===
// ============================================================

// Создаём экземпляр
const risex = new RisexAPI();

// ЭКСПОРТИРУЕМ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
window.risex = risex;

// Также экспортируем основные методы для прямого доступа
window.startOrderBook = function(symbol = 1) {
    return risex.startOrderBook(symbol);
};
window.stopOrderBook = function() {
    return risex.stopOrderBook();
};
window.connectRisex = function() {
    return risex.connect();
};
window.disconnectRisex = function() {
    return risex.disconnect();
};

// Добавляем информацию о состоянии
window.risexState = {
    isConnected: () => risex._isConnected,
    wsUrl: risex._wsUrl,
    currentSymbol: () => risex._currentSymbol
};

console.log('%c✅ risex global exposed', 'color:#00ff9d;font-size:16px;font-weight:bold;');
console.log('📦 window.risex:', window.risex);
console.log('🔌 WS URL:', risex._wsUrl);
console.log('📡 Connected:', risex._isConnected);

// ============================================================
// АВТОМАТИЧЕСКИЙ ЗАПУСК (если нужно)
// ============================================================

// Можно раскомментировать для автостарта
// setTimeout(() => {
//     if (window.risex && !window.risex._isConnected) {
//         console.log('🔄 Auto-connecting...');
//         window.risex.connect().then(() => {
//             window.risex.startOrderBook(1);
//         }).catch(e => console.warn('Auto-connect failed:', e));
//     }
// }, 1000);

console.log('✅ RisexAPI initialized and ready');
