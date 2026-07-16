// ============================================================
// js/main.js - MAIN ENTRY POINT
// ============================================================

console.log('🚀 PLOV Scalping Terminal v3.0');

let isLoggedIn = false;
let currentUser = null;

// ── Инициализация Firebase ─────────────────────────────────

const firebaseConfig = {
    apiKey: "AIzaSyDn0j_9lZ2o6iN_rM8x3K5pQwL4vJ9hX2k",
    authDomain: "plov-f84e7.firebaseapp.com",
    projectId: "plov-f84e7",
    storageBucket: "plov-f84e7.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ── Auth State Change ──────────────────────────────────────

auth.onAuthStateChanged(async (user) => {
    if (user) {
        isLoggedIn = true;
        currentUser = user;
        console.log('✅ Logged in:', user.email);

        // Создать/загрузить кошелек
        await createOrLoadWallet(user.uid);
        if (!userWallet.address) return;

        // ✅ НОВОЕ: Загрузить статус RISEx подключения
        if (typeof loadRisexStatus === 'function') {
            await loadRisexStatus();
        }

        // Загрузить реальный баланс с правильным адресом
        setTimeout(() => fetchBalance(), 500);

        // Попытка загрузить сохраненный signer
        if (typeof loadSignerFromStorage === 'function') {
            const signerLoaded = loadSignerFromStorage(user.uid);
            if (signerLoaded) {
                addToLog('✅ Signer restored from storage', 'success');
                updateSignerUI();
            }
        }

        // Инициализировать подписку
        if (typeof initSubscription === 'function') {
            initSubscription(user.uid);
        }

        updateBalanceUI();
        showLoginPanel(false);

    } else {
        isLoggedIn = false;
        currentUser = null;
        console.log('⚠️ Logged out');
        showLoginPanel(true);
        addToLog('Please login to start', 'info');
    }
});

// ── Google Sign In ─────────────────────────────────────────

async function googleSignIn() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        console.log('✅ Google Sign In:', result.user.email);
    } catch (error) {
        console.error('Google Sign In error:', error);
        addToLog('Google Sign In failed', 'error');
    }
}

function googleSignOut() {
    auth.signOut().catch(error => {
        console.error('Sign Out error:', error);
    });
}

// ── Login/Logout UI ────────────────────────────────────────

function showLoginPanel(show) {
    const loginPanel = document.getElementById('login-panel');
    const mainPanel = document.getElementById('main-panel');

    if (show) {
        if (loginPanel) loginPanel.style.display = 'flex';
        if (mainPanel) mainPanel.style.display = 'none';
    } else {
        if (loginPanel) loginPanel.style.display = 'none';
        if (mainPanel) mainPanel.style.display = 'flex';
    }
}

// ── Экспорты ───────────────────────────────────────────────

window.isLoggedIn = () => isLoggedIn;
window.currentUser = currentUser;
window.googleSignIn = googleSignIn;
window.googleSignOut = googleSignOut;

// ── Initialize ─────────────────────────────────────────────

console.log('✅ ПЛОВ готов');
