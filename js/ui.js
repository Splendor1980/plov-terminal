// ============================================================
// js/ui.js — ТЕМА, ЛОГ, TOAST, ЦЕНА, ГРАФИК
// ============================================================

let lastPrice    = 0;
let priceHistory = [];
let priceInterval = null;
const MAX_BARS   = 60;

// ── Тема ─────────────────────────────────────────────────────

function toggleTheme() {
    const html = document.documentElement;
    const btn  = document.getElementById('theme-toggle');
    const light = html.getAttribute('data-theme') === 'light';
    html.setAttribute('data-theme', light ? 'dark' : 'light');
    if (btn) btn.textContent = light ? '☀️' : '🌙';
    localStorage.setItem('plov_theme', light ? 'dark' : 'light');
}

function loadTheme() {
    const saved = localStorage.getItem('plov_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = saved === 'light' ? '🌙' : '☀️';
}

// ── Лог ──────────────────────────────────────────────────────

function addToLog(msg, type = 'info', href = null) {
    const el = document.getElementById('trade-log');
    if (!el) return;

    // Убираем placeholder
    const placeholder = el.querySelector('.muted');
    if (placeholder && el.children.length === 1) el.innerHTML = '';

    const colors = {
        info:    'var(--text2)',
        success: 'var(--green)',
        error:   'var(--red)',
        pending: 'var(--orange)',
        warning: 'var(--orange)',
        meta:    'var(--text3)',
        link:    'var(--blue)'
    };

    const line = document.createElement('div');
    line.className  = 'log-line';
    line.style.color = colors[type] || colors.info;

    const time = new Date().toLocaleTimeString('ru-RU',
        { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (href) {
        const a = document.createElement('a');
        a.href = href; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = msg; a.style.color = colors.link;
        line.innerHTML = `[${time}] `;
        line.appendChild(a);
    } else {
        line.textContent = `[${time}] ${msg}`;
    }

    el.prepend(line);
    while (el.children.length > 150) el.removeChild(el.lastChild);
}

// ── Toast ─────────────────────────────────────────────────────

function showToast(msg, ms = 2800) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), ms);
}

// ── Цена UI ───────────────────────────────────────────────────

function updatePriceUI(price) {
    if (!price || price <= 0) return;

    const priceEl  = document.getElementById('btc-price');
    const topPrice = document.getElementById('top-price');
    const changeEl = document.getElementById('price-change');
    const topChg   = document.getElementById('top-change');

    if (priceEl)  priceEl.textContent  = price.toFixed(1);
    if (topPrice) topPrice.textContent = price.toFixed(1);

    if (lastPrice > 0 && price !== lastPrice) {
        const pct = ((price - lastPrice) / lastPrice * 100).toFixed(2);
        const chg = (pct >= 0 ? '+' : '') + pct + '%';
        if (changeEl) {
            changeEl.textContent = chg;
            changeEl.className   = 'price-change ' + (pct >= 0 ? '' : 'red');
        }
        if (topChg) {
            topChg.textContent = chg;
            topChg.className   = 'top-change ' + (pct >= 0 ? '' : 'red');
        }
    }

    // История для графика
    priceHistory.push(price);
    if (priceHistory.length > MAX_BARS) priceHistory.shift();
    updateChart();

    // PnL позиции
    if (typeof updatePnL === 'function') updatePnL();

    // Подзаголовки кнопок
    const buySub  = document.getElementById('buy-sub');
    const sellSub = document.getElementById('sell-sub');
    if (currentMode === 'perp') {
        if (buySub)  buySub.textContent  = `×${currentLeverage}`;
        if (sellSub) sellSub.textContent = `×${currentLeverage}`;
    }
}

// ── График (SVG-bars) ─────────────────────────────────────────

function initChart() {
    const container = document.getElementById('chart-container');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < MAX_BARS; i++) {
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = '4px';
        container.appendChild(bar);
    }
}

function updateChart() {
    const bars = document.querySelectorAll('.chart-bar');
    if (!bars.length || priceHistory.length < 2) return;

    const min   = Math.min(...priceHistory);
    const max   = Math.max(...priceHistory);
    const range = max - min || 1;
    const high  = document.getElementById('chart-high');
    const low   = document.getElementById('chart-low');
    if (high) high.textContent = 'H: ' + max.toFixed(0);
    if (low)  low.textContent  = 'L: ' + min.toFixed(0);

    const start = Math.max(0, priceHistory.length - bars.length);
    const vis   = priceHistory.slice(start);

    bars.forEach((bar, i) => {
        if (i < vis.length) {
            const h   = Math.max(3, ((vis[i] - min) / range) * 96);
            const up  = i > 0 ? vis[i] >= vis[i - 1] : true;
            bar.style.height = h + '%';
            bar.className    = 'chart-bar ' + (up ? 'green' : 'red');
        } else {
            bar.style.height = '4px';
            bar.className    = 'chart-bar';
        }
    });
}

// ── Прайс-фид через REST polling (резервный) ─────────────────
// WebSocket — основной источник цены. REST — резервный если WS упал.

async function pollPrice() {
    try {
        const res = await fetch(`${RISEX_API.rest}/v1/markets`);
        if (!res.ok) return;
        const data    = await res.json();
        const markets = data.data?.markets || data.markets || [];
        const market  = markets.find(m => String(m.market_id) === String(currentMarket))
                     || markets[0];
        if (!market) return;
        const norm  = v => { const n = parseFloat(v); return n > 1e15 ? n / 1e18 : n; };
        // Пробуем разные поля где может быть цена
        const price = norm(
            market.mark_price      || market.last_price     ||
            market.index_price     || market.oracle_price   ||
            market.ticker?.mark_price || market.ticker?.last_price ||
            market.stats?.last_price  || 0
        );
        if (price > 0) { lastPrice = price; updatePriceUI(price); }
    } catch {}
}

function startPriceFeed() {
    if (priceInterval) clearInterval(priceInterval);
    // Поллинг каждые 5 сек как резервный источник (WS — основной)
    priceInterval = setInterval(pollPrice, 5000);
    pollPrice(); // сразу
}

function stopPriceFeed() {
    if (priceInterval) { clearInterval(priceInterval); priceInterval = null; }
}

// ── Init UI ──────────────────────────────────────────────────

function initUI() {
    loadTheme();
}

function switchLogTab(tab) {
    document.getElementById('pane-log').style.display      = tab === 'log'      ? 'block' : 'none';
    document.getElementById('pane-mytrades').style.display = tab === 'mytrades' ? 'block' : 'none';
    document.getElementById('tab-log').classList.toggle('active',      tab === 'log');
    document.getElementById('tab-mytrades').classList.toggle('active', tab === 'mytrades');
}
window.switchLogTab  = switchLogTab;
window.toggleTheme   = toggleTheme;
window.showToast     = showToast;
window.addToLog      = addToLog;
window.updatePriceUI = updatePriceUI;
window.initChart     = initChart;
window.updateChart   = updateChart;
window.startPriceFeed = startPriceFeed;
window.stopPriceFeed  = stopPriceFeed;
window.initUI        = initUI;
window.lastPrice     = lastPrice;
console.log('%cUI loaded', 'color:#00ff9d');
