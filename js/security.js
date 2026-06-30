// ============================================================
// js/security.js — SETTINGS PANEL + WELCOME BUBBLE
// (renamed conceptually, kept filename for compatibility)
// ============================================================

function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;
    panel.classList.contains('open') ? closeSettings() : openSettings();
}

function openSettings() {
    document.getElementById('settings-panel')?.classList.add('open');
    hideBubble();
}

function closeSettings() {
    document.getElementById('settings-panel')?.classList.remove('open');
}

document.addEventListener('click', e => {
    const panel = document.getElementById('settings-panel');
    const gear  = document.getElementById('btn-settings');
    if (panel?.classList.contains('open') && !panel.contains(e.target) && e.target !== gear) {
        closeSettings();
    }
});

// ── Welcome bubble ───────────────────────────────────────────

function showWelcomeBubble() {
    if (localStorage.getItem('plov_bubble_shown')) return;
    const bubble = document.getElementById('welcome-bubble');
    if (!bubble) return;
    updateBubbleText();
    setTimeout(() => bubble.classList.add('visible'), 1200);
}

function updateBubbleText() {
    const bubble = document.getElementById('welcome-bubble');
    if (!bubble) return;
    bubble.innerHTML = `
        <div class="bubble-title">${t('bubble_title')}</div>
        <div class="bubble-body">
            <p>${t('bubble_p1')}</p>
            <div class="bubble-howto">
                <div class="bubble-howto-title">${t('bubble_how_title')}</div>
                <div class="bubble-step">${t('bubble_step1')}</div>
                <div class="bubble-step">${t('bubble_step2')}</div>
                <div class="bubble-step">${t('bubble_step3')}</div>
                <div class="bubble-step">${t('bubble_step4')}</div>
            </div>
            <p class="bubble-hint">${t('bubble_hint')}</p>
        </div>
        <div class="bubble-actions">
            <button class="bubble-btn-ok" onclick="dismissBubble()">${t('bubble_ok')}</button>
            <button class="bubble-btn-settings" onclick="openRiseApiPage();dismissBubble()">${t('bubble_get_key')}</button>
        </div>
        <div class="bubble-arrow"></div>
    `;
}

function showBubbleManual() {
    const bubble = document.getElementById('welcome-bubble');
    if (!bubble) return;
    updateBubbleText();
    bubble.classList.add('visible');
    closeSettings();
}

function hideBubble() {
    document.getElementById('welcome-bubble')?.classList.remove('visible');
}

function dismissBubble() {
    hideBubble();
    localStorage.setItem('plov_bubble_shown', '1');
}

window.toggleSettings    = toggleSettings;
window.openSettings      = openSettings;
window.closeSettings     = closeSettings;
window.showWelcomeBubble = showWelcomeBubble;
window.showBubbleManual  = showBubbleManual;
window.hideBubble        = hideBubble;
window.dismissBubble     = dismissBubble;
console.log('%cSettings/Bubble loaded', 'color:#00ff9d');
