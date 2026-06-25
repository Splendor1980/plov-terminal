// ============================================================
// js/wallet.js — КОШЕЛЁК (PIN исправлен + мок-баланс)
// ============================================================

let userWallet = {
    address:          null,
    encryptedKey:     null,
    balances:         { usdc: 0, wbtc: 0 },
    risexBalance:     0,
    signerRegistered: false,
    faucetClaimed:    false
};

let ethProvider = null;
let signer      = null;
let currentPin  = null;

// ── Шифрование ──────────────────────────────────────────────

async function encryptKey(privateKey, pin) {
    const enc  = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const km   = await crypto.subtle.importKey(
        'raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
    const k    = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
        km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const ct   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(privateKey));
    return { ct: Array.from(new Uint8Array(ct)), iv: Array.from(iv), salt: Array.from(salt) };
}

async function decryptKey(enc, pin) {
    const e  = new TextEncoder();
    const km = await crypto.subtle.importKey(
        'raw', e.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
    const k  = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: new Uint8Array(enc.salt), iterations: 200000, hash: 'SHA-256' },
        km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(enc.iv) }, k, new Uint8Array(enc.ct));
    return new TextDecoder().decode(pt);
}

// ── PIN модал ───────────────────────────────────────────────

let _pinResolve = null;

function askPin(title) {
    return new Promise((resolve) => {
        _pinResolve = resolve;
        const modal   = document.getElementById('pin-modal');
        const err     = document.getElementById('pin-error');
        const inp     = document.getElementById('pin-input');
        const titleEl = modal.querySelector('.modal-title');
        if (err)     err.textContent     = '';
        if (inp)     inp.value           = '';
        if (titleEl) titleEl.textContent = title || '🔐 PIN';
        modal.style.display = 'flex';
        setTimeout(() => inp && inp.focus(), 100);
    });
}

function confirmPin() {
    const inp = document.getElementById('pin-input');
    const err = document.getElementById('pin-error');
    const pin = inp ? inp.value : '';

    // Проверка длины
    if (!pin || pin.length < 4) {
        if (err) err.textContent = t('pin_min');
        return;
    }

    document.getElementById('pin-modal').style.display = 'none';
    if (_pinResolve) { _pinResolve(pin); _pinResolve = null; }
}

function cancelPin() {
    document.getElementById('pin-modal').style.display = 'none';
    if (_pinResolve) { _pinResolve(null); _pinResolve = null; }
}

// Enter в поле PIN
document.addEventListener('keydown', e => {
    const modal = document.getElementById('pin-modal');
    if (modal && modal.style.display === 'flex' && e.key === 'Enter') {
        e.preventDefault();
        confirmPin();
    }
});

// ── Создание / загрузка кошелька ────────────────────────────

async function createOrLoadWallet(uid) {
    try {
        ethProvider = new ethers.JsonRpcProvider(RISE_CHAIN.rpcUrl);
    } catch (e) {
        console.warn('RPC Provider error:', e.message);
    }

    const storageKey = `plov_wallet_${uid}`;
    const saved      = localStorage.getItem(storageKey);

    if (saved) {
        try {
            const data = JSON.parse(saved);
            userWallet.address          = data.address;
            userWallet.encryptedKey     = data.encryptedKey;
            userWallet.balances         = data.balances || { usdc: 0, wbtc: 0 };
            userWallet.risexBalance     = data.risexBalance || 0;
            userWallet.signerRegistered = data.signerRegistered || false;
            userWallet.faucetClaimed    = data.faucetClaimed || false;
            addToLog(t('wallet_loaded'), 'meta');
        } catch (e) {
            console.error('Wallet parse error:', e);
        }
    } else {
        // Новый кошелёк
        const wallet = ethers.Wallet.createRandom();

        const pin1 = await askPin(t('pin_title'));
        if (!pin1) { addToLog(t('pin_not_set'), 'error'); return; }

        const pin2 = await askPin(t('pin_confirm'));
        if (pin1 !== pin2) {
            addToLog(t('pin_error_match'), 'error');
            return;
        }

        userWallet.address      = wallet.address;
        userWallet.encryptedKey = await encryptKey(wallet.privateKey, pin1);
        userWallet.balances     = { usdc: 0, wbtc: 0 };
        userWallet.risexBalance = 0;
        currentPin              = pin1;

        saveWalletLocal(uid);
        addToLog(t('wallet_created'), 'success');

        // Пробуем реальный фаусет
        await claimFaucet(wallet.address, uid);
    }
}

// ── Разблокировка для подписи ────────────────────────────────

async function unlockSigner(uid) {
    if (signer) return true;

    const pin = currentPin || await askPin(t('pin_unlock'));
    if (!pin) return false;

    try {
        const pk   = await decryptKey(userWallet.encryptedKey, pin);
        signer     = new ethers.Wallet(pk, ethProvider);
        currentPin = pin;
        return true;
    } catch {
        addToLog(t('pin_wrong'), 'error');
        currentPin = null;
        signer     = null;
        return false;
    }
}

// ── Фаусет ──────────────────────────────────────────────────
// Пробуем реальный API, если не работает — даём виртуальный баланс

async function claimFaucet(address, uid) {
    addToLog(t('faucet_loading'), 'info');
    let success = false;

    try {
        const res = await fetch(`${RISEX_API.rest}/v1/account/deposit`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ account: address })
        });

        if (res.ok) {
            userWallet.balances.usdc = 1000;
            userWallet.risexBalance  = 1000;
            userWallet.faucetClaimed = true;
            addToLog(t('faucet_received'), 'success');
            success = true;
        } else {
            addToLog(t('faucet_used'), 'info');
        }
    } catch (e) {
        // CORS на localhost или сеть недоступна
        addToLog(t('cors_warning'), 'meta');
    }

    // Если реальный фаусет не сработал — даём виртуальный баланс
    if (!success) {
        userWallet.balances.usdc = 1000;
        userWallet.risexBalance  = 1000;
        addToLog(t('faucet_mock'), 'success');
    }

    if (uid) saveWalletLocal(uid);
    updateBalanceUI();
}

// ── Баланс из API ────────────────────────────────────────────

async function fetchBalance() {
    if (!userWallet.address) return;
    try {
        const res = await fetch(
            `${RISEX_API.rest}/v1/account/balance?account=${userWallet.address}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.balance !== undefined)
            userWallet.risexBalance = parseFloat(data.balance) / 1e18;
        if (data.usdc !== undefined)
            userWallet.risexBalance = parseFloat(data.usdc) / 1e6;
        if (currentUser) saveWalletLocal(currentUser.uid);
    } catch {
        // Нет сети / CORS — используем локальный баланс
    }
    updateBalanceUI();
}

// ── Кнопка Депозит ──────────────────────────────────────────

async function handleDeposit() {
    if (!isLoggedIn) { addToLog(t('login_required'), 'error'); return; }
    await claimFaucet(userWallet.address, currentUser.uid);
}

// ── Кнопка Вывод ────────────────────────────────────────────

async function handleWithdraw() {
    if (!isLoggedIn) { addToLog(t('login_required'), 'error'); return; }

    const ok = await unlockSigner(currentUser.uid);
    if (!ok) return;

    // Проверяем баланс
    const balance = userWallet.risexBalance || userWallet.balances.usdc || 0;
    if (balance <= 0) {
        addToLog('⚠️ Нет средств для вывода', 'warning');
        return;
    }

    const to = prompt(t('withdraw_to'));
    if (!to || !to.startsWith('0x') || to.length !== 42) {
        addToLog(t('addr_invalid'), 'error');
        return;
    }

    const amt = parseFloat(prompt(t('withdraw_amount'), '10') || '0');
    if (!amt || amt <= 0) return;
    if (!confirm(`${t('withdraw_confirm')}\n${to}\n${amt} USDC`)) return;

    try {
        addToLog(t('withdraw_pending'), 'pending');

        if (!RISEX_CONTRACTS.usdc) {
            addToLog(t('withdraw_no_addr'), 'error');
            return;
        }

        const ERC20   = ['function transfer(address to,uint256 amount) returns(bool)', 'function decimals() view returns(uint8)'];
        const token   = new ethers.Contract(RISEX_CONTRACTS.usdc, ERC20, signer);
        const dec     = await token.decimals();
        const tx      = await token.transfer(to, ethers.parseUnits(String(amt), dec));
        addToLog(`${t('tx_pending')} ${tx.hash.slice(0,18)}...`, 'pending');
        await tx.wait(1);

        userWallet.risexBalance -= amt;
        userWallet.balances.usdc = Math.max(0, (userWallet.balances.usdc || 0) - amt);
        saveWalletLocal(currentUser.uid);
        updateBalanceUI();

        addToLog(`${t('withdraw_success')} ${amt} USDC`, 'success');
        addToLog(t('tx_explorer'), 'link', `${RISE_CHAIN.explorer}/tx/${tx.hash}`);
    } catch (e) {
        addToLog('❌ ' + (e.message || e).toString().slice(0, 100), 'error');
    }
}

// ── UI ───────────────────────────────────────────────────────

function updateBalanceUI() {
    const usdcEl  = document.getElementById('bal-usdc');
    const risexEl = document.getElementById('bal-risex');
    if (usdcEl)  usdcEl.textContent  = (userWallet.balances.usdc  || 0).toFixed(2);
    if (risexEl) risexEl.textContent = (userWallet.risexBalance    || 0).toFixed(2);

    const addrEl = document.getElementById('wallet-short');
    if (addrEl && userWallet.address) {
        const a = userWallet.address;
        addrEl.textContent = a.slice(0, 8) + '…' + a.slice(-6);
    }
}

function saveWalletLocal(uid) {
    if (!uid) return;
    localStorage.setItem(`plov_wallet_${uid}`, JSON.stringify({
        address:          userWallet.address,
        encryptedKey:     userWallet.encryptedKey,
        balances:         userWallet.balances,
        risexBalance:     userWallet.risexBalance,
        signerRegistered: userWallet.signerRegistered,
        faucetClaimed:    userWallet.faucetClaimed
    }));
}

function copyAddress() {
    if (!userWallet.address) return;
    navigator.clipboard.writeText(userWallet.address)
        .then(() => showToast(t('copied')))
        .catch(() => showToast(userWallet.address));
}

window.createOrLoadWallet = createOrLoadWallet;
window.unlockSigner       = unlockSigner;
window.fetchBalance       = fetchBalance;
window.updateBalanceUI    = updateBalanceUI;
window.saveWalletLocal    = saveWalletLocal;
window.handleDeposit      = handleDeposit;
window.handleWithdraw     = handleWithdraw;
window.copyAddress        = copyAddress;
window.confirmPin         = confirmPin;
window.cancelPin          = cancelPin;
console.log('%cWallet loaded', 'color:#00ff9d');
