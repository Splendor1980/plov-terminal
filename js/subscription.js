// ============================================================
// js/subscription.js — СИСТЕМА ПОДПИСКИ + ПЛАТЕЖИ
// ============================================================
// Функционал:
// 1. Проверка статуса подписки при загрузке
// 2. Модальное окно для оплаты подписки
// 3. Отправка USDC на адрес сбора
// 4. Отслеживание статуса платежа
// 5. Блокировка торговли если нет подписки
// ============================================================

// Константы
const SUBSCRIPTION_PAYMENT_ADDRESS = '0x3A7B2c686b2ED20798011D17141DD74123521a4b';
const USDC_CONTRACT_ADDRESS = '0xe436820ba0c69702c1d3e601d421c0ef38262739'; // Rise (fallback/legacy)
const SUBSCRIPTION_COST = '1'; // 1 USDC
const TRIAL_DAYS = 7;

// Адрес получателя один и тот же на всех сетях (обычный EOA-кошелёк, не
// зависит от сети) — платить можно с любой из них, без моста, оплата
// подписки не завязана на контракты RISEx (в отличие от торговли).
// USDC-адреса — официальные, из developer.circle.com/stablecoins/usdc-contract-addresses.
const PAYMENT_CHAINS = {
    rise: {
        name: 'Rise', chainId: 4153,
        rpcUrl: 'https://rpc.risechain.com',
        usdc: '0xe436820ba0c69702c1d3e601d421c0ef38262739',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    },
    base: {
        name: 'Base', chainId: 8453,
        rpcUrl: 'https://mainnet.base.org',
        usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    },
    arbitrum: {
        name: 'Arbitrum', chainId: 42161,
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        usdc: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    },
};
let selectedPaymentChain = 'rise';

// Статусы подписки
let userSubscription = {
    uid: null,
    status: 'trial', // trial, active, expired
    trialStartDate: null,
    trialDaysRemaining: TRIAL_DAYS,
    subscriptionEndDate: null,
    lastPaymentHash: null,
    isPaying: false
};

// ── Инициализация подписки ─────────────────────────────────

async function initSubscription(uid) {
    if (!uid) return;
    
    userSubscription.uid = uid;
    
    // 1. Загрузить сохраненную подписку
    loadSubscriptionFromStorage(uid);
    
    // 2. Проверить статус
    checkSubscriptionStatus();
    
    // 3. Обновить UI
    updateSubscriptionUI();
    
    // 4. Если платеж был инициирован - проверить статус
    if (userSubscription.lastPaymentHash) {
        checkPaymentStatus(userSubscription.lastPaymentHash);
    }
    
    console.log('%cSubscription initialized', 'color:#00ff9d', userSubscription);
}

// ── Загрузка подписки из localStorage ─────────────────────

function loadSubscriptionFromStorage(uid) {
    const storageKey = `plov_subscription_${uid}`;
    const saved = localStorage.getItem(storageKey);
    
    if (saved) {
        try {
            const data = JSON.parse(saved);
            userSubscription = { ...userSubscription, ...data };
            addToLog(t('subscription_loaded'), 'meta');
        } catch (e) {
            console.warn('Failed to load subscription:', e);
        }
    } else {
        // Первый раз - создаем пробный период
        userSubscription.status = 'trial';
        userSubscription.trialStartDate = Date.now();
        userSubscription.trialDaysRemaining = TRIAL_DAYS;
        saveSubscriptionToStorage();
        addToLog(t('subscription_trial_start') + ` (${TRIAL_DAYS} ${t('subscription_days')})`, 'success');
    }
}

// ── Проверка статуса подписки ──────────────────────────────

function checkSubscriptionStatus() {
    const now = Date.now();
    
    if (userSubscription.status === 'trial') {
        if (!userSubscription.trialStartDate) {
            userSubscription.trialStartDate = now;
        }
        
        const trialEnd = userSubscription.trialStartDate + (TRIAL_DAYS * 24 * 60 * 60 * 1000);
        const daysRemaining = Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000));
        
        if (daysRemaining <= 0) {
            userSubscription.status = 'expired';
            addToLog(t('subscription_expired'), 'warning');
        } else {
            userSubscription.trialDaysRemaining = daysRemaining;
        }
    } else if (userSubscription.status === 'active') {
        if (!userSubscription.subscriptionEndDate) {
            userSubscription.status = 'expired';
            return;
        }
        
        if (now > userSubscription.subscriptionEndDate) {
            userSubscription.status = 'expired';
            addToLog(t('subscription_expired'), 'warning');
        }
    }
}

// ── Сохранение подписки в localStorage ─────────────────────

function saveSubscriptionToStorage() {
    if (!userSubscription.uid) return;
    
    const storageKey = `plov_subscription_${userSubscription.uid}`;
    localStorage.setItem(storageKey, JSON.stringify(userSubscription));
}

// ── Обновление UI ──────────────────────────────────────────

function updateSubscriptionUI() {
    // Кнопка Subscribe
    const btn = document.getElementById('btn-subscribe');
    const statusText = document.getElementById('subscription-status-text');
    
    if (!btn) return;
    
    // Текст кнопки и статус
    if (userSubscription.status === 'trial') {
        btn.textContent = t('btn_subscribe');
        btn.className = 'btn-sm btn-subscribe trial';
        if (statusText) {
            statusText.textContent = `✨ ${t('subscription_trial')}: ${userSubscription.trialDaysRemaining} ${t('subscription_days')}`;
            statusText.className = 'subscription-status trial';
        }
        btn.disabled = false;
    } else if (userSubscription.status === 'active') {
        btn.textContent = t('btn_renew');
        btn.className = 'btn-sm btn-subscribe active';
        const endDate = new Date(userSubscription.subscriptionEndDate).toLocaleDateString();
        if (statusText) {
            statusText.textContent = `✅ ${t('subscription_active')}: ${endDate}`;
            statusText.className = 'subscription-status active';
        }
        btn.disabled = true;
    } else if (userSubscription.status === 'expired') {
        btn.textContent = t('btn_subscribe_now');
        btn.className = 'btn-sm btn-subscribe expired';
        if (statusText) {
            statusText.textContent = `⏰ ${t('subscription_expired')}`;
            statusText.className = 'subscription-status expired';
        }
        btn.disabled = false;
        // Блокируем торговлю
        disableTradingButtons();
    }
}

// ── Блокировка торговли ────────────────────────────────────

function disableTradingButtons() {
    const buyBtn = document.getElementById('btn-buy');
    const sellBtn = document.getElementById('btn-sell');
    
    if (buyBtn) {
        buyBtn.disabled = true;
        buyBtn.title = t('subscription_required_tooltip');
    }
    if (sellBtn) {
        sellBtn.disabled = true;
        sellBtn.title = t('subscription_required_tooltip');
    }
}

function enableTradingButtons() {
    const buyBtn = document.getElementById('btn-buy');
    const sellBtn = document.getElementById('btn-sell');
    
    if (buyBtn) {
        buyBtn.disabled = false;
        buyBtn.title = '';
    }
    if (sellBtn) {
        sellBtn.disabled = false;
        sellBtn.title = '';
    }
}

// ── Открыть модальное окно платежа ─────────────────────────

function openPaymentModal() {
    if (!isLoggedIn) {
        addToLog(t('login_required'), 'error');
        return;
    }
    
    if (userSubscription.status === 'active' && 
        userSubscription.subscriptionEndDate > Date.now()) {
        addToLog(t('subscription_already_active'), 'info');
        return;
    }
    
    const modal = document.getElementById('payment-modal');
    if (!modal) {
        console.error('Payment modal not found');
        return;
    }
    
    // Обновить текст модаля
    const titleEl = modal.querySelector('.modal-title');
    const bodyEl = modal.querySelector('.modal-body');
    
    if (titleEl) titleEl.textContent = t('payment_modal_title');
    if (bodyEl) {
        bodyEl.innerHTML = `
            <div class="payment-info">
                <p>${t('payment_modal_desc')}</p>
                <div class="payment-chain-select">
                    <div class="detail-row"><span>Pay from network:</span></div>
                    <div class="chain-btn-row" id="chain-btn-row">
                        ${Object.entries(PAYMENT_CHAINS).map(([key, c]) => `
                            <button class="chain-btn ${key === selectedPaymentChain ? 'active' : ''}"
                                data-chain="${key}" onclick="selectPaymentChain('${key}')">${c.name}</button>
                        `).join('')}
                    </div>
                </div>
                <div class="payment-details">
                    <div class="detail-row">
                        <span>${t('payment_amount')}:</span>
                        <span class="amount">${SUBSCRIPTION_COST} USDC</span>
                    </div>
                    <div class="detail-row">
                        <span>${t('payment_period')}:</span>
                        <span>1 ${t('subscription_month')}</span>
                    </div>
                    <div class="detail-row">
                        <span>${t('payment_to_address')}:</span>
                        <span class="address">${SUBSCRIPTION_PAYMENT_ADDRESS.slice(0, 8)}...${SUBSCRIPTION_PAYMENT_ADDRESS.slice(-6)}</span>
                    </div>
                </div>
                <div class="payment-warning">
                    ⚠️ ${t('payment_warning')}
                </div>
            </div>
        `;
    }
    
    // Показать модаль
    modal.style.display = 'flex';
}

function selectPaymentChain(key) {
    if (!PAYMENT_CHAINS[key]) return;
    selectedPaymentChain = key;
    document.querySelectorAll('.chain-btn').forEach(b => b.classList.toggle('active', b.dataset.chain === key));
}
window.selectPaymentChain = selectPaymentChain;

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) modal.style.display = 'none';
}

// ── Подтверждение платежа и отправка USDC ──────────────────

async function confirmPayment() {
    if (userSubscription.isPaying) return;
    
    const ok = await unlockSigner(userSubscription.uid);
    if (!ok) {
        addToLog(t('signer_unlock_failed'), 'error');
        return;
    }
    
    userSubscription.isPaying = true;
    
    try {
        addToLog(t('payment_processing'), 'pending');

        const chain = PAYMENT_CHAINS[selectedPaymentChain] || PAYMENT_CHAINS.rise;

        // Отправить USDC на выбранной сети
        const tx = await sendUSDC(
            chain.usdc,
            SUBSCRIPTION_PAYMENT_ADDRESS,
            SUBSCRIPTION_COST,
            chain
        );
        
        if (!tx || !tx.hash) {
            throw new Error('Transaction failed');
        }
        
        userSubscription.lastPaymentHash = tx.hash;
        saveSubscriptionToStorage();
        
        addToLog(`${t('payment_sent')} ${tx.hash.slice(0, 18)}...`, 'pending');
        closePaymentModal();
        
        // Отслеживать статус — на ТОЙ ЖЕ сети, где реально была отправлена tx
        await checkPaymentStatus(tx.hash, chain);
        
    } catch (error) {
        addToLog('❌ ' + (error.message || error).toString().slice(0, 100), 'error');
    } finally {
        userSubscription.isPaying = false;
    }
}

// ── Отправка USDC ──────────────────────────────────────────

async function sendUSDC(tokenAddress, toAddress, amount, chain) {
    if (!window.ethereum) {
        throw new Error('Кошелёк (MetaMask/Rabby) не найден в браузере');
    }

    // Оплата подписки — это перевод с ОСНОВНОГО кошелька пользователя
    // (через расширение в браузере), а НЕ с Signer Key — у делегат-ключа
    // по дизайну нет ни средств, ни возможности их выводить.
    const targetChain = chain || PAYMENT_CHAINS.rise;
    if (typeof ensureChainInWallet === 'function') {
        await ensureChainInWallet(targetChain.chainId, targetChain.name, targetChain.rpcUrl, targetChain.nativeCurrency);
    }
    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    await browserProvider.send('eth_requestAccounts', []);
    const payerSigner = await browserProvider.getSigner();

    const ERC20_ABI = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)',
        'function balanceOf(address) view returns (uint256)'
    ];

    try {
        const token = new ethers.Contract(tokenAddress, ERC20_ABI, payerSigner);

        const decimals = await token.decimals();
        const amountWithDecimals = ethers.parseUnits(amount, decimals);

        const payerAddress = await payerSigner.getAddress();
        const balance = await token.balanceOf(payerAddress);

        console.log('💰 Subscription payment check:', {
            chain: targetChain.name, tokenAddress, payerAddress,
            rawBalance: balance.toString(),
            humanBalance: ethers.formatUnits(balance, decimals),
            decimals, needed: amount,
        });

        if (balance < amountWithDecimals) {
            throw new Error(
                `Insufficient balance. Wallet ${payerAddress.slice(0,8)}... has ` +
                `${ethers.formatUnits(balance, decimals)} of token ${tokenAddress.slice(0,8)}... ` +
                `(need ${amount}). Это free-баланс кошелька, НЕ депонированный на RISEx коллатерал — ` +
                `если весь USDC уже задепонирован на бирже, тут его не будет.`
            );
        }

        const tx = await token.transfer(toAddress, amountWithDecimals);
        console.log('Transaction sent:', tx.hash);

        return tx;
    } catch (error) {
        console.error('Send USDC error:', error);
        throw error;
    }
}

// ── Проверка статуса платежа ───────────────────────────────

async function checkPaymentStatus(txHash, chain) {
    if (!txHash) return;

    const targetChain = chain || PAYMENT_CHAINS.rise;
    // Свой RPC-провайдер под сеть платежа — глобальный ethProvider завязан
    // только на Rise и никогда не найдёт tx, отправленную на другой сети.
    const provider = targetChain.chainId === RISE_CHAIN.chainId && ethProvider
        ? ethProvider
        : new ethers.JsonRpcProvider(targetChain.rpcUrl);

    try {
        addToLog(t('payment_checking'), 'meta');
        
        // Ждем несколько попыток
        for (let i = 0; i < 30; i++) {
            const receipt = await provider.getTransactionReceipt(txHash);
            
            if (receipt) {
                if (receipt.status === 1) {
                    // Успешно!
                    userSubscription.status = 'active';
                    userSubscription.subscriptionEndDate = Date.now() + (30 * 24 * 60 * 60 * 1000); // +30 дней
                    userSubscription.trialStartDate = null;
                    userSubscription.trialDaysRemaining = 0;
                    
                    saveSubscriptionToStorage();
                    updateSubscriptionUI();
                    enableTradingButtons();
                    
                    addToLog(`✅ ${t('payment_success')}`, 'success');
                    return true;
                } else {
                    // Ошибка
                    addToLog(t('payment_failed'), 'error');
                    userSubscription.lastPaymentHash = null;
                    return false;
                }
            }
            
            // Ждем 2 секунды
            await new Promise(r => setTimeout(r, 2000));
        }
        
        addToLog(t('payment_timeout'), 'warning');
        return false;
        
    } catch (error) {
        console.error('Check payment error:', error);
        addToLog('❌ ' + error.message.slice(0, 80), 'error');
    }
}

// ── Проверка подписки каждые 60 сек ────────────────────────

setInterval(() => {
    if (isLoggedIn && userSubscription.uid) {
        checkSubscriptionStatus();
        updateSubscriptionUI();
    }
}, 60000);

// ── Экспорты ───────────────────────────────────────────────

window.initSubscription = initSubscription;
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.confirmPayment = confirmPayment;
window.checkPaymentStatus = checkPaymentStatus;

console.log('%cSubscription loaded', 'color:#00ff9d');
