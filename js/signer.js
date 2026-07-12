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

function encryptSignerKey(key, uid) {
    try {
        // Простое шифрование XOR с uid (NOT CRYPTOGRAPHICALLY SECURE - только для базовой защиты)
        // В production должно быть настоящее шифрование
        let encrypted = '';
        for (let i = 0; i < key.length; i++) {
            encrypted += String.fromCharCode(key.charCodeAt(i) ^ uid.charCodeAt(i % uid.length));
        }
        return btoa(encrypted);  // Base64 encode
    } catch (e) {
        console.warn('Encryption failed:', e);
        return null;
    }
}

function decryptSignerKey(encrypted, uid) {
    try {
        const decoded = atob(encrypted);  // Base64 decode
        let decrypted = '';
        for (let i = 0; i < decoded.length; i++) {
            decrypted += String.fromCharCode(decoded.charCodeAt(i) ^ uid.charCodeAt(i % uid.length));
        }
        return decrypted;
    } catch (e) {
        console.warn('Decryption failed:', e);
        return null;
    }
}

// ── Сохранение signer ──────────────────────────────────────

function saveSignerToStorage(key, uid) {
    if (!key || !uid) return false;
    
    try {
        const encrypted = encryptSignerKey(key, uid);
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

function loadSignerFromStorage(uid) {
    if (!uid) return false;
    
    try {
        const encrypted = localStorage.getItem(SIGNER_STORAGE_KEY + '_' + uid);
        if (!encrypted) {
            console.log('No saved signer found');
            return false;
        }
        
        const key = decryptSignerKey(encrypted, uid);
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
            saveSignerToStorage(key, currentUser.uid);
        }

        updateSignerUI();
        addToLog(`${t('signer_connected_msg')} ${signerAddress.slice(0,8)}...${signerAddress.slice(-6)}`, 'success');

        // Сразу пробуем загрузить баланс
        fetchBalance();

    } catch (e) {
        addToLog(t('signer_invalid'), 'error');
        console.error('Invalid signer key:', e.message);
    }
}

function loadSignerKey() {
    if (!currentUser || !currentUser.uid) {
        return false;
    }

    // Попробовать загрузить из localStorage
    if (loadSignerFromStorage(currentUser.uid)) {
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
