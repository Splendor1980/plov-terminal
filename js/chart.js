// ============================================================
// js/chart.js — ТИКОВАЯ ЛЕНТА (главная) + OHLC-контекст (второстепенный)
// ============================================================
// Для секундного скальпинга минутный бар — устаревшая на 60 секунд
// информация. Основной график теперь — реальные исполненные сделки
// (WS channel: trades) без агрегации по времени вообще, гранулярность
// ограничена только частотой реальных сделок на рынке.
//
// OHLC-бары (GET /v1/markets/id/{market_id}/trading-view-data,
// developer.rise.trade/reference/marketservice_gettradingviewdatav2)
// остаются как второстепенная полоса внизу — общий контекст "где цена
// была последние 10-15 минут", не основной инструмент принятия решений.
// ============================================================

let candles          = [];      // [{time(ms), open, high, low, close, volume}]
let chartTimeframe   = '1m';
let chartRefreshTimer = null;
let tickBuffer        = [];     // [{time(ms), price, side}]

const CHART_TF_NS = {
    '1m':  60_000_000_000n,
    '5m':  300_000_000_000n,
    '15m': 900_000_000_000n,
    '1h':  3_600_000_000_000n,
};
const CHART_TF_MS = {
    '1m': 60_000, '5m': 300_000, '15m': 900_000, '1h': 3_600_000,
};
const CHART_CANDLE_COUNT = 60;
const TICK_WINDOW_MS     = 60_000; // окно тиковой ленты — последние 60 сек

// Доля высоты canvas'а: тиковая лента (главное) / объёмные бары / OHLC-контекст
const TICK_AREA_RATIO   = 0.52;
const VOLUME_AREA_RATIO = 0.20;

function getChartCanvas() {
    const canvas = document.getElementById('chart-canvas');
    if (!canvas) return null;
    const wrap = canvas.parentElement;
    const dpr  = window.devicePixelRatio || 1;
    const w    = wrap.clientWidth  || 300;
    const h    = wrap.clientHeight || 145;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width  = w * dpr;
        canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { canvas, ctx, w, h };
}

function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

// ── Тиковая лента (главный график) ──────────────────────────
// Вызывается из risex.js при каждой реальной исполненной сделке
// (WS channel: trades) — не путать с updateLiveCandle(), которая
// вызывается на каждое обновление цены (чаще, из ордербука).
function pushChartTick(price, side, size = 0) {
    if (!price || price <= 0) return;
    tickBuffer.push({ time: Date.now(), price, side, size });
    const cutoff = Date.now() - TICK_WINDOW_MS;
    while (tickBuffer.length && tickBuffer[0].time < cutoff) tickBuffer.shift();
    renderChart();
}
window.pushChartTick = pushChartTick;

let _largeOrderMarkers = []; // [{time, price, side}]

function flashLargeOrderOnChart(price, side) {
    _largeOrderMarkers.push({ time: Date.now(), price, side });
    const cutoff = Date.now() - TICK_WINDOW_MS;
    _largeOrderMarkers = _largeOrderMarkers.filter(m => m.time >= cutoff);
}
window.flashLargeOrderOnChart = flashLargeOrderOnChart;

function renderTickArea(ctx, w, tickH) {
    const cutoff = Date.now() - TICK_WINDOW_MS;
    const ticks  = tickBuffer.filter(t => t.time >= cutoff);
    if (ticks.length < 2) {
        ctx.fillStyle = getCssVar('--text3');
        ctx.font = '10px monospace';
        ctx.fillText('waiting for trades…', 6, tickH / 2);
        return;
    }

    const prices = ticks.map(t => t.price);
    const max    = Math.max(...prices);
    const min    = Math.min(...prices);
    const range  = (max - min) || (max * 0.0005) || 1;

    const padTop = 4, padBottom = 4;
    const usableH = tickH - padTop - padBottom;
    const now     = Date.now();

    const xFor = (t) => w - ((now - t) / TICK_WINDOW_MS) * w;
    const yFor = (price) => padTop + usableH - ((price - min) / range) * usableH;

    // Соединяющая линия — ярче и толще, чтобы не сливаться с чёрным фоном
    ctx.strokeStyle = getCssVar('--text2');
    ctx.globalAlpha = 0.7;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ticks.forEach((t, i) => {
        const x = xFor(t.time), y = yFor(t.price);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Точки сделок — цвет по стороне агрессора
    ticks.forEach(t => {
        const x = xFor(t.time), y = yFor(t.price);
        ctx.fillStyle = t.side === 'buy' ? getCssVar('--green') : getCssVar('--red');
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
    });

    // VWAP — горизонтальная референсная линия (если посчитан в risex.js)
    if (typeof vwapDenominator !== 'undefined' && vwapDenominator > 0) {
        const vwap = vwapNumerator / vwapDenominator;
        if (vwap >= min - range * 0.3 && vwap <= max + range * 0.3) {
            const y = yFor(vwap);
            ctx.strokeStyle = getCssVar('--gold');
            ctx.globalAlpha = 0.6;
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y); ctx.lineTo(w, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }
    }

    // Крупные сделки ("киты") — золотое кольцо вокруг точки
    if (typeof _largeOrderMarkers !== 'undefined') {
        _largeOrderMarkers.forEach(m => {
            if (m.time < cutoff) return;
            const x = xFor(m.time), y = yFor(m.price);
            ctx.strokeStyle = getCssVar('--gold');
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.stroke();
        });
    }

    const highEl = document.getElementById('chart-high');
    const lowEl  = document.getElementById('chart-low');
    if (highEl) highEl.textContent = 'H: ' + max.toFixed(1);
    if (lowEl)  lowEl.textContent  = 'L: ' + min.toFixed(1);
}

// ── Объёмные бары (старый добрый вид: сплошные зелёно-красные столбики) ──
// В отличие от точек в тиковой ленте, тут высота = размер сделки — крупный
// принт виден сразу, а не сливается с мелкими сделками.
function renderVolumeBars(ctx, w, yOffset, volH) {
    const cutoff = Date.now() - TICK_WINDOW_MS;
    const ticks  = tickBuffer.filter(t => t.time >= cutoff && t.size > 0);
    if (!ticks.length) return;

    const maxSize = Math.max(...ticks.map(t => t.size)) || 1;
    const now     = Date.now();
    const xFor    = (t) => w - ((now - t) / TICK_WINDOW_MS) * w;
    const barW    = Math.max(2, w / 200);

    ticks.forEach(t => {
        const x = xFor(t.time);
        const barH = Math.max(1, (t.size / maxSize) * volH);
        ctx.fillStyle = t.side === 'buy' ? getCssVar('--green') : getCssVar('--red');
        ctx.fillRect(x - barW / 2, yOffset + volH - barH, barW, barH);
    });
}

// ── OHLC-контекст (второстепенная полоса) ───────────────────

async function fetchCandles(marketId, tf) {
    const intervalNs = CHART_TF_NS[tf] || CHART_TF_NS['1m'];
    const nowNs       = BigInt(Date.now()) * 1_000_000n;
    const fromNs       = nowNs - intervalNs * BigInt(CHART_CANDLE_COUNT);

    try {
        const url = `${RISEX_API.rest}/v1/markets/id/${marketId}/trading-view-data`
                  + `?interval=${intervalNs}&from=${fromNs}&to=${nowNs}`;
        const res = await fetch(url);
        if (!res.ok) { console.warn('fetchCandles: HTTP', res.status); return []; }
        const raw = await res.json();

        let rows = raw.data ?? raw;
        if (rows && !Array.isArray(rows) && Array.isArray(rows.data))  rows = rows.data;
        if (rows && !Array.isArray(rows) && Array.isArray(rows.items)) rows = rows.items;
        if (!Array.isArray(rows)) return [];

        return rows.map(r => ({
            time:   Number(BigInt(r.time) / 1_000_000n),
            open:   parseFloat(r.open),
            high:   parseFloat(r.high),
            low:    parseFloat(r.low),
            close:  parseFloat(r.close),
            volume: parseFloat(r.volume || 0),
        })).sort((a, b) => a.time - b.time);
    } catch (e) {
        console.warn('fetchCandles error:', e);
        return [];
    }
}

async function loadCandles() {
    if (typeof currentMarket === 'undefined') return;
    const rows = await fetchCandles(currentMarket, chartTimeframe);
    if (rows.length) candles = rows;
    renderChart();
}

function setChartTimeframe(tf) {
    if (!CHART_TF_NS[tf]) return;
    chartTimeframe = tf;
    document.querySelectorAll('.chart-tf-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tf === tf);
    });
    loadCandles();
}
window.setChartTimeframe = setChartTimeframe;

// Живое обновление контекстной свечи по каждому апдейту цены (не только
// по сделкам — ордербук обновляется чаще, контекст остаётся плавным).
function updateLiveCandle(price) {
    if (!price || price <= 0 || !candles.length) return;

    const tfMs        = CHART_TF_MS[chartTimeframe] || 60_000;
    const bucketStart  = Math.floor(Date.now() / tfMs) * tfMs;
    const last         = candles[candles.length - 1];

    if (last.time === bucketStart) {
        last.high  = Math.max(last.high, price);
        last.low   = Math.min(last.low, price);
        last.close = price;
    } else if (bucketStart > last.time) {
        candles.push({ time: bucketStart, open: last.close, high: price, low: price, close: price, volume: 0 });
        if (candles.length > CHART_CANDLE_COUNT) candles.shift();
    } else {
        return;
    }
    renderChart();
}
window.updateLiveCandle = updateLiveCandle;

function renderOhlcArea(ctx, w, yOffset, ohlcH) {
    if (!candles.length) return;

    const highs = candles.map(k => k.high);
    const lows  = candles.map(k => k.low);
    const max   = Math.max(...highs);
    const min   = Math.min(...lows);
    const range = (max - min) || 1;

    const slot  = w / candles.length;
    const barW  = Math.max(2, slot * 0.7);
    const yFor  = (price) => yOffset + ohlcH - ((price - min) / range) * ohlcH;

    // Сплошные range-бары (high-low), не тонкие open/close палки — на высоте
    // ~30px тонкие линии физически неразличимы, заливка читается всегда.
    ctx.globalAlpha = 0.6;
    candles.forEach((k, i) => {
        const x  = i * slot + slot / 2;
        const up = k.close >= k.open;
        ctx.fillStyle = up ? getCssVar('--green-dim') : getCssVar('--red-dim');
        const yHigh = yFor(k.high);
        const yLow  = yFor(k.low);
        ctx.fillRect(x - barW / 2, yHigh, barW, Math.max(1, yLow - yHigh));
    });
    ctx.globalAlpha = 1;
}

// ── Общий рендер (оба региона) ───────────────────────────────
function renderChart() {
    const c = getChartCanvas();
    if (!c) return;
    const { ctx, w, h } = c;
    ctx.clearRect(0, 0, w, h);

    const tickH   = h * TICK_AREA_RATIO;
    const volH    = h * VOLUME_AREA_RATIO;
    const ohlcH   = h - tickH - volH - 4;

    renderTickArea(ctx, w, tickH);

    ctx.strokeStyle = getCssVar('--border');
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, tickH + 1);
    ctx.lineTo(w, tickH + 1);
    ctx.stroke();
    ctx.globalAlpha = 1;

    renderVolumeBars(ctx, w, tickH + 2, volH);

    ctx.strokeStyle = getCssVar('--border');
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, tickH + volH + 3);
    ctx.lineTo(w, tickH + volH + 3);
    ctx.stroke();
    ctx.globalAlpha = 1;

    renderOhlcArea(ctx, w, tickH + volH + 5, ohlcH);
}

function renderCandles() { renderChart(); }

// ── Инициализация ────────────────────────────────────────────
function initChart() {
    loadCandles();
    if (chartRefreshTimer) clearInterval(chartRefreshTimer);
    chartRefreshTimer = setInterval(loadCandles, 30_000);

    setInterval(renderChart, 1000); // тиковая лента скроллится даже без новых событий
    window.addEventListener('resize', () => renderChart());
}
window.initChart = initChart;

console.log('%cChart loaded (tick-first)', 'color:#00ff9d');
