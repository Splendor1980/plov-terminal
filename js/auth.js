// ============================================================
// js/auth.js — FIREBASE INIT + GOOGLE AUTH + POST-LOGIN BOOTSTRAP
// ============================================================
// Единственное место, где инициализируется Firebase и объявляются
// isLoggedIn / currentUser. Раньше это дублировалось в main.js
// с ДРУГИМ (фейковым) firebaseConfig, что вызывало
// SyntaxError: Identifier 'isLoggedIn'/'currentUser'/'firebaseConfig'
// has already been declared — из-за чего main.js вообще не выполнялся.
// ============================================================

let isLoggedIn  = false;
let currentUser = null;

// firebaseConfig объявлен в js/config.js (грузится раньше)
if (!firebase.apps.length) {
    firebase.initializeApp(window.firebaseConfig);
}
const fbAuth = firebase.auth();
const db     = firebase.firestore();
window.fbAuth = fbAuth;
window.db     = db;

// ── Вход через Google ───────────────────────────────────────

async function handleAuth() {
    if (isLoggedIn) {
        if (confirm(t('logout_confirm'))) await doLogout();
        return;
    }

    const btn = document.getElementById('btn-auth');
    try {
        if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
        const provider = new firebase.auth.GoogleAuthProvider();
        await fbAuth.signInWithPopup(provider);
        // Дальше всё происходит в onAuthStateChanged ниже
    } catch (e) {
        let msg = e.message || 'Sign in error';
        if (e.code === 'auth/popup-blocked')        msg = '❌ Popup blocked by browser';
        if (e.code === 'auth/popup-closed-by-user') msg = 'ℹ️ Popup closed';
        if (e.code === 'auth/cancelled-popup-request') { if (btn) btn.disabled = false; return; }
        addToLog(msg, 'error');
    } finally {
        if (btn) btn.disabled = false;
        updateAuthUI();
    }
}

async function doLogout() {
    try { await fbAuth.signOut(); } catch {}
    // isLoggedIn/currentUser сбрасываются в onAuthStateChanged(null)
}

// ── Единая точка входа после логина/логаута ─────────────────
// Раньше эта логика лежала в main.js, но main.js никогда не
// выполнялся из-за SyntaxError выше — то есть кошелёк, баланс,
// signer, ордербук, подписка НИКОГДА не инициализировались.

fbAuth.onAuthStateChanged(async (user) => {
    if (user) {
        isLoggedIn  = true;
        currentUser = user;
        console.log('✅ Logged in:', user.email);
        updateAuthUI();
        showLoginPanel(false);

        // Кошелёк (Simple/Advanced режим)
        await createOrLoadWallet(user.uid);

        // Восстановить Signer Key из localStorage, если был сохранён
        if (typeof loadSignerFromStorage === 'function') {
            const restored = await loadSignerFromStorage(user.uid);
            if (restored) {
                addToLog('✅ Signer restored from storage', 'success');
                // Регистрируем signer на RISEx (не блокирует UI при ошибке)
                if (typeof registerSigner === 'function') {
                    registerSigner(user.uid).catch(() => {});
                }
            }
        }

        // Баланс, позиция, история, статистика
        setTimeout(() => fetchBalance(), 500);
        if (typeof loadRealPosition   === 'function') loadRealPosition();
        if (typeof loadStats          === 'function') loadStats();
        if (typeof loadMyTrades       === 'function') loadMyTrades();

        // Подписка
        if (typeof initSubscription === 'function') initSubscription(user.uid);
        if (typeof updateTpSlPanel  === 'function') updateTpSlPanel();

    } else {
        isLoggedIn  = false;
        currentUser = null;
        console.log('⚠️ Logged out');
        updateAuthUI();
        showLoginPanel(true);
        addToLog('Please login to start', 'info');
    }
});

// ── UI ───────────────────────────────────────────────────────

function updateAuthUI() {
    const btn   = document.getElementById('btn-auth');
    const badge = document.getElementById('status-badge');
    if (!btn) return;

    if (isLoggedIn && currentUser) {
        const name = currentUser.displayName || currentUser.email || '';
        btn.textContent = t('btn_logout') + ' ' + name.slice(0, 12);
        btn.className   = 'btn-auth logout';
        btn.disabled    = false;
        if (badge) { badge.textContent = t('status_online'); badge.className = 'status-badge online'; }
    } else {
        btn.textContent = t('btn_google');
        btn.className   = 'btn-auth';
        btn.disabled    = false;
        if (badge) { badge.textContent = t('status_offline'); badge.className = 'status-badge offline'; }
    }
}

function showLoginPanel(show) {
    const loginPanel = document.getElementById('login-panel');
    const mainPanel   = document.getElementById('main-panel');
    if (show) {
        if (loginPanel) loginPanel.style.display = 'flex';
        if (mainPanel)  mainPanel.style.display  = 'none';
    } else {
        if (loginPanel) loginPanel.style.display = 'none';
        if (mainPanel)  mainPanel.style.display  = 'flex';
    }
}

window.handleAuth     = handleAuth;
window.doLogout       = doLogout;
window.updateAuthUI   = updateAuthUI;
window.showLoginPanel = showLoginPanel;
console.log('%cAuth loaded', 'color:#00ff9d');
