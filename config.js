// ============================================================
// ГЛОБАЛЬНАЯ КОНФИГУРАЦИЯ
// ============================================================

// Принудительно выставляем MAINNET (для продакшена)
const USE_MAINNET = true;   // ← mainnet
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Ручной оверрайд для WebSocket (форсим mainnet)
const FORCE_MAINNET_WS = true; // ← добавил явный флаг

const RISEX_API = {
    ws: USE_MAINNET 
        ? "wss://ws.rise.trade/ws" 
        : "wss://ws.testnet.rise.trade/ws",
    http: USE_MAINNET
        ? "https://api.rise.trade"
        : "https://api.testnet.rise.trade",
    explorer: USE_MAINNET
        ? "https://explorer.risechain.com"
        : "https://explorer.testnet.risechain.com"
};

const SYSTEM_CONFIG_URL = USE_MAINNET
    ? "https://raw.githubusercontent.com/risechain/rise-contracts/main/config/mainnet.json"
    : "https://raw.githubusercontent.com/risechain/rise-contracts/main/config/testnet.json";

// RPC endpoints
const RPC_ENDPOINTS = {
    mainnet: {
        rest: "https://rpc.risechain.com",
        ws: "wss://rpc.risechain.com/ws"
    },
    testnet: {
        rest: "https://rpc.testnet.rise.trade",
        ws: "wss://rpc.testnet.rise.trade/ws"
    }
};

// ============================================================
// НЕ МЕНЯТЬ НИЖЕ (автоматический выбор)
// ============================================================

const RPC_CONFIG = USE_MAINNET ? RPC_ENDPOINTS.mainnet : RPC_ENDPOINTS.testnet;

// Для обратной совместимости
if (typeof window !== 'undefined') {
    window.USE_MAINNET = USE_MAINNET;
    window.IS_LOCAL = IS_LOCAL;
    window.RISEX_API = RISEX_API;
    window.RPC_CONFIG = RPC_CONFIG;
    window.FORCE_MAINNET_WS = FORCE_MAINNET_WS;
}

console.log('📦 CONFIG LOADED:', {
    USE_MAINNET,
    IS_LOCAL,
    FORCE_MAINNET_WS,
    WS_URL: RISEX_API.ws,
    RPC: RPC_CONFIG
});
