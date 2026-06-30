// ============================================================
// js/auth.js — GOOGLE AUTH (только для входа в платформу)
// ============================================================

let isLoggedIn  = false;
let currentUser = null;

async function handleAuth() {
    if (!window.fbAuth) {
        addToLog('❌ Firebase not ready, try again in a sec', 'error');
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
    } catch (e) {
        let msg = e.message || 'Sign in error';
        if (e.code === 'auth/popup-blocked')        msg = '❌ Popup blocked';
        if (e.code === 'auth/popup-closed-by-user')  msg = 'ℹ️ Popup closed';
        if (e.code === 'auth/cancelled-popup-request') { btn.disabled = false; return; }
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

    updateAuthUI();
    addToLog(t('logout_done'), 'info');
}

function updateAuthUI() {
    const btn   = document.getElementById('btn-auth');
    const badge = document.getElementById('status-badge');
    if (!btn) return;

    if (isLoggedIn && currentUser) {
        const name = currentUser.displayName || currentUser.email || '';
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
