// ============================================================
// js/risex-connect.js - Connect RISEx Wallet UI & Logic
// ============================================================
// UI для ввода API Wallet адреса и сохранение в Firestore
// ============================================================

let risexConnected = false;
let userApiWalletAddress = null;

async function loadRisexStatus() {
    if (!currentUser || !currentUser.uid) {
        console.warn('loadRisexStatus: no currentUser');
        return;
    }

    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        
        if (userDoc.exists && userDoc.data().apiWalletAddress) {
            userApiWalletAddress = userDoc.data().apiWalletAddress;
            risexConnected = true;
            updateRisexUI();
            console.log('✅ RISEx wallet loaded:', userApiWalletAddress);
        } else {
            risexConnected = false;
            updateRisexUI();
            console.log('⚠️ RISEx wallet not connected');
        }
    } catch (error) {
        console.error('loadRisexStatus error:', error);
    }
}

function updateRisexUI() {
    const modal = document.getElementById('risex-connect-modal');
    const statusEl = document.getElementById('risex-status');
    const addressEl = document.getElementById('risex-wallet-address-display');

    if (risexConnected && userApiWalletAddress) {
        // Скрыть модаль, показать статус Connected
        if (modal) modal.style.display = 'none';
        if (statusEl) {
            statusEl.innerHTML = '✅ <span style="color: #00ff9d;">Connected</span>';
            statusEl.style.display = 'block';
        }
        if (addressEl) {
            addressEl.textContent = userApiWalletAddress.slice(0, 8) + '...' + userApiWalletAddress.slice(-6);
            addressEl.style.display = 'inline';
        }
    } else {
        // Показать баннер "Подключить"
        if (statusEl) {
            statusEl.innerHTML = '❌ <span style="color: #ff6b6b;">Not Connected</span>';
            statusEl.style.display = 'block';
        }
        if (addressEl) addressEl.style.display = 'none';
    }
}

async function connectRisexWallet() {
    const inputEl = document.getElementById('risex-wallet-input');
    const address = inputEl?.value?.trim();

    if (!address) {
        alert('Please enter your RISEx API Wallet address');
        return;
    }

    // Валидация адреса
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        alert('Invalid Ethereum address format');
        return;
    }

    if (!currentUser || !currentUser.uid) {
        alert('Please login first');
        return;
    }

    try {
        const idToken = await currentUser.getIdToken();

        const response = await fetch('/api/connect-risex', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: currentUser.uid,
                apiWalletAddress: address,
                idToken: idToken
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || error.error);
        }

        const result = await response.json();
        console.log('✅ RISEx connected:', result);

        userApiWalletAddress = address;
        risexConnected = true;
        updateRisexUI();

        // Загрузить баланс с новым адресом
        setTimeout(() => fetchBalance(), 500);

        alert('✅ RISEx wallet connected successfully!');

    } catch (error) {
        console.error('connectRisexWallet error:', error);
        alert('❌ Error: ' + error.message);
    }
}

async function disconnectRisexWallet() {
    if (!confirm('Disconnect RISEx wallet?')) return;

    if (!currentUser || !currentUser.uid) {
        alert('Please login first');
        return;
    }

    try {
        await db.collection('users').doc(currentUser.uid).update({
            apiWalletAddress: null,
            risexConnected: false
        });

        userApiWalletAddress = null;
        risexConnected = false;
        updateRisexUI();

        alert('✅ RISEx wallet disconnected');

    } catch (error) {
        console.error('disconnectRisexWallet error:', error);
        alert('❌ Error: ' + error.message);
    }
}

// Экспорты
window.loadRisexStatus = loadRisexStatus;
window.connectRisexWallet = connectRisexWallet;
window.disconnectRisexWallet = disconnectRisexWallet;
window.getRisexConnected = () => risexConnected;
window.getUserApiWalletAddress = () => userApiWalletAddress;

console.log('%cRISEx Connect Module loaded', 'color:#00ff9d');
