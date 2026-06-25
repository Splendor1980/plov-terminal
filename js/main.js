// ============================================================
// js/main.js — ТОЧКА ВХОДА
// ============================================================

document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); handleBuyClick();  }
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); handleSellClick(); }
    if (e.key === 'Escape') {
        const inp = document.getElementById('amount-input');
        if (inp) inp.value = '';
    }
});

window.addEventListener('DOMContentLoaded', async () => {
    console.log('%c🚀 ПЛОВ Scalping Terminal v2.1', 'color:#00ff9d;font-weight:bold');

    // 1. UI (тема) сразу
    initUI();

    // 2. Язык — после того как DOM готов
    loadLanguage();
    setLanguage(currentLang);

    // 3. График
    initChart();

    // 4. Предупреждение о CORS если localhost
    if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
        setTimeout(() => {
            addToLog('ℹ️ Localhost: стакан не загрузится из-за CORS — это нормально', 'meta');
            addToLog('ℹ️ На Vercel всё заработает', 'meta');
        }, 1000);
    }

    // 5. Ждём Firebase (он загружается с defer)
    let firebaseReady = false;
    for (let i = 0; i < 20; i++) {
        if (typeof firebase !== 'undefined' && firebase.app) {
            firebaseReady = true;
            break;
        }
        await new Promise(r => setTimeout(r, 300));
    }

    if (!firebaseReady) {
        addToLog('❌ Firebase не загружен. Проверьте интернет.', 'error');
        return;
    }

    // 6. Инициализируем Firebase
    let app;
    try { app = firebase.app(); }
    catch { app = firebase.initializeApp(firebaseConfig); }

    window.fbAuth   = firebase.auth();
    window.fbDb     = firebase.firestore();
    window.fbGoogle = new firebase.auth.GoogleAuthProvider();

    // 7. Загружаем конфиг RISEx
    await loadSystemConfig();

    // 8. onAuthStateChanged
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

            // Регистрируем signer в фоне (не блокируем)
            registerSigner(user.uid).catch(() => {});

            // Загружаем данные
            await fetchBalance();
            fetchPosition().catch(() => {});
            loadStats().catch(() => {});

            // Запускаем стакан и прайс
            startOrderBook(currentMarket);
            startPriceFeed();

            addToLog(t('hotkeys_hint'), 'meta');

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
window.handleAuth      = handleAuth;
window.toggleTheme     = toggleTheme;
window.setLanguage     = setLanguage;
window.handleBuyClick  = handleBuyClick;
window.handleSellClick = handleSellClick;
window.setPct          = setPct;
window.setMode         = setMode;
window.setLeverage     = setLeverage;
window.closePosition   = closePosition;
window.handleDeposit   = handleDeposit;
window.handleWithdraw  = handleWithdraw;
window.copyAddress     = copyAddress;
window.confirmPin      = confirmPin;
window.cancelPin       = cancelPin;
window.showToast       = showToast;
