// ============================================================
// PLOV SCALPING TERMINAL v3.0 - MAIN
// ============================================================

(function() {
    'use strict';

    console.log('🚀 PLOV Scalping Terminal v3.0 starting...');

    // ============================================================
    // STATE
    // ============================================================

    const state = {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        price: 0,
        bid: 0,
        ask: 0,
        spread: 0,
        volume: 0,
        openInterest: 0,
        fundingRate: 0,
        markPrice: 0,
        lastPrice: 0,
        orderBook: { bids: [], asks: [] },
        trades: [],
        klines: [],
        indicators: {},
        isConnected: false,
        isTrading: false,
        position: null,
        orders: [],
        balance: 0,
        equity: 0,
        pnl: 0,
        pnlPercent: 0
    };

    // ============================================================
    // DOM REFS
    // ============================================================

    const DOM = {};

    function initDOM() {
        DOM.price = document.getElementById('price');
        DOM.bid = document.getElementById('bid');
        DOM.ask = document.getElementById('ask');
        DOM.spread = document.getElementById('spread');
        DOM.volume = document.getElementById('volume');
        DOM.openInterest = document.getElementById('openInterest');
        DOM.fundingRate = document.getElementById('fundingRate');
        DOM.markPrice = document.getElementById('markPrice');
        DOM.lastPrice = document.getElementById('lastPrice');
        DOM.bidsContainer = document.getElementById('bids');
        DOM.asksContainer = document.getElementById('asks');
        DOM.tradesContainer = document.getElementById('trades');
        DOM.status = document.getElementById('status');
        DOM.balance = document.getElementById('balance');
        DOM.equity = document.getElementById('equity');
        DOM.pnl = document.getElementById('pnl');
        DOM.pnlPercent = document.getElementById('pnlPercent');
        DOM.positions = document.getElementById('positions');
        DOM.orders = document.getElementById('orders');
        DOM.chart = document.getElementById('chart');
    }

    // ============================================================
    // UI UPDATES
    // ============================================================

    function updatePrice(data) {
        if (data.price) {
            state.price = data.price;
            if (DOM.price) {
                DOM.price.textContent = `$${formatNumber(data.price)}`;
                DOM.price.style.color = data.price >= state.lastPrice ? '#00ff88' : '#ff4444';
            }
            state.lastPrice = data.price;
        }
    }

    function updateOrderBook(data) {
        if (data.bids && data.asks) {
            state.orderBook.bids = data.bids.slice(0, 20);
            state.orderBook.asks = data.asks.slice(0, 20);
            renderOrderBook();
            
            if (state.orderBook.bids.length > 0) {
                state.bid = state.orderBook.bids[0][0];
                if (DOM.bid) DOM.bid.textContent = `$${formatNumber(state.bid)}`;
            }
            if (state.orderBook.asks.length > 0) {
                state.ask = state.orderBook.asks[0][0];
                if (DOM.ask) DOM.ask.textContent = `$${formatNumber(state.ask)}`;
            }
            if (state.bid && state.ask) {
                state.spread = state.ask - state.bid;
                if (DOM.spread) DOM.spread.textContent = `$${formatNumber(state.spread)}`;
            }
        }
    }

    function updateTrades(data) {
        if (data.trades) {
            state.trades = data.trades.slice(0, 50);
            renderTrades();
        }
    }

    function updateTicker(data) {
        if (data.volume) {
            state.volume = data.volume;
            if (DOM.volume) DOM.volume.textContent = formatNumber(data.volume);
        }
        if (data.openInterest !== undefined) {
            state.openInterest = data.openInterest;
            if (DOM.openInterest) DOM.openInterest.textContent = formatNumber(data.openInterest);
        }
        if (data.fundingRate !== undefined) {
            state.fundingRate = data.fundingRate;
            if (DOM.fundingRate) DOM.fundingRate.textContent = `${(data.fundingRate * 100).toFixed(4)}%`;
        }
        if (data.markPrice) {
            state.markPrice = data.markPrice;
            if (DOM.markPrice) DOM.markPrice.textContent = `$${formatNumber(data.markPrice)}`;
        }
    }

    function renderOrderBook() {
        if (!DOM.bidsContainer || !DOM.asksContainer) return;
        
        // Bids (buy orders) - descending
        DOM.bidsContainer.innerHTML = state.orderBook.bids
            .map(([price, size]) => `
                <div class="order-row bid">
                    <span class="price" style="color:#00ff88">${formatNumber(price)}</span>
                    <span class="size">${formatNumber(size)}</span>
                    <div class="depth-bar" style="width:${Math.min(size / 10, 100)}%"></div>
                </div>
            `).join('');

        // Asks (sell orders) - ascending
        DOM.asksContainer.innerHTML = state.orderBook.asks
            .map(([price, size]) => `
                <div class="order-row ask">
                    <span class="price" style="color:#ff4444">${formatNumber(price)}</span>
                    <span class="size">${formatNumber(size)}</span>
                    <div class="depth-bar" style="width:${Math.min(size / 10, 100)}%"></div>
                </div>
            `).join('');
    }

    function renderTrades() {
        if (!DOM.tradesContainer) return;
        
        DOM.tradesContainer.innerHTML = state.trades
            .map(trade => `
                <div class="trade-row ${trade.side === 'buy' ? 'buy' : 'sell'}">
                    <span class="price">${formatNumber(trade.price)}</span>
                    <span class="size">${formatNumber(trade.size)}</span>
                    <span class="time">${new Date(trade.time).toLocaleTimeString()}</span>
                </div>
            `).join('');
    }

    function updateStatus(connected) {
        state.isConnected = connected;
        if (DOM.status) {
            DOM.status.textContent = connected ? '🟢 Connected' : '🔴 Disconnected';
            DOM.status.style.color = connected ? '#00ff88' : '#ff4444';
        }
    }

    function updateAccount(data) {
        if (data.balance !== undefined) {
            state.balance = data.balance;
            if (DOM.balance) DOM.balance.textContent = `$${formatNumber(data.balance)}`;
        }
        if (data.equity !== undefined) {
            state.equity = data.equity;
            if (DOM.equity) DOM.equity.textContent = `$${formatNumber(data.equity)}`;
        }
        if (data.pnl !== undefined) {
            state.pnl = data.pnl;
            if (DOM.pnl) {
                DOM.pnl.textContent = `$${formatNumber(data.pnl)}`;
                DOM.pnl.style.color = data.pnl >= 0 ? '#00ff88' : '#ff4444';
            }
        }
        if (data.pnlPercent !== undefined) {
            state.pnlPercent = data.pnlPercent;
            if (DOM.pnlPercent) {
                DOM.pnlPercent.textContent = `${data.pnlPercent.toFixed(2)}%`;
                DOM.pnlPercent.style.color = data.pnlPercent >= 0 ? '#00ff88' : '#ff4444';
            }
        }
    }

    function formatNumber(num) {
        if (num === undefined || num === null) return '0.00';
        if (num >= 1000) return num.toFixed(2);
        if (num >= 1) return num.toFixed(4);
        return num.toFixed(6);
    }

    // ============================================================
    // WEB3 / CONTRACT INTERACTIONS (placeholder)
    // ============================================================

    async function initWeb3() {
        try {
            if (typeof window.ethereum !== 'undefined') {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                console.log('✅ Web3 connected');
                return true;
            } else {
                console.warn('⚠️ No Web3 wallet detected');
                return false;
            }
        } catch (e) {
            console.error('❌ Web3 init error:', e);
            return false;
        }
    }

    // ============================================================
    // CHART (placeholder)
    // ============================================================

    function initChart() {
        if (!DOM.chart) return;
        // Simple placeholder chart
        DOM.chart.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">
                📊 Chart placeholder<br>
                <span style="font-size:12px;">${state.symbol} - ${state.timeframe}</span>
            </div>
        `;
    }

    // ============================================================
    // TRADING LOGIC (placeholder)
    // ============================================================

    function startTrading() {
        if (state.isTrading) {
            console.log('⚠️ Already trading');
            return;
        }
        state.isTrading = true;
        console.log('▶️ Trading started');
        // Placeholder - implement actual trading logic
    }

    function stopTrading() {
        if (!state.isTrading) return;
        state.isTrading = false;
        console.log('⏹️ Trading stopped');
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    async function init() {
        console.log('📦 Initializing PLOV Terminal...');

        // 1. DOM
        initDOM();

        // 2. Check config
        console.log('🔍 Config check:', {
            USE_MAINNET: window.USE_MAINNET,
            RISEX_API: window.RISEX_API,
            WS_URL: window.RISEX_API?.ws
        });

        // 3. Load system config
        if (window.risex) {
            try {
                await window.risex.loadSystemConfig();
                console.log('✅ System config loaded');
            } catch (e) {
                console.error('❌ Failed to load system config:', e);
            }
        }

        // 4. Connect WebSocket
        if (window.risex) {
            try {
                await window.risex.connect();
                updateStatus(true);
                
                // Subscribe to data
                window.risex.getOrderBook(state.symbol, updateOrderBook);
                window.risex.getTicker(state.symbol, updateTicker);
                window.risex.getTrades(state.symbol, updateTrades);
                
                console.log('✅ Subscribed to data streams');
            } catch (e) {
                console.error('❌ Failed to connect WebSocket:', e);
                updateStatus(false);
                
                // Fallback to REST polling
                console.log('🔄 Using REST polling fallback');
                startRESTPolling();
            }
        }

        // 5. Web3
        await initWeb3();

        // 6. Chart
        initChart();

        // 7. UI updates
        updateStatus(state.isConnected);

        console.log('✅ PLOV Terminal initialized successfully');
        console.log('💡 State:', state);
    }

    // ============================================================
    // REST POLLING FALLBACK
    // ============================================================

    function startRESTPolling() {
        if (window._pollingInterval) {
            clearInterval(window._pollingInterval);
        }

        window._pollingInterval = setInterval(async () => {
            try {
                if (window.risex) {
                    // Get orderbook
                    const ob = await window.risex.getOrderBookRest(state.symbol);
                    if (ob) updateOrderBook(ob);
                    
                    // Get ticker
                    const ticker = await window.risex.getTickerRest(state.symbol);
                    if (ticker) {
                        updateTicker(ticker);
                        updatePrice({ price: ticker.lastPrice });
                    }
                }
            } catch (e) {
                console.error('❌ REST polling error:', e);
            }
        }, 2000);
    }

    // ============================================================
    // KEYBOARD SHORTCUTS
    // ============================================================

    document.addEventListener('keydown', (e) => {
        // Ctrl+Enter - Start/Stop trading
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            if (state.isTrading) {
                stopTrading();
            } else {
                startTrading();
            }
        }
        // Space - Refresh
        if (e.key === ' ' && !e.target.matches('input, textarea')) {
            e.preventDefault();
            console.log('🔄 Manual refresh');
        }
    });

    // ============================================================
    // START
    // ============================================================

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export state for debugging
    window.__state = state;

    console.log('✅ PLOV main script loaded');

})();