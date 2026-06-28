// ============================================================
// js/config.js — КОНФИГУРАЦИЯ
// ============================================================

const firebaseConfig = {
    apiKey:            "AIzaSyA17DnsliLjYgsEK_HnSptyqOqufSbvdKA",
    authDomain:        "plov-f84e7.firebaseapp.com",
    projectId:         "plov-f84e7",
    storageBucket:     "plov-f84e7.firebasestorage.app",
    messagingSenderId: "151638202833",
    appId:             "1:151638202833:web:107e0ef73da042fb8d28f0"
};

const RISE_CHAIN = {
    chainId:  11155931,
    rpcUrl:   "https://testnet.riselabs.xyz",
    explorer: "https://explorer.testnet.riselabs.xyz"
};

// REST API — через Vercel proxy (решает CORS)
// На localhost прокси не работает, поэтому определяем автоматически
const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

const RISEX_API = {
    // На Vercel: /api/... → Vercel проксирует в api.testnet.rise.trade/...
    // На localhost: прямой запрос (будет CORS, но это нормально для разработки)
    rest: IS_LOCAL
        ? "https://api.testnet.rise.trade"
        : "/api",
    ws: "wss://ws.testnet.rise.trade/ws"
};

// Загружается из /v1/system/config при старте
let RISEX_CONTRACTS = {
    usdc:         null,
    perpsManager: null,
    authorization: null
};

const MARKETS = { BTC: 1, ETH: 2 };

let currentLang     = 'ru';
let currentMode     = 'perp';
let currentLeverage = 10;
let currentMarket   = 1;

window.firebaseConfig  = firebaseConfig;
window.RISE_CHAIN      = RISE_CHAIN;
window.RISEX_API       = RISEX_API;
window.RISEX_CONTRACTS = RISEX_CONTRACTS;
window.MARKETS         = MARKETS;
console.log('%cConfig loaded', 'color:#00ff9d',
    IS_LOCAL ? '(localhost — прямые запросы)' : '(Vercel — через прокси)');
