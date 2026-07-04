// ============================================================
// ЖЁСТКАЯ КОНФИГУРАЦИЯ
// ============================================================

(function() {
    'use strict';

    // 1. ЯВНО ЗАДАЁМ MAINNET
    const USE_MAINNET = true;
    const FORCE_MAINNET_WS = true;

    // 2. Жёстко задаём URL
    const WS_MAINNET = 'wss://ws.rise.trade/ws';
    const HTTP_MAINNET = 'https://api.rise.trade';

    // 3. Создаём конфиг
    const RISEX_API = {
        ws: WS_MAINNET,
        http: HTTP_MAINNET,
        explorer: 'https://explorer.risechain.com'
    };

    const RPC_CONFIG = {
        rest: 'https://rpc.risechain.com',
        ws: 'wss://rpc.risechain.com/ws'
    };

    // 4. Экспортируем в глобальную область
    window.USE_MAINNET = USE_MAINNET;
    window.FORCE_MAINNET_WS = FORCE_MAINNET_WS;
    window.RISEX_API = RISEX_API;
    window.RPC_CONFIG = RPC_CONFIG;
    window.IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    window.SYSTEM_CONFIG_URL = USE_MAINNET
        ? 'https://raw.githubusercontent.com/risechain/rise-contracts/main/config/mainnet.json'
        : 'https://raw.githubusercontent.com/risechain/rise-contracts/main/config/testnet.json';

    console.log('🔥 CONFIG LOADED:', {
        USE_MAINNET: window.USE_MAINNET,
        WS: window.RISEX_API.ws,
        HTTP: window.RISEX_API.http,
        RPC: window.RPC_CONFIG.rest
    });

})();

// Для обратной совместимости
const USE_MAINNET = true;
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const RISEX_API = window.RISEX_API;
const RPC_CONFIG = window.RPC_CONFIG;
const SYSTEM_CONFIG_URL = window.SYSTEM_CONFIG_URL;
const FORCE_MAINNET_WS = true;
