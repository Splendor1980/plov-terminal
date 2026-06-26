// ============================================================
// js/config.js — КОНФИГУРАЦИЯ
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyA17DnsliLjYgsEK_HnSptyqOqufSbvdKA",
    authDomain: "plov-f84e7.firebaseapp.com",
    projectId: "plov-f84e7",
    storageBucket: "plov-f84e7.firebasestorage.app",
    messagingSenderId: "151638202833",
    appId: "1:151638202833:web:107e0ef73da042fb8d28f0"
};

const RISE_CHAIN = {
    chainId: 11155931,
    rpcUrl: "https://testnet.riselabs.xyz",
    explorer: "https://explorer.testnet.riselabs.xyz"
};

const RISEX_API = {
    rest: "https://api.testnet.rise.trade",
    ws:   "wss://ws.testnet.rise.trade/ws"
};

// Загружается динамически из /v1/system/config
let RISEX_CONTRACTS = {
    usdc: null,
    perpsManager: null,
    authorization: null
};

// market_id для RISEx
const MARKETS = { BTC: 1, ETH: 2 };

// Состояние приложения
let currentLang     = 'ru';
let currentMode     = 'perp';   // 'perp' | 'spot'
let currentLeverage = 10;
let currentMarket   = 1;        // BTC по умолчанию

window.firebaseConfig    = firebaseConfig;
window.RISE_CHAIN        = RISE_CHAIN;
window.RISEX_API         = RISEX_API;
window.RISEX_CONTRACTS   = RISEX_CONTRACTS;
window.MARKETS           = MARKETS;
console.log('%cConfig loaded', 'color:#00ff9d');
