// ============================================================
// js/main.js — ENTRY POINT v3.0
// ============================================================

document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); handleBuyClick();  }
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); handleSellClick(); }
    if (e.key === 'Escape') {
        document.getElementById('amount-input').value = '';
        closeSettings();
        hideBubble();
    }
});

document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.activeElement?.id === 'signer-key-input') {
        saveSignerKey();
    }
});

window.addEventListener('DOMContentLoaded', async () => {
    console.log('%c🚀 PLOV Scalping Terminal v3.0', 'color:#00ff9d;font-weight:bold');

    initUI();
    loadLanguage();
    setLanguage(currentLang);
    initChart();

    // Signer key — restore if saved
    initEthProvider();
    loadSignerKey();

    // Order book + price — public data, start immediately
    await loadSystemConfig();
    startOrderBook(currentMarket);
    startPriceFeed();

    if (isSignerReady()) {
        fetchBalance();
    }

    // Firebase — background, only for platform login
    let firebaseReady = false;
    for (let i = 0; i < 20; i++) {
        if (typeof firebase !== 'undefined' && firebase.app) { firebaseReady = true; break; }
        await new Promise(r => setTimeout(r, 300));
    }

    if (!firebaseReady) {
        addToLog('⚠️ Google sign-in unavailable. Trading terminal works.', 'meta');
        return;
    }

    let app;
    try { app = firebase.app(); } catch { app = firebase.initializeApp(firebaseConfig); }
    window.fbAuth   = firebase.auth();
    window.fbGoogle = new firebase.auth.GoogleAuthProvider();

    fbAuth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            isLoggedIn  = true;
            updateAuthUI();
            setLanguage(currentLang);

            addToLog(`${t('welcome')}, ${user.displayName || user.email}!`, 'success');

            loadStats(user.uid);
            if (typeof loadMyTrades === 'function') loadMyTrades(user.uid);

            addToLog(t('hotkeys_hint'), 'meta');
            showWelcomeBubble();

        } else {
            isLoggedIn  = false;
            currentUser = null;
            updateAuthUI();
            setLanguage(currentLang);
            addToLog(t('login_start'), 'info');
        }
    });

    console.log('%c✅ PLOV ready', 'color:#00ff9d;font-weight:bold');
});

// Exports
window.handleAuth      = handleAuth;
window.toggleTheme     = toggleTheme;
window.setLanguage     = setLanguage;
window.handleBuyClick  = handleBuyClick;
window.handleSellClick = handleSellClick;
window.setPct          = setPct;
window.setLeverage     = setLeverage;
window.closePosition   = closePosition;
window.showToast       = showToast;
window.switchLogTab    = switchLogTab;
