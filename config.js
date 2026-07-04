// ============================================================
// ЖЁСТКАЯ КОНФИГУРАЦИЯ (перезаписывает всё)
// ============================================================

(function() {
    'use strict';

    // 1. ЯВНО ЗАДАЁМ MAINNET
    const MAINNET = true;
    const TESTNET = false;

    // 2. Форсируем переменные в глобальной области
    window.USE_MAINNET = MAINNET;
    window.FORCE_MAINNET_WS = MAINNET;

    // 3. Жёстко задаём URL (игнорируем любые другие)
    const WS_MAINNET = 'wss://ws.rise.trade/ws';
    const WS_TESTNET = 'wss://ws.testnet.rise.trade/ws';

    // 4. Переопределяем RISEX_API
    window.RISEX_API = {
        ws: WS_MAINNET,
        http: 'https://api.rise.trade',
        explorer: 'https://explorer.risechain.com'
    };

    // 5. RPC конфиг
    window.RPC_CONFIG = {
        rest: 'https://rpc.risechain.com',
        ws: 'wss://rpc.risechain.com/ws'
    };

    // 6. Для обратной совместимости
    window.IS_LOCAL = window.location.hostname === 'localhost' 
        || window.location.hostname === '127.0.0.1';

    // 7. SYSTEM_CONFIG_URL для загрузки контрактов
    window.SYSTEM_CONFIG_URL = MAINNET
        ? "https://raw.githubusercontent.com/risechain/rise-contracts/main/config/mainnet.json"
        : "https://raw.githubusercontent.com/risechain/rise-contracts/main/config/testnet.json";

    console.log('🔥 HARD RESET CONFIG:', {
        USE_MAINNET: window.USE_MAINNET,
        WS: window.RISEX_API.ws,
        RPC: window.RPC_CONFIG.rest,
        IS_LOCAL: window.IS_LOCAL
    });

    // 8. Экстренный перехват WebSocket
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        // Если URL содержит testnet - заменяем на mainnet
        if (typeof url === 'string' && url.includes('testnet')) {
            console.warn('⚠️ WebSocket interceptor: replacing testnet with mainnet');
            url = url.replace('testnet.rise.trade', 'rise.trade');
            url = url.replace('ws.testnet', 'ws');
        }
        return new OriginalWebSocket(url, protocols);
    };
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    console.log('✅ WebSocket interceptor installed');

})();

// Для обратной совместимости с старым кодом
const USE_MAINNET = true;
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const RISEX_API = window.RISEX_API;
const RPC_CONFIG = window.RPC_CONFIG;
const SYSTEM_CONFIG_URL = window.SYSTEM_CONFIG_URL;
const FORCE_MAINNET_WS = true;
