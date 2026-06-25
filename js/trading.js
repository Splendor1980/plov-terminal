// ============================================================
// js/trading.js — ТОРГОВЛЯ, ПОЗИЦИЯ, СТАТИСТИКА
// ============================================================

let isSubmitting = false;

let position = {
    side:       null,   // 'long' | 'short'
    size:       0,      // в BTC
    entryPrice: 0,
    leverage:   1
};

let stats = {
    trades: 0, wins: 0, volume: 0,
    best: 0, worst: 0
};

// ── Кнопки BUY / SELL ────────────────────────────────────────

async function handleBuyClick() {
    if (!isLoggedIn) { addToLog(t('login_required'), 'error'); return; }
    if (isSubmitting) return;
    await _submit('LONG');
}

async function handleSellClick() {
    if (!isLoggedIn) { addToLog(t('login_required'), 'error'); return; }
    if (isSubmitting) return;
    await _submit('SHORT');
}

async function _submit(side) {
    const inp    = document.getElementById('amount-input');
    const amount = parseFloat(inp?.value);
    if (!amount || amount <= 0) {
        addToLog('⚠️ Введите сумму USDC', 'warning'); return;
    }

    const balance = userWallet.risexBalance || userWallet.balances.usdc || 0;
    if (amount > balance) {
        addToLog(`❌ Недостаточно USDC (баланс: ${balance.toFixed(2)})`, 'error');
        return;
    }

    isSubmitting = true;
    const buyBtn  = document.getElementById('btn-buy');
    const sellBtn = document.getElementById('btn-sell');
    if (buyBtn)  buyBtn.disabled  = true;
    if (sellBtn) sellBtn.disabled = true;

    try {
        await placeOrder(side, amount, currentLeverage, currentUser.uid);
    } finally {
        isSubmitting = false;
        if (buyBtn)  buyBtn.disabled  = false;
        if (sellBtn) sellBtn.disabled = false;
    }
}

// ── % от баланса ─────────────────────────────────────────────

function setPct(pct) {
    const balance = userWallet.risexBalance || userWallet.balances.usdc || 0;
    const inp     = document.getElementById('amount-input');
    if (inp) inp.value = (balance * pct / 100).toFixed(2);
}

// ── Режим торговли ────────────────────────────────────────────

function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.mode === mode));

    const levRow = document.getElementById('leverage-row');
    if (levRow) levRow.style.display = mode === 'perp' ? 'flex' : 'none';

    const buyLabel  = document.getElementById('btn-buy-label');
    const sellLabel = document.getElementById('btn-sell-label');
    if (mode === 'perp') {
        if (buyLabel)  buyLabel.textContent  = '📈 LONG';
        if (sellLabel) sellLabel.textContent = '📉 SHORT';
        document.getElementById('buy-sub').textContent  = `×${currentLeverage}`;
        document.getElementById('sell-sub').textContent = `×${currentLeverage}`;
    } else {
        if (buyLabel)  buyLabel.textContent  = '📈 BUY';
        if (sellLabel) sellLabel.textContent = '📉 SELL';
        document.getElementById('buy-sub').textContent  = 'Купить BTC';
        document.getElementById('sell-sub').textContent = 'Продать BTC';
    }
}

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

    // Сохраняем в Firestore
    if (typeof fbDb !== 'undefined' && currentUser) {
        fbDb.collection('stats').doc(currentUser.uid).set({
            trades: stats.trades,
            wins:   stats.wins,
            volume: stats.volume
        }, { merge: true }).catch(() => {});
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

async function loadStats() {
    if (typeof fbDb === 'undefined' || !currentUser) return;
    try {
        const doc = await fbDb.collection('stats').doc(currentUser.uid).get();
        if (doc.exists) {
            const d    = doc.data();
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
window.setMode          = setMode;
window.setLeverage      = setLeverage;
window.updatePositionUI = updatePositionUI;
window.updatePnL        = updatePnL;
window.updateStatsUI    = updateStatsUI;
window.loadStats        = loadStats;
console.log('%cTrading loaded', 'color:#00ff9d');
