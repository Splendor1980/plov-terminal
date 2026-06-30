// ============================================================
// js/trading.js — ТОРГОВЛЯ, ПОЗИЦИЯ, СТАТИСТИКА
// ============================================================

let isSubmitting = false;

let position = {
    side:       null,
    size:       0,
    entryPrice: 0,
    leverage:   1,
    margin:     0
};

let stats = {
    trades: 0, wins: 0, volume: 0,
    best: 0, worst: 0
};

// История своих сделок (симуляция)
let myTrades = [];

function addMyTrade(side, price, size, leverage, pnl = null) {
    const trade = {
        side,
        price,
        size,
        leverage,
        pnl,
        time: new Date()
    };
    myTrades.unshift(trade);
    if (myTrades.length > 100) myTrades.pop();
    renderMyTrades();
    // Сохраняем
    if (currentUser) {
        localStorage.setItem(`plov_trades_${currentUser.uid}`,
            JSON.stringify(myTrades.slice(0, 50)));
    }
}

function loadMyTrades(uid) {
    uid = uid || currentUser?.uid;
    if (!uid) return;
    try {
        const saved = localStorage.getItem(`plov_trades_${uid}`);
        if (saved) {
            myTrades = JSON.parse(saved).map(t => ({
                ...t, time: new Date(t.time)
            }));
            renderMyTrades();
        }
    } catch {}
}

function renderMyTrades() {
    const el = document.getElementById('my-trades-list');
    if (!el) return;
    if (!myTrades.length) {
        el.innerHTML = '<div class="no-trades">Нет сделок</div>';
        return;
    }
    el.innerHTML = myTrades.slice(0, 20).map(t => {
        const pnlStr = t.pnl !== null
            ? `<span class="${t.pnl >= 0 ? 'green' : 'red'}">${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}</span>`
            : '';
        const time = t.time instanceof Date
            ? t.time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            : '';
        const sideClass = t.side === 'LONG' ? 'green' : 'red';
        return `<div class="my-trade-row">
            <span class="mt-side ${sideClass}">${t.side}</span>
            <span class="mt-price">${t.price.toFixed(1)}</span>
            <span class="mt-size">${t.size.toFixed(5)}</span>
            <span class="mt-lev">×${t.leverage}</span>
            <span class="mt-pnl">${pnlStr}</span>
            <span class="mt-time">${time}</span>
        </div>`;
    }).join('');
}

// ── Кнопки BUY / SELL ────────────────────────────────────────

async function handleBuyClick() {
    if (!isSignerReady()) { addToLog(t('signer_required'), 'error'); return; }
    if (isSubmitting) return;
    await _submit('LONG');
}

async function handleSellClick() {
    if (!isSignerReady()) { addToLog(t('signer_required'), 'error'); return; }
    if (isSubmitting) return;
    await _submit('SHORT');
}

async function _submit(side) {
    const inp    = document.getElementById('amount-input');
    const amount = parseFloat(inp?.value);
    if (!amount || amount <= 0) {
        addToLog(t('amount_invalid'), 'warning'); return;
    }

    const balance = userBalance || 0;
    if (amount > balance) {
        addToLog(`${t('balance_low')} ${balance.toFixed(2)})`, 'error');
        return;
    }

    isSubmitting = true;
    const buyBtn  = document.getElementById('btn-buy');
    const sellBtn = document.getElementById('btn-sell');
    if (buyBtn)  buyBtn.disabled  = true;
    if (sellBtn) sellBtn.disabled = true;

    try {
        await placeOrder(side, amount, currentLeverage);
    } finally {
        isSubmitting = false;
        if (buyBtn)  buyBtn.disabled  = false;
        if (sellBtn) sellBtn.disabled = false;
    }
}

// ── % от баланса ─────────────────────────────────────────────

function setPct(pct) {
    const balance = userBalance || 0;
    const inp     = document.getElementById('amount-input');
    if (inp) inp.value = (balance * pct / 100).toFixed(2);
}

// ── Режим торговли ────────────────────────────────────────────



// ── Плечо ────────────────────────────────────────────────────

function setLeverage(lev) {
    currentLeverage = lev;
    document.querySelectorAll('.lev-btn').forEach(b =>
        b.classList.toggle('active', parseInt(b.dataset.lev) === lev));

    const buySub  = document.getElementById('buy-sub');
    const sellSub = document.getElementById('sell-sub');
    if (buySub)  buySub.textContent  = `×${lev}`;
    if (sellSub) sellSub.textContent = `×${lev}`;
}

// ── Позиция UI ────────────────────────────────────────────────

function updatePositionUI(pos) {
    const sideEl  = document.getElementById('pos-side');
    const sizeEl  = document.getElementById('pos-size');
    const entryEl = document.getElementById('pos-entry');
    const liqEl   = document.getElementById('pos-liq');
    const pnlEl   = document.getElementById('pos-pnl');
    const closeBtn = document.getElementById('btn-close-pos');

    if (!pos || !pos.size || pos.size <= 0) {
        if (sideEl)  sideEl.textContent  = '---';
        if (sizeEl)  sizeEl.textContent  = '---';
        if (entryEl) entryEl.textContent = '---';
        if (liqEl)   liqEl.textContent   = '---';
        if (pnlEl)   pnlEl.textContent   = '+0.00 USDC';
        if (closeBtn) closeBtn.style.display = 'none';
        return;
    }

    position = pos;
    if (closeBtn) closeBtn.style.display = 'block';

    if (sideEl) {
        sideEl.textContent = pos.side === 'long' ? '🟢 LONG' : '🔴 SHORT';
        sideEl.className   = 'pos-val ' + (pos.side === 'long' ? 'green' : 'red');
    }
    if (sizeEl)  sizeEl.textContent  = (pos.size || 0).toFixed(6) + ' BTC';
    if (entryEl) entryEl.textContent = (pos.entryPrice || 0).toFixed(2) + ' USDC';

    // Ликвидационная цена (упрощённая формула)
    if (liqEl && pos.entryPrice && pos.leverage) {
        const maintenanceMargin = 0.005; // 0.5%
        const liqPrice = pos.side === 'long'
            ? pos.entryPrice * (1 - 1 / pos.leverage + maintenanceMargin)
            : pos.entryPrice * (1 + 1 / pos.leverage - maintenanceMargin);
        liqEl.textContent = liqPrice.toFixed(2) + ' USDC';
    }

    updatePnL();
}

function updatePnL() {
    if (!position || !position.size || position.size <= 0 || !lastPrice) return;
    const pnlEl = document.getElementById('pos-pnl');
    if (!pnlEl) return;

    const pnl = position.side === 'long'
        ? (lastPrice - position.entryPrice) * position.size * (position.leverage || 1)
        : (position.entryPrice - lastPrice) * position.size * (position.leverage || 1);

    pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + ' USDC';
    pnlEl.className   = 'pos-val ' + (pnl >= 0 ? 'green' : 'red');
}

// ── Статистика ────────────────────────────────────────────────

function saveStats(side, volume, win) {
    stats.trades++;
    stats.volume += volume;
    if (win) stats.wins++;
    updateStatsUI();
    // Сохраняем в localStorage
    if (currentUser) {
        localStorage.setItem(`plov_stats_${currentUser.uid}`, JSON.stringify({
            trades: stats.trades, wins: stats.wins, volume: stats.volume
        }));
    }
}

function updateStatsUI() {
    const tradesEl  = document.getElementById('stat-trades');
    const winrateEl = document.getElementById('stat-winrate');
    const volumeEl  = document.getElementById('stat-volume');

    if (tradesEl)  tradesEl.textContent  = stats.trades;
    if (winrateEl) winrateEl.textContent =
        stats.trades ? ((stats.wins / stats.trades) * 100).toFixed(0) + '%' : '0%';
    if (volumeEl)  volumeEl.textContent  =
        stats.volume.toFixed(0) + ' USDC';
}

async function loadStats(uid) {
    uid = uid || currentUser?.uid;
    if (!uid) return;
    try {
        const saved = localStorage.getItem(`plov_stats_${uid}`);
        if (saved) {
            const d = JSON.parse(saved);
            stats.trades = d.trades || 0;
            stats.wins   = d.wins   || 0;
            stats.volume = d.volume || 0;
            updateStatsUI();
        }
    } catch {}
}

window.handleBuyClick   = handleBuyClick;
window.handleSellClick  = handleSellClick;
window.setPct           = setPct;
window.setLeverage      = setLeverage;
window.updatePositionUI = updatePositionUI;
window.updatePnL        = updatePnL;
window.updateStatsUI    = updateStatsUI;
window.loadStats        = loadStats;
window.loadMyTrades     = loadMyTrades;
window.renderMyTrades   = renderMyTrades;
window.addMyTrade       = addMyTrade;
console.log('%cTrading loaded', 'color:#00ff9d');
