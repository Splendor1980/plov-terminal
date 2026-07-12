// ============================================================
// js/risex-real-trading.js - REAL TRADING MODULE
// ============================================================
// Полная реальная интеграция с RISEx API на Rise Mainnet
// Использует EIP-712 подписи для размещения и закрытия ордеров
// ============================================================

// ── Вспомогательные функции для подписания ────────────────

async function createOrderSignature(orderData) {
    if (!signer || !signerAddress) {
        throw new Error('Signer not ready');
    }

    // EIP-712 Domain для Rise Mainnet
    const domain = {
        name: 'RISEx',
        version: '1',
        chainId: 4153,  // Rise Mainnet
        verifyingContract: RISEX_CONTRACTS.ordersManager
    };

    // Order типы для EIP-712
    const types = {
        Order: [
            { name: 'market_id', type: 'uint256' },
            { name: 'account', type: 'address' },
            { name: 'side', type: 'uint8' },          // 0 = long, 1 = short
            { name: 'quantity', type: 'uint256' },
            { name: 'price', type: 'uint256' },
            { name: 'leverage', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'expiry', type: 'uint256' }
        ]
    };

    // Подготовка данных для подписания
    const orderMessage = {
        market_id: orderData.market_id,
        account: signerAddress,
        side: orderData.side === 'long' ? 0 : 1,
        quantity: ethers.parseUnits(orderData.quantity.toString(), 18),
        price: ethers.parseUnits(orderData.price.toString(), 6),
        leverage: ethers.parseUnits(orderData.leverage.toString(), 18),
        nonce: orderData.nonce || 0,
        expiry: orderData.expiry || Math.floor(Date.now() / 1000) + 3600  // 1 час
    };

    try {
        const signature = await signer.signTypedData(domain, types, orderMessage);
        return {
            signature,
            ...orderMessage,
            domain,
            types
        };
    } catch (error) {
        console.error('Failed to sign order:', error);
        throw error;
    }
}

// ── Размещение реального ордера ─────────────────────────────

async function placeRealOrder(side, amountUsdc, leverage) {
    if (!signer || !signerAddress) {
        addToLog('❌ Signer not connected', 'error');
        return false;
    }

    if (!lastPrice || lastPrice <= 0) {
        addToLog('❌ No price data available', 'error');
        return false;
    }

    // Проверка баланса
    const realBalance = await getRealBalance();
    if (realBalance < amountUsdc) {
        addToLog(`❌ Insufficient balance. Have: ${realBalance.toFixed(2)}, need: ${amountUsdc}`, 'error');
        return false;
    }

    addToLog('⏳ Placing real order on RISEx...', 'pending');

    try {
        // Расчет размера позиции
        const positionSize = (amountUsdc * leverage) / lastPrice;

        // Подготовка данных ордера
        const orderData = {
            market_id: currentMarket,
            side: side.toLowerCase(),
            quantity: positionSize,
            price: lastPrice,
            leverage: leverage,
            nonce: Date.now(),
            expiry: Math.floor(Date.now() / 1000) + 3600
        };

        // Подписание ордера (EIP-712)
        const signedOrder = await createOrderSignature(orderData);

        // Отправка на RISEx API
        const response = await fetch(`${RISEX_API.rest}/v1/orders/place`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                market_id: signedOrder.market_id,
                account: signedOrder.account,
                side: signedOrder.side,
                quantity: signedOrder.quantity.toString(),
                price: signedOrder.price.toString(),
                leverage: signedOrder.leverage.toString(),
                nonce: signedOrder.nonce,
                expiry: signedOrder.expiry,
                signature: signedOrder.signature
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `API error: ${response.status}`);
        }

        const result = await response.json();
        
        // Успешное размещение
        if (result.order_id) {
            addToLog(`✅ ${side.toUpperCase()} opened at $${lastPrice.toFixed(2)}`, 'success');
            addToLog(`📊 Size: ${positionSize.toFixed(6)} BTC × ${leverage}x`, 'success');
            addToLog(`📋 Order ID: ${result.order_id}`, 'meta');

            // Обновляем локальную позицию
            position = {
                side: side.toLowerCase(),
                size: positionSize,
                entryPrice: lastPrice,
                leverage: leverage,
                margin: amountUsdc,
                orderId: result.order_id,
                timestamp: Date.now()
            };

            updatePositionUI(position);
            saveStats(side, amountUsdc * leverage, true);

            if (typeof addMyTrade === 'function') {
                addMyTrade(side, lastPrice, positionSize, leverage, result.order_id);
            }

            return true;
        } else {
            throw new Error('No order ID in response');
        }

    } catch (error) {
        console.error('Place order error:', error);
        addToLog(`❌ Failed to place order: ${error.message}`, 'error');
        return false;
    }
}

// ── Получение реального баланса ─────────────────────────────

async function getRealBalance() {
    if (!signerAddress) {
        console.warn('getRealBalance: signerAddress not set');
        return 0;
    }

    try {
        const endpoint = `/api/check-payment?action=balance&userAddress=${signerAddress}`;
        
        console.log('📊 Fetching balance from backend:', endpoint);
        
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Balance API error - Status:', response.status);
            console.error('Error details:', errorText);
            return 0;  // Fallback
        }

        const data = await response.json();
        console.log('✅ Balance API response:', data);
        
        // Более умный парсинг - проверить все возможные поля
        let balance = data.balance ?? data.free ?? data.available ?? data.equity ?? 0;
        
        // Конвертировать если строка
        if (typeof balance === 'string') {
            balance = parseFloat(balance);
        }
        
        // Конвертировать из wei если нужно (очень большое число)
        if (balance > 1e15) {
            balance = balance / 1e18;
        }

        // Санитайз - если NaN или отрицательное
        if (isNaN(balance) || balance < 0) {
            balance = 0;
        }

        console.log('✅ Real balance loaded:', balance, 'USDC');
        return balance;

    } catch (error) {
        console.error('❌ Get balance error:', error);
        return 0;
    }
}

// ── Загрузка реальной позиции ───────────────────────────────

async function loadRealPosition() {
    if (!isLoggedIn || !signerAddress) {
        return;
    }

    try {
        const response = await fetch(
            `${RISEX_API.rest}/v1/account/position?market_id=${currentMarket}&account=${signerAddress}`
        );

        if (!response.ok) {
            return;
        }

        const data = await response.json();

        if (data && (data.size || data.quantity)) {
            // Парсинг значений
            const parseValue = (val) => {
                const n = parseFloat(val);
                return n > 1e15 ? n / 1e18 : n;
            };

            position = {
                side: data.side === 0 ? 'long' : 'short',
                size: parseValue(data.size || data.quantity),
                entryPrice: parseValue(data.avg_entry_price || data.entry_price || 0),
                leverage: parseValue(data.leverage || currentLeverage),
                unrealizedPnL: parseValue(data.unrealizedPnL || data.pnl || 0),
                orderId: data.order_id || null,
                timestamp: data.timestamp || Date.now()
            };

            updatePositionUI(position);
            console.log('Real position loaded:', position);
        } else {
            position = null;
        }

    } catch (error) {
        console.warn('Load position error:', error);
    }
}

// ── Закрытие реальной позиции ───────────────────────────────

async function closeRealPosition() {
    if (!position || !position.size || position.size <= 0) {
        addToLog('❌ No open position', 'error');
        return false;
    }

    if (!signer || !signerAddress) {
        addToLog('❌ Signer not connected', 'error');
        return false;
    }

    addToLog('⏳ Closing position on RISEx...', 'pending');

    try {
        // Подготовка ордера на закрытие (противоположная сторона)
        const closeSide = position.side === 'long' ? 'short' : 'long';
        
        const orderData = {
            market_id: currentMarket,
            side: closeSide,
            quantity: position.size,
            price: lastPrice || position.entryPrice,
            leverage: position.leverage,
            nonce: Date.now(),
            expiry: Math.floor(Date.now() / 1000) + 3600,
            reduce_only: true  // Закрыть только, не открыть новую позицию
        };

        // Подписание ордера
        const signedOrder = await createOrderSignature(orderData);

        // Отправка запроса на закрытие
        const response = await fetch(`${RISEX_API.rest}/v1/orders/place`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                market_id: signedOrder.market_id,
                account: signedOrder.account,
                side: signedOrder.side,
                quantity: signedOrder.quantity.toString(),
                price: signedOrder.price.toString(),
                leverage: signedOrder.leverage.toString(),
                nonce: signedOrder.nonce,
                expiry: signedOrder.expiry,
                reduce_only: true,
                signature: signedOrder.signature
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Close order failed');
        }

        const result = await response.json();

        if (result.order_id) {
            addToLog(`✅ Position closed at $${(lastPrice || position.entryPrice).toFixed(2)}`, 'success');
            addToLog(`📋 Close Order ID: ${result.order_id}`, 'meta');

            // Очистить позицию
            const pnl = position.unrealizedPnL || 0;
            position = null;
            updatePositionUI(null);

            if (pnl > 0) {
                addToLog(`💰 Profit: $${pnl.toFixed(2)}`, 'success');
            } else if (pnl < 0) {
                addToLog(`📉 Loss: $${pnl.toFixed(2)}`, 'error');
            }

            return true;
        }

    } catch (error) {
        console.error('Close position error:', error);
        addToLog(`❌ Failed to close position: ${error.message}`, 'error');
        return false;
    }

    return false;
}

// ── История ордеров ────────────────────────────────────────

async function fetchOrderHistory(limit = 10) {
    if (!signerAddress) {
        return [];
    }

    try {
        const response = await fetch(
            `${RISEX_API.rest}/v1/account/orders?account=${signerAddress}&limit=${limit}`
        );

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        return data.orders || [];

    } catch (error) {
        console.warn('Fetch orders error:', error);
        return [];
    }
}

// ── Экспорты ───────────────────────────────────────────────

window.placeRealOrder     = placeRealOrder;
window.getRealBalance     = getRealBalance;
window.loadRealPosition   = loadRealPosition;
window.closeRealPosition  = closeRealPosition;
window.fetchOrderHistory  = fetchOrderHistory;
window.createOrderSignature = createOrderSignature;

console.log('%cReal Trading Module loaded', 'color:#00ff9d;font-weight:bold');
