// ============================================================
// js/wallet.js — BALANCE (через Signer Key, не свой кошелёк)
// ============================================================

let userBalance = 0;

async function fetchBalance() {
    if (!isSignerReady()) return;

    try {
        const res = await fetch(
            `${RISEX_API.rest}/v1/account/cross-margin-balance?account=${signerAddress}`
        );
        if (!res.ok) {
            console.log('balance status:', res.status);
            return;
        }
        const data = await res.json();
        const d    = data.data || data;
        const raw  = d.balance ?? d.free ?? d.equity ?? d.available;
        if (raw !== undefined) {
            const val = parseFloat(raw);
            userBalance = val > 1e15 ? val / 1e18 : val;
        }
    } catch (e) {
        console.warn('fetchBalance error:', e.message);
    }
    updateBalanceUI();
}

function updateBalanceUI() {
    const el = document.getElementById('bal-risex');
    if (el) el.textContent = (userBalance || 0).toFixed(2);
}

window.fetchBalance    = fetchBalance;
window.updateBalanceUI = updateBalanceUI;
console.log('%cWallet (balance) loaded', 'color:#00ff9d');
