// ============================================================
// api/check-payment.js - BACKEND ДЛЯ VERCEL
// ============================================================
// Проверяет входящие USDC транзакции на адрес подписки
// Отслеживает статус платежей через eth_getLogs
// ============================================================

const ethers = require('ethers');
const fs = require('fs');
const path = require('path');

// Константы
const RISE_RPC = 'https://mainnet.riselabs.xyz';
const USDC_ADDRESS = '0xe436820ba0c69702c1d3e601d421c0ef38262739';
const PAYMENT_ADDRESS = '0x3A7B2c686b2ED20798011D17141DD74123521a4b';

// ERC20 Transfer event signature (Keccak256 хеш)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daf887a1342e8e7e645ece2c0d930f50a6';

// Путь к файлу подписок
const SUBSCRIPTIONS_FILE = path.join(process.cwd(), 'subscriptions.json');

// ── ИНИЦИАЛИЗАЦИЯ PROVIDER ─────────────────────────────────

const provider = new ethers.JsonRpcProvider(RISE_RPC);

// ── ЗАГРУЗКА/СОХРАНЕНИЕ ПОДПИСОК ──────────────────────────

function loadSubscriptions() {
    try {
        if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
            const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading subscriptions:', error);
    }
    return {};
}

function saveSubscriptions(subs) {
    try {
        fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving subscriptions:', error);
        return false;
    }
}

// ── ПОЛУЧЕНИЕ ЦЕНЫ GAS ────────────────────────────────────

async function getCurrentGasPrice() {
    try {
        const feeData = await provider.getFeeData();
        return feeData.gasPrice || ethers.parseUnits('1', 'gwei');
    } catch (error) {
        console.warn('Error getting gas price:', error);
        return ethers.parseUnits('1', 'gwei');
    }
}

// ── ПРОВЕРКА ПЛАТЕЖА ───────────────────────────────────────

async function checkPaymentTransaction(txHash, fromAddress, amount) {
    try {
        // Получить полную информацию о транзакции
        const tx = await provider.getTransaction(txHash);
        if (!tx) {
            return { status: 'not_found', message: 'Transaction not found' };
        }

        // Получить receipt
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
            return { status: 'pending', message: 'Transaction is pending' };
        }

        // Проверить статус
        if (receipt.status !== 1) {
            return { status: 'failed', message: 'Transaction failed' };
        }

        // Парсим логи для Transfer события
        const iface = new ethers.Interface([
            'event Transfer(address indexed from, address indexed to, uint256 value)'
        ]);

        let foundTransfer = false;

        for (const log of receipt.logs) {
            try {
                if (log.address.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
                    const parsed = iface.parseLog(log);
                    if (parsed && parsed.name === 'Transfer') {
                        const from = parsed.args[0].toLowerCase();
                        const to = parsed.args[1].toLowerCase();
                        const value = parsed.args[2];

                        if (to.toLowerCase() === PAYMENT_ADDRESS.toLowerCase()) {
                            // Проверить сумму (в wei)
                            const amountWei = ethers.parseUnits(amount, 6); // USDC = 6 decimals
                            
                            if (value >= amountWei) {
                                foundTransfer = true;
                                return {
                                    status: 'success',
                                    txHash: txHash,
                                    from: from,
                                    to: to,
                                    amount: ethers.formatUnits(value, 6),
                                    blockNumber: receipt.blockNumber,
                                    timestamp: Math.floor(Date.now() / 1000)
                                };
                            }
                        }
                    }
                }
            } catch (e) {
                // Skip parsing errors on individual logs
            }
        }

        if (!foundTransfer) {
            return { status: 'invalid', message: 'No valid USDC transfer found in receipt' };
        }

        return { status: 'success', txHash: txHash };

    } catch (error) {
        console.error('Error checking payment:', error);
        return { status: 'error', message: error.message };
    }
}

// ── ПОИСК ПЛАТЕЖЕЙ ДЛЯ АДРЕСА ─────────────────────────────

async function searchPaymentsForUser(fromAddress, since = null) {
    try {
        const currentBlock = await provider.getBlockNumber();
        
        // Если since не задан, ищем за последние 5000 блоков (~10 минут на Rise)
        const fromBlock = since || Math.max(0, currentBlock - 5000);
        
        const filter = {
            address: USDC_ADDRESS,
            topics: [
                TRANSFER_TOPIC,
                null, // Any from
                '0x' + PAYMENT_ADDRESS.slice(2).padStart(64, '0') // To нашему адресу
            ],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };

        const logs = await provider.getLogs(filter);
        
        const transactions = [];
        
        for (const log of logs) {
            try {
                const tx = await provider.getTransaction(log.transactionHash);
                const receipt = await provider.getTransactionReceipt(log.transactionHash);
                
                if (receipt && receipt.status === 1) {
                    // Парсим Transfer событие
                    const iface = new ethers.Interface([
                        'event Transfer(address indexed from, address indexed to, uint256 value)'
                    ]);
                    
                    const parsed = iface.parseLog(log);
                    if (parsed) {
                        transactions.push({
                            txHash: log.transactionHash,
                            from: parsed.args[0],
                            to: parsed.args[1],
                            amount: ethers.formatUnits(parsed.args[2], 6),
                            blockNumber: log.blockNumber,
                            timestamp: receipt.timestamp ? receipt.timestamp * 1000 : Date.now()
                        });
                    }
                }
            } catch (e) {
                console.warn('Error processing log:', e.message);
            }
        }
        
        return transactions;
        
    } catch (error) {
        console.error('Error searching payments:', error);
        return [];
    }
}

// ── ОБНОВЛЕНИЕ ПОДПИСКИ ────────────────────────────────────

function updateSubscriptionStatus(subscriptions, userAddress, txHash) {
    const now = Date.now();
    const endDate = new Date(now + 30 * 24 * 60 * 60 * 1000); // +30 дней
    
    if (!subscriptions[userAddress]) {
        subscriptions[userAddress] = {};
    }
    
    subscriptions[userAddress] = {
        status: 'active',
        subscriptionEndDate: endDate.getTime(),
        lastPaymentHash: txHash,
        lastPaymentDate: now,
        trialDaysRemaining: 0
    };
    
    return subscriptions;
}

// ── MAIN API HANDLER ───────────────────────────────────────

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { action, txHash, userAddress, amount = '1' } = req.query;

        if (!action) {
            return res.status(400).json({ error: 'Missing action parameter' });
        }

        // ── Проверка конкретной транзакции ─────────────────

        if (action === 'check' && txHash) {
            console.log(`Checking payment: ${txHash}`);
            
            const result = await checkPaymentTransaction(txHash, userAddress, amount);
            
            if (result.status === 'success' && userAddress) {
                // Обновляем статус подписки
                let subscriptions = loadSubscriptions();
                subscriptions = updateSubscriptionStatus(subscriptions, userAddress.toLowerCase(), txHash);
                saveSubscriptions(subscriptions);
                
                console.log(`✓ Payment confirmed for ${userAddress}`);
            }
            
            return res.status(200).json(result);
        }

        // ── Поиск платежей для пользователя ────────────────

        if (action === 'search' && userAddress) {
            console.log(`Searching payments for: ${userAddress}`);
            
            const payments = await searchPaymentsForUser(userAddress);
            
            // Обновляем подписку для каждого платежа
            if (payments.length > 0) {
                let subscriptions = loadSubscriptions();
                
                for (const payment of payments) {
                    subscriptions = updateSubscriptionStatus(
                        subscriptions,
                        payment.from.toLowerCase(),
                        payment.txHash
                    );
                }
                
                saveSubscriptions(subscriptions);
            }
            
            return res.status(200).json({
                userAddress: userAddress,
                paymentsFound: payments.length,
                payments: payments
            });
        }

        // ── Получить статус подписки ──────────────────────

        if (action === 'status' && userAddress) {
            const subscriptions = loadSubscriptions();
            const userSub = subscriptions[userAddress.toLowerCase()];
            
            return res.status(200).json({
                userAddress: userAddress,
                subscription: userSub || null,
                hasActiveSubscription: userSub && userSub.status === 'active' && userSub.subscriptionEndDate > Date.now()
            });
        }

        // ── Получить информацию о конфигурации ──────────────

        if (action === 'config') {
            return res.status(200).json({
                paymentAddress: PAYMENT_ADDRESS,
                usdcAddress: USDC_ADDRESS,
                riseRpc: RISE_RPC,
                subscriptionCost: '1 USDC',
                subscriptionPeriod: '30 days'
            });
        }

        // ── Получить баланс пользователя ──────────────────────

        if (action === 'balance' && userAddress) {
            console.log(`Fetching balance for: ${userAddress}`);
            
            try {
                const response = await fetch(
                    `${RISEX_API.rest}/v1/account/balance?account=${userAddress}`,
                    {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    
                    let balance = 0;
                    if (data.free !== undefined) {
                        balance = parseFloat(data.free);
                    } else if (data.available !== undefined) {
                        balance = parseFloat(data.available);
                    } else if (data.balance !== undefined) {
                        balance = parseFloat(data.balance);
                    } else if (data.equity !== undefined) {
                        balance = parseFloat(data.equity);
                    }

                    // Конвертировать из wei если нужно
                    if (balance > 1e15) {
                        balance = balance / 1e18;
                    }

                    return res.status(200).json({
                        userAddress: userAddress,
                        balance: balance,
                        success: true
                    });
                } else {
                    return res.status(response.status).json({
                        error: 'RISEx API error',
                        status: response.status
                    });
                }
            } catch (error) {
                console.error('Balance fetch error:', error);
                return res.status(500).json({
                    error: error.message
                });
            }
        }

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// ── ЭКСПОРТЫ ДЛЯ ТЕСТИРОВАНИЯ ─────────────────────────────

module.exports.checkPaymentTransaction = checkPaymentTransaction;
module.exports.searchPaymentsForUser = searchPaymentsForUser;
module.exports.loadSubscriptions = loadSubscriptions;
module.exports.saveSubscriptions = saveSubscriptions;
