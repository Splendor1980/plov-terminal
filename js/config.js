// ============================================================
// js/config.js — КОНФИГУРАЦИЯ v3.0
// ============================================================

const firebaseConfig = {
    apiKey:            "AIzaSyA17DnsliLjYgsEK_HnSptyqOqufSbvdKA",
    authDomain:        "plov-f84e7.firebaseapp.com",
    projectId:         "plov-f84e7",
    storageBucket:     "plov-f84e7.firebasestorage.app",
    messagingSenderId: "151638202833",
    appId:             "1:151638202833:web:107e0ef73da042fb8d28f0"
};

// ── Mainnet/Testnet switch ───────────────────────────────────
const USE_MAINNET = true;   // ← true = mainnet

const RISE_CHAIN = USE_MAINNET ? {
    chainId:  4153,
    rpcUrl:   "https://mainnet.riselabs.xyz",
    explorer: "https://explorer.riselabs.xyz"
} : {
    chainId:  11155931,
    rpcUrl:   "https://testnet.riselabs.xyz",
    explorer: "https://explorer.testnet.riselabs.xyz"
};

const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

const RISEX_API = {
    rest: IS_LOCAL
        ? (USE_MAINNET ? "https://api.rise.trade" : "https://api.testnet.rise.trade")
        : "/api",
    ws: USE_MAINNET
        ? "wss://ws.rise.trade/ws"
        : "wss://ws.testnet.rise.trade/ws"
};

let RISEX_CONTRACTS = {
    usdc: null, router: null, ordersManager: null,
    perpsManager: null, authorization: null, collateral: null
};

// Используется как fallback, пока loadSystemConfig() не подтянет
// актуальный адрес USDC из /v1/system/config
const FALLBACK_USDC_ADDRESS = '0xe436820ba0c69702c1d3e601d421c0ef38262739';
window.FALLBACK_USDC_ADDRESS = FALLBACK_USDC_ADDRESS;

const MARKETS = { BTC: 1, ETH: 2 };

let currentLang     = 'en';
let currentMarket   = 1;
let currentLeverage = 10;

window.firebaseConfig  = firebaseConfig;
window.RISE_CHAIN      = RISE_CHAIN;
window.RISEX_API       = RISEX_API;
window.RISEX_CONTRACTS = RISEX_CONTRACTS;
window.MARKETS         = MARKETS;
window.USE_MAINNET     = USE_MAINNET;

console.log('%cConfig loaded', 'color:#00ff9d',
    USE_MAINNET ? '(MAINNET)' : '(TESTNET)',
    IS_LOCAL ? '— direct' : '— via Vercel proxy');
