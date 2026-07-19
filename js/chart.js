// ============================================================
// js/chart.js — РЕАЛЬНЫЕ OHLCV-СВЕЧИ (canvas)
// ============================================================
// Данные — GET /v1/markets/id/{market_id}/trading-view-data
// (developer.rise.trade/reference/marketservice_gettradingviewdatav2) —
// официальный эндпоинт RISEx именно под графики, не самодельная
// агрегация тиков. Всё так же 100% данные от RISEx, просто нормальные
// свечи вместо тик-гистограммы.
// ============================================================

let candles          = [];      // [{time(ms), open, high, low, close, volume}]
let chartTimeframe   = '1m';
let chartRefreshTimer = null;

const CHART_TF_NS = {
    '1m':  60_000_000_000n,
    '5m':  300_000_000_000n,
    '15m': 900_000_000_000n,
    '1h':  3_600_000_000_000n,
};
const CHART_TF_MS = {
    '1m': 60_000, '5m': 300_000, '15m': 900_000, '1h': 3_600_000,
};
const CHART_CANDLE_COUNT = 80;

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

async function fetchCandles(marketId, tf) {
    const intervalNs = CHART_TF_NS[tf] || CHART_TF_NS['1m'];
    const nowNs       = BigInt(Date.now()) * 1_000_000n;
    const fromNs       = nowNs - intervalNs * BigInt(CHART_CANDLE_COUNT);

    try {
        const url = `${RISEX_API.rest}/v1/markets/id/${marketId}/trading-view-data`
                  + `?interval=${intervalNs}&from=${fromNs}&to=${nowNs}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const raw  = await res.json();
        const rows = raw.data || [];

        return rows.map(r => ({
            time:   Number(BigInt(r.time) / 1_000_000n), // ns → ms
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
    renderCandles();
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

// Живое обновление последней (текущей) свечи по каждому тику цены с WS —
// не ждём следующего REST-запроса, чтобы график не "лагал" при скальпинге.
function updateLiveCandle(price) {
    if (!price || price <= 0 || !candles.length) return;

    const tfMs      = CHART_TF_MS[chartTimeframe] || 60_000;
    const bucketStart = Math.floor(Date.now() / tfMs) * tfMs;
    const last       = candles[candles.length - 1];

    if (last.time === bucketStart) {
        last.high  = Math.max(last.high, price);
        last.low   = Math.min(last.low, price);
        last.close = price;
    } else if (bucketStart > last.time) {
        // Новый бакет времени — открываем новую формирующуюся свечу
        candles.push({ time: bucketStart, open: last.close, high: price, low: price, close: price, volume: 0 });
        if (candles.length > CHART_CANDLE_COUNT) candles.shift();
    } else {
        return; // тик из прошлого бакета — игнорируем
    }
    renderCandles();
}
window.updateLiveCandle = updateLiveCandle;

function renderCandles() {
    const c = getChartCanvas();
    if (!c || !candles.length) return;
    const { ctx, w, h } = c;

    ctx.clearRect(0, 0, w, h);

    const highs = candles.map(k => k.high);
    const lows  = candles.map(k => k.low);
    const max   = Math.max(...highs);
    const min   = Math.min(...lows);
    const range = (max - min) || 1;

    const padTop = 6, padBottom = 4;
    const usableH = h - padTop - padBottom;
    const slot    = w / candles.length;
    const bodyW   = Math.max(2, slot * 0.6);

    const yFor = (price) => padTop + usableH - ((price - min) / range) * usableH;

    candles.forEach((k, i) => {
        const x     = i * slot + slot / 2;
        const up    = k.close >= k.open;
        const color = up ? getCssVar('--green-dim') : getCssVar('--red-dim');

        ctx.strokeStyle = color;
        ctx.fillStyle   = color;
        ctx.lineWidth   = 1;

        // Фитиль (high-low)
        ctx.beginPath();
        ctx.moveTo(x, yFor(k.high));
        ctx.lineTo(x, yFor(k.low));
        ctx.stroke();

        // Тело свечи (open-close)
        const yOpen  = yFor(k.open);
        const yClose = yFor(k.close);
        const bodyTop    = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
        ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bodyHeight);
    });

    const highEl = document.getElementById('chart-high');
    const lowEl  = document.getElementById('chart-low');
    if (highEl) highEl.textContent = 'H: ' + max.toFixed(0);
    if (lowEl)  lowEl.textContent  = 'L: ' + min.toFixed(0);
}

function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

// ── Инициализация ────────────────────────────────────────────
function initChart() {
    loadCandles();
    if (chartRefreshTimer) clearInterval(chartRefreshTimer);
    // Периодическая полная пересинхронизация с сервером (не только
    // локальные live-обновления) — раз в 30 сек, как страховка от
    // пропущенных WS-тиков/расхождений.
    chartRefreshTimer = setInterval(loadCandles, 30_000);

    window.addEventListener('resize', () => renderCandles());
}
window.initChart = initChart;

console.log('%cChart loaded', 'color:#00ff9d');
