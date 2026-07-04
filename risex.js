// ============================================================
// RISEX API CLIENT - FULL FIXED VERSION
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

        // Используем глобальные конфиги
        this._wsUrl = (window.RISEX_API && window.RISEX_API.ws) 
            ? window.RISEX_API.ws 
            : 'wss://ws.rise.trade/ws';

        // Форсируем mainnet
        if (this._wsUrl.includes('testnet')) {
            console.warn('⚠️ Fixing testnet URL to mainnet');
            this._wsUrl = 'wss://ws.rise.trade/ws';
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
                    console.log('✅ WebSocket connected');
                    this._isConnected = true;
                    this._reconnectAttempts = 0;
                    this._startPing();
                    this._flushPendingMessages();
                    resolve(event);
                };
                this._ws.onmessage = this._handleMessage.bind(this);
                this._ws.onerror = (event) => {
                    console.error('❌ WebSocket error:', event);
                    reject(event);
                };
                this._ws.onclose = (event) => {
                    console.log(`🔌 WebSocket closed: code=${event.code}`);
                    this._isConnected = false;
                    this._stopPing();
                    if (!this._manualClose) {
                        this._reconnect();
                    }
                };

                // Timeout
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
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
        this._isConnected = false;
        console.log('🔌 WebSocket disconnected manually');
    }

    subscribe(channel, callback) {
        if (!this._isConnected) {
            console.warn('⚠️ Not connected, queueing subscription');
            this._pendingMessages.push({
                type: 'subscribe',
                channel: channel,
                callback: callback
            });
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

        // Remove all subscriptions for this channel
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
            console.log(`📤 Sent:`, message);
        } else {
            console.warn('⚠️ Cannot send, WebSocket not open');
            this._pendingMessages.push(message);
        }
    }

    _handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log(`📥 Received:`, data);

            // Handle ping
            if (data.type === 'ping') {
                this._send({ type: 'pong' });
                return;
            }

            // Handle subscription updates
            if (data.type === 'subscription' && data.data) {
                const callback = this._subscriptions.get(data.id);
                if (callback) {
                    callback(data.data);
                }
                return;
            }

            // Handle response
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
                this.connect().catch(() => {
                    // Will retry
                });
            }
        }, delay);
    }

    // ============================================================
    // ORDERBOOK METHODS
    // ============================================================

    getOrderBook(symbol, callback) {
        this.subscribe(`orderbook:${symbol}`, callback);
    }

    getTicker(symbol, callback) {
        this.subscribe(`ticker:${symbol}`, callback);
    }

    getTrades(symbol, callback) {
        this.subscribe(`trades:${symbol}`, callback);
    }

    getKline(symbol, interval, callback) {
        this.subscribe(`kline:${symbol}:${interval}`, callback);
    }

    // ============================================================
    // REST METHODS (fallback)
    // ============================================================

    async restRequest(endpoint, params = {}) {
        const httpUrl = (window.RISEX_API && window.RISEX_API.http) 
            ? window.RISEX_API.http 
            : 'https://api.rise.trade';
        
        const url = new URL(`${httpUrl}${endpoint}`);
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

    async getTradesRest(symbol, limit = 100) {
        return this.restRequest('/api/v1/trades', { symbol, limit });
    }

    async getKlineRest(symbol, interval, limit = 100) {
        return this.restRequest('/api/v1/kline', { symbol, interval, limit });
    }

    // ============================================================
    // CONTRACT METHODS
    // ============================================================

    async loadSystemConfig() {
        const url = window.SYSTEM_CONFIG_URL || 'https://raw.githubusercontent.com/risechain/rise-contracts/main/config/mainnet.json';
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const config = await response.json();
            console.log('✅ System config loaded:', config);
            
            // Store in window for other components
            window.SYSTEM_CONFIG = config;
            
            // Extract contract addresses
            if (config.contracts) {
                window.RISEX_CONTRACTS = {
                    usdc: config.contracts.usdc || '0xe436820ba0c69702c1d3e601d421c0ef38262739',
                    perpsManager: config.contracts.perpsManager || '0x53f10facfc8965750494e6965f5d6da39b41d852',
                    authorization: config.contracts.authorization || '0x0d919daa3f12ae715744eb648c00066c5dbd66f0',
                    router: config.contracts.router || '0xaadde0cea454f2bcb26f46ed54c5709b7bb34a7e',
                    ordersManager: config.contracts.ordersManager || '0xe03c1d5081eb2d0e6bfd62a949c5b12efa44f2cd'
                };
                console.log('✅ RISEX_CONTRACTS:', window.RISEX_CONTRACTS);
            }
            
            return config;
        } catch (e) {
            console.error('❌ Failed to load system config:', e);
            // Use fallback
            window.RISEX_CONTRACTS = window.RISEX_CONTRACTS || {
                usdc: '0xe436820ba0c69702c1d3e601d421c0ef38262739',
                perpsManager: '0x53f10facfc8965750494e6965f5d6da39b41d852',
                authorization: '0x0d919daa3f12ae715744eb648c00066c5dbd66f0',
                router: '0xaadde0cea454f2bcb26f46ed54c5709b7bb34a7e',
                ordersManager: '0xe03c1d5081eb2d0e6bfd62a949c5b12efa44f2cd'
            };
            return null;
        }
    }
}

// ============================================================
// EXPORT
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RisexAPI;
}

// Create global instance
const risex = new RisexAPI();
window.risex = risex;

console.log('✅ RisexAPI initialized and ready');
