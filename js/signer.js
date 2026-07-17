// ============================================================
// js/signer.js — RISEx SIGNER KEY MANAGEMENT + PERSISTENCE
// User provides their own Signer Key created on rise.trade
// ============================================================
// NOTE: signer, signerAddress, ethProvider are already declared in wallet.js
// This file ONLY declares signerKey and uses global variables from wallet.js

let signerKey     = null;   // private key (string)
// signer, signerAddress, ethProvider используются из wallet.js (глобальные переменные)

const RISE_API_URL = 'https://www.rise.trade/en/API';
const SIGNER_STORAGE_KEY = 'plov_signer_key_encrypted';

// ── Шифрование/дешифрование приватного ключа ───────────────
// Реальное AES-GCM+PBKDF2 (функции encryptKey/decryptKey из wallet.js),
// вместо предыдущего обратимого XOR с uid, который не давал
// реальной защиты (uid известен любому, у кого есть доступ к
// localStorage жертвы).

async function encryptSignerKey(key, uid) {
    try {
        const payload = await encryptKey(key, uid);
        return btoa(JSON.stringify(payload));
    } catch (e) {
        console.warn('Encryption failed:', e);
        return null;
    }
}

async function decryptSignerKey(encrypted, uid) {
    try {
        const payload = JSON.parse(atob(encrypted));
        return await decryptKey(payload, uid);
    } catch (e) {
        console.warn('Decryption failed:', e);
        return null;
    }
}

// ── Сохранение signer ──────────────────────────────────────

async function saveSignerToStorage(key, uid) {
    if (!key || !uid) return false;
    
    try {
        const encrypted = await encryptSignerKey(key, uid);
        if (!encrypted) return false;
        
        localStorage.setItem(SIGNER_STORAGE_KEY + '_' + uid, encrypted);
        localStorage.setItem('plov_signer_account_' + uid, signerAddress || '');
        console.log('✅ Signer saved to localStorage');
        return true;
    } catch (e) {
        console.warn('Save signer error:', e);
        return false;
    }
}

// ── Загрузка signer из localStorage ────────────────────────

async function loadSignerFromStorage(uid) {
    if (!uid) return false;
    
    try {
        const encrypted = localStorage.getItem(SIGNER_STORAGE_KEY + '_' + uid);
        if (!encrypted) {
            console.log('No saved signer found');
            return false;
        }
        
        const key = await decryptSignerKey(encrypted, uid);
        if (!key) return false;
        
        if (!ethProvider) initEthProvider();
        const wallet = new ethers.Wallet(key, ethProvider);
        
        signerKey     = key;
        signer        = wallet;
        signerAddress = wallet.address;
        
        updateSignerUI();
        console.log('✅ Signer loaded from localStorage:', signerAddress);
        return true;
    } catch (e) {
        console.warn('Load signer error:', e);
        return false;
    }
}

// ── Очистка signer из localStorage ─────────────────────────

function clearSignerFromStorage(uid) {
    if (!uid) return;
    
    try {
        localStorage.removeItem(SIGNER_STORAGE_KEY + '_' + uid);
        localStorage.removeItem('plov_signer_account_' + uid);
        console.log('✅ Signer cleared from localStorage');
    } catch (e) {
        console.warn('Clear signer error:', e);
    }
}

function openRiseApiPage() {
    window.open(RISE_API_URL, '_blank', 'noopener');
}

function initEthProvider() {
    try {
        ethProvider = new ethers.JsonRpcProvider(RISE_CHAIN.rpcUrl);
    } catch (e) {
        console.warn('RPC provider error:', e.message);
    }
}

// ── Save / load signer key ──────────────────────────────────

function saveSignerKey() {
    const input = document.getElementById('signer-key-input');
    let key = input ? input.value.trim() : '';

    if (!key) {
        addToLog(t('signer_empty'), 'error');
        return;
    }
    if (!key.startsWith('0x')) key = '0x' + key;

    try {
        if (!ethProvider) initEthProvider();
        const wallet = new ethers.Wallet(key, ethProvider);

        signerKey     = key;
        signer        = wallet;
        signerAddress = wallet.address;

        // Сохранить в localStorage (зашифровано)
        if (currentUser && currentUser.uid) {
            saveSignerToStorage(key, currentUser.uid).catch(e => console.warn('saveSignerToStorage failed:', e));
        }

        updateSignerUI();
        addToLog(`${t('signer_connected_msg')} ${signerAddress.slice(0,8)}...${signerAddress.slice(-6)}`, 'success');

        // Регистрируем signer на RISEx (не блокирует UI при ошибке)
        if (typeof registerSigner === 'function' && currentUser?.uid) {
            registerSigner(currentUser.uid).catch(() => {});
        }

        // Сразу пробуем загрузить баланс и позицию
        fetchBalance();
        if (typeof loadRealPosition === 'function') loadRealPosition();

    } catch (e) {
        addToLog(t('signer_invalid'), 'error');
        console.error('Invalid signer key:', e.message);
    }
}

async function loadSignerKey() {
    if (!currentUser || !currentUser.uid) {
        return false;
    }

    // Попробовать загрузить из localStorage
    if (await loadSignerFromStorage(currentUser.uid)) {
        return true;
    }

    return false;
}

function disconnectSigner() {
    if (!confirm(t('signer_disconnect_confirm'))) return;

    signerKey     = null;
    signer        = null;
    signerAddress = null;

    // Очистить из localStorage
    if (currentUser && currentUser.uid) {
        clearSignerFromStorage(currentUser.uid);
    }

    updateSignerUI();
    addToLog(t('signer_disconnected_msg'), 'info');

    // Сброс баланса
    userBalance = 0;
    updateBalanceUI();
}

function copySignerAddress() {
    if (!signerAddress) return;
    navigator.clipboard.writeText(signerAddress)
        .then(() => showToast(t('copied')))
        .catch(() => {});
}

// ── UI ───────────────────────────────────────────────────────

function updateSignerUI() {
    const notConnected = document.getElementById('signer-not-connected');
    const connected     = document.getElementById('signer-connected');
    const addrShort     = document.getElementById('signer-address-short');

    if (signerAddress) {
        if (notConnected) notConnected.style.display = 'none';
        if (connected)     connected.style.display    = 'block';
        if (addrShort)     addrShort.textContent       =
            signerAddress.slice(0,8) + '…' + signerAddress.slice(-6);
    } else {
        if (notConnected) notConnected.style.display = 'block';
        if (connected)     connected.style.display    = 'none';
    }
}

function isSignerReady() {
    return !!signer && !!signerAddress;
}

// ── Экспорты ───────────────────────────────────────────────

window.openRiseApiPage       = openRiseApiPage;
window.initEthProvider       = initEthProvider;
window.saveSignerKey         = saveSignerKey;
window.loadSignerKey         = loadSignerKey;
window.disconnectSigner      = disconnectSigner;
window.copySignerAddress     = copySignerAddress;
window.updateSignerUI        = updateSignerUI;
window.isSignerReady         = isSignerReady;
window.loadSignerFromStorage = loadSignerFromStorage;
console.log('%cSigner loaded', 'color:#00ff9d');
