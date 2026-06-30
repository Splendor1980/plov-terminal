// ============================================================
// js/signer.js — RISEx SIGNER KEY MANAGEMENT
// User provides their own Signer Key created on rise.trade
// ============================================================

let signerKey     = null;   // private key (string)
let signer        = null;   // ethers.Wallet
let signerAddress = null;
let ethProvider   = null;

const RISE_API_URL = 'https://www.rise.trade/en/API';

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

        localStorage.setItem('plov_signer_key', key);

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
    const saved = localStorage.getItem('plov_signer_key');
    if (!saved) return false;

    try {
        if (!ethProvider) initEthProvider();
        const wallet = new ethers.Wallet(saved, ethProvider);
        signerKey     = saved;
        signer        = wallet;
        signerAddress = wallet.address;
        updateSignerUI();
        return true;
    } catch {
        localStorage.removeItem('plov_signer_key');
        return false;
    }
}

function disconnectSigner() {
    if (!confirm(t('signer_disconnect_confirm'))) return;

    signerKey     = null;
    signer        = null;
    signerAddress = null;
    localStorage.removeItem('plov_signer_key');

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

window.openRiseApiPage     = openRiseApiPage;
window.initEthProvider     = initEthProvider;
window.saveSignerKey       = saveSignerKey;
window.loadSignerKey       = loadSignerKey;
window.disconnectSigner    = disconnectSigner;
window.copySignerAddress   = copySignerAddress;
window.updateSignerUI      = updateSignerUI;
window.isSignerReady       = isSignerReady;
console.log('%cSigner loaded', 'color:#00ff9d');
