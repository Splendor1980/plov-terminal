// ============================================================
// js/auth.js — GOOGLE AUTH (упрощённая, Firebase из main.js)
// ============================================================

let isLoggedIn  = false;
let currentUser = null;

async function handleAuth() {
    if (!window.fbAuth) {
        addToLog('❌ Firebase не готов, попробуйте через 2 сек', 'error');
        return;
    }

    if (isLoggedIn) {
        if (confirm(t('logout_confirm'))) await doLogout();
        return;
    }

    const btn = document.getElementById('btn-auth');
    try {
        btn.disabled    = true;
        btn.textContent = '⏳...';
        await fbAuth.signInWithPopup(window.fbGoogle);
        // onAuthStateChanged в main.js подхватит
    } catch (e) {
        let msg = e.message || 'Ошибка входа';
        if (e.code === 'auth/popup-blocked')       msg = '❌ Попап заблокирован браузером';
        if (e.code === 'auth/popup-closed-by-user') msg = 'ℹ️ Окно закрыто';
        if (e.code === 'auth/cancelled-popup-request') return;
        addToLog(msg, 'error');
    } finally {
        btn.disabled = false;
        updateAuthUI();
    }
}

async function doLogout() {
    try { if (fbAuth) await fbAuth.signOut(); } catch {}

    isLoggedIn  = false;
    currentUser = null;
    signer      = null;
    currentPin  = null;
    userWallet  = {
        address: null, encryptedKey: null,
        balances: { usdc: 0, wbtc: 0 },
        risexBalance: 0, signerRegistered: false, faucetClaimed: false
    };

    stopPriceFeed();
    stopOrderBook();
    updateAuthUI();
    updateBalanceUI();
    addToLog(t('logout_done'), 'info');
}

function updateAuthUI() {
    const btn   = document.getElementById('btn-auth');
    const badge = document.getElementById('status-badge');
    if (!btn) return;

    if (isLoggedIn && currentUser) {
        const name       = currentUser.displayName || currentUser.email || '';
        btn.textContent  = t('btn_logout') + ' ' + name.slice(0, 12);
        btn.className    = 'btn-auth logout';
        btn.disabled     = false;
        if (badge) { badge.textContent = t('status_online'); badge.className = 'status-badge online'; }
    } else {
        btn.textContent = t('btn_google');
        btn.className   = 'btn-auth';
        btn.disabled    = false;
        if (badge) { badge.textContent = t('status_offline'); badge.className = 'status-badge offline'; }
    }
}

window.handleAuth   = handleAuth;
window.doLogout     = doLogout;
window.updateAuthUI = updateAuthUI;
console.log('%cAuth loaded', 'color:#00ff9d');
