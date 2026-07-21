// ============================================================
// js/tpsl-ui.js — UI-обвязка для Take Profit / Stop Loss
// ============================================================
// Реальная подпись/сеть — в risex.js (approveTpSlBudget,
// signAndPlaceTpSlOrder, fetchTpSlOrders, cancelTpSlOrder).
// Этот файл — только UI: кнопки, инпуты, рендер списка.
// ============================================================

function tpslEnabledKey() {
    return currentUser ? `plov_tpsl_enabled_${currentUser.uid}` : null;
}

function isTpSlEnabledLocally() {
    const key = tpslEnabledKey();
    return key ? localStorage.getItem(key) === '1' : false;
}

function updateTpSlPanel() {
    const notEnabled = document.getElementById('tpsl-not-enabled');
    const enabled     = document.getElementById('tpsl-enabled');
    if (!notEnabled || !enabled) return;
    const on = isTpSlEnabledLocally();
    notEnabled.style.display = on ? 'none' : 'block';
    enabled.style.display    = on ? 'block' : 'none';
    if (on && typeof renderTpSlOrders === 'function') renderTpSlOrders();
}
window.updateTpSlPanel = updateTpSlPanel;

async function handleApproveTpSlBudget() {
    const budgetInput = document.getElementById('tpsl-budget-input');
    const budget = parseFloat(budgetInput?.value);
    if (!budget || budget <= 0) {
        addToLog('⚠️ Укажи бюджет TP/SL в USDC', 'warning');
        return;
    }

    const btn = document.getElementById('btn-approve-tpsl');
    if (btn) { btn.disabled = true; btn.textContent = 'Confirm in wallet...'; }

    try {
        addToLog('⏳ Approving TP/SL budget (подпиши в Rabby)...', 'pending');
        await approveTpSlBudget(budget, 365);
        const key = tpslEnabledKey();
        if (key) localStorage.setItem(key, '1');
        addToLog('✅ TP/SL enabled', 'success');
        updateTpSlPanel();
    } catch (e) {
        console.error('approveTpSlBudget error:', e);
        addToLog(`❌ TP/SL enable failed: ${e.message}`, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Enable TP/SL'; }
    }
}
window.handleApproveTpSlBudget = handleApproveTpSlBudget;

async function handleSetTpSl() {
    if (!position || !position.size || position.size <= 0) {
        addToLog('❌ Нет открытой позиции', 'error');
        return;
    }

    const slInput = document.getElementById('tpsl-sl-input');
    const tpInput = document.getElementById('tpsl-tp-input');
    const slPrice = parseFloat(slInput?.value);
    const tpPrice = parseFloat(tpInput?.value);

    if (!slPrice && !tpPrice) {
        addToLog('⚠️ Укажи цену Stop Loss и/или Take Profit', 'warning');
        return;
    }

    // Закрывающий TP/SL — сторона ПРОТИВОПОЛОЖНАЯ текущей позиции
    const closeSide = position.side === 'long' ? 1 : 0; // 0=Buy,1=Sell

    try {
        if (slPrice > 0) {
            addToLog('⏳ Placing Stop Loss...', 'pending');
            await signAndPlaceTpSlOrder({
                marketId: currentMarket, side: closeSide, humanSize: position.size,
                stopType: TPSL_STOP_TYPE.STOP_LOSS, stopPrice: slPrice,
                stopPriceOption: TPSL_PRICE_OPTION.MARK_PRICE, sizePercentBps: 10000,
            });
            addToLog(`✅ Stop Loss @ $${slPrice}`, 'success');
        }
        if (tpPrice > 0) {
            addToLog('⏳ Placing Take Profit...', 'pending');
            await signAndPlaceTpSlOrder({
                marketId: currentMarket, side: closeSide, humanSize: position.size,
                stopType: TPSL_STOP_TYPE.TAKE_PROFIT, stopPrice: tpPrice,
                stopPriceOption: TPSL_PRICE_OPTION.MARK_PRICE, sizePercentBps: 10000,
            });
            addToLog(`✅ Take Profit @ $${tpPrice}`, 'success');
        }
        renderTpSlOrders();
    } catch (e) {
        console.error('handleSetTpSl error:', e);
        addToLog(`❌ TP/SL failed: ${e.message}`, 'error');
    }
}
window.handleSetTpSl = handleSetTpSl;

async function renderTpSlOrders() {
    const listEl = document.getElementById('tpsl-orders-list');
    if (!listEl) return;
    const orders = await fetchTpSlOrders();
    const active = orders.filter(o => o.status === 'TPSL_ORDER_STATUS_ACCEPTED');

    if (!active.length) {
        listEl.innerHTML = `<div class="no-trades muted">${typeof t === 'function' ? t('tpsl_no_active') : 'No active TP/SL'}</div>`;
        return;
    }

    listEl.innerHTML = active.map(o => `
        <div class="my-trade-row">
            <span class="mt-side ${o.stop_type === 'TAKE_PROFIT' ? 'green' : 'red'}">${o.stop_type === 'TAKE_PROFIT' ? 'TP' : 'SL'}</span>
            <span class="mt-price">${parseFloat(o.stop_price).toFixed(1)}</span>
            <span class="mt-size">${parseFloat(o.size).toFixed(5)}</span>
            <button class="btn-sm btn-red" style="padding:2px 8px;font-size:11px;"
                onclick="handleCancelTpSl('${o.order_id}')">✕</button>
        </div>
    `).join('');
}
window.renderTpSlOrders = renderTpSlOrders;

async function handleCancelTpSl(orderId) {
    try {
        await cancelTpSlOrder(orderId);
        addToLog('✅ TP/SL cancelled', 'success');
        renderTpSlOrders();
    } catch (e) {
        console.error('handleCancelTpSl error:', e);
        addToLog(`❌ Cancel failed: ${e.message}`, 'error');
    }
}
window.handleCancelTpSl = handleCancelTpSl;

console.log('%cTP/SL UI loaded', 'color:#00ff9d');
