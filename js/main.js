// ============================================================
// js/main.js — ТОЧКА ВХОДА v2.4
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

window.addEventListener('DOMContentLoaded', async () => {
    console.log('%c🚀 ПЛОВ Scalping Terminal v2.1', 'color:#00ff9d;font-weight:bold');

    // 1. Инициализируем безопасность (до всего остального)
    initSecurity();

    // 2. UI + язык
    initUI();
    loadLanguage();
    setLanguage(currentLang);
    initChart();

    // 3. Сообщение о localhost
    if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
        setTimeout(() => {
            addToLog('ℹ️ Localhost: стакан не загрузится из-за CORS — на Vercel заработает', 'meta');
        }, 800);
    }

    // 4. Ждём Firebase
    let firebaseReady = false;
    for (let i = 0; i < 20; i++) {
        if (typeof firebase !== 'undefined' && firebase.app) { firebaseReady = true; break; }
        await new Promise(r => setTimeout(r, 300));
    }

    if (!firebaseReady) {
        addToLog('❌ Firebase не загружен. Проверьте интернет.', 'error');
        return;
    }

    // 5. Инициализируем Firebase
    let app;
    try { app = firebase.app(); } catch { app = firebase.initializeApp(firebaseConfig); }
    window.fbAuth   = firebase.auth();
    window.fbDb     = firebase.firestore();
    window.fbGoogle = new firebase.auth.GoogleAuthProvider();

    // 6. Конфиг RISEx
    await loadSystemConfig();

    // 7. Auth listener
    fbAuth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            isLoggedIn  = true;
            updateAuthUI();
            setLanguage(currentLang);

            addToLog(`${t('welcome')}, ${user.displayName || user.email}!`, 'success');

            await createOrLoadWallet(user.uid);
            if (!userWallet.address) return;

            updateBalanceUI();
            // registerSigner не нужен в режиме симуляции
            loadStats().catch(() => {});

            startOrderBook(currentMarket);
            startPriceFeed();

            addToLog(t('hotkeys_hint'), 'meta');

            // Показываем пузырь при первом входе
            showWelcomeBubble();

        } else {
            isLoggedIn  = false;
            currentUser = null;
            updateAuthUI();
            setLanguage(currentLang);
            stopPriceFeed();
            stopOrderBook();
            addToLog(t('login_start'), 'info');
        }
    });

    console.log('%c✅ ПЛОВ готов', 'color:#00ff9d;font-weight:bold');
});

// Экспорты
window.handleAuth            = handleAuth;
window.toggleTheme           = toggleTheme;
window.setLanguage           = setLanguage;
window.handleBuyClick        = handleBuyClick;
window.handleSellClick       = handleSellClick;
window.setPct                = setPct;
window.setMode               = setMode;
window.setLeverage           = setLeverage;
window.closePosition         = closePosition;
window.handleDeposit         = handleDeposit;
window.handleWithdraw        = handleWithdraw;
window.copyAddress           = copyAddress;
window.confirmPin            = confirmPin;
window.cancelPin             = cancelPin;
window.showToast             = showToast;
window.toggleSettings        = toggleSettings;
window.closeSettings         = closeSettings;
window.setSecurityMode       = setSecurityMode;
window.showBubbleManual      = showBubbleManual;
window.dismissBubble         = dismissBubble;
window.dismissAndOpenSettings = dismissAndOpenSettings;
