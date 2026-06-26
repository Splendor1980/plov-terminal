// ============================================================
// js/security.js — НАСТРОЙКИ БЕЗОПАСНОСТИ + ШЕСТЕРЁНКА
// ============================================================

const SECURITY_MODES = { SIMPLE: 'simple', ADVANCED: 'advanced' };
let securityMode = SECURITY_MODES.SIMPLE;
let deviceId     = null;

function initSecurity() {
    securityMode = localStorage.getItem('plov_security') || SECURITY_MODES.SIMPLE;
    deviceId     = localStorage.getItem('plov_device_id');
    if (!deviceId) {
        deviceId = (crypto.randomUUID ? crypto.randomUUID()
                  : Math.random().toString(36).slice(2) + Date.now());
        localStorage.setItem('plov_device_id', deviceId);
    }
    updateSecurityUI();
}

function setSecurityMode(mode) {
    securityMode = mode;
    localStorage.setItem('plov_security', mode);
    updateSecurityUI();
    closeSettings();
    if (mode === SECURITY_MODES.ADVANCED) {
        addToLog(t('sec_advanced_on'), 'success');
    } else {
        addToLog(t('sec_simple_on'), 'meta');
    }
}

function updateSecurityUI() {
    document.getElementById('sec-simple')  ?.classList.toggle('active', securityMode === SECURITY_MODES.SIMPLE);
    document.getElementById('sec-advanced')?.classList.toggle('active', securityMode === SECURITY_MODES.ADVANCED);
    const label = document.getElementById('security-mode-label');
    if (label) {
        label.textContent = securityMode === SECURITY_MODES.SIMPLE
            ? '🔓 ' + t('sec_simple_label')
            : '🔐 ' + t('sec_advanced_label');
        label.className = 'security-mode-label ' + securityMode;
    }
}

// ── Шестерёнка ───────────────────────────────────────────────

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

// ── Речевой пузырь ───────────────────────────────────────────

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
            <p>${t('bubble_p2')}</p>
            <div class="bubble-security">
                <div class="bubble-sec-opt">
                    <strong>🔓 ${t('sec_simple_label')}</strong>
                    <span>${t('bubble_simple_desc')}</span>
                </div>
                <div class="bubble-sec-opt">
                    <strong>🔐 ${t('sec_advanced_label')}</strong>
                    <span>${t('bubble_advanced_desc')}</span>
                </div>
            </div>
            <p class="bubble-hint">${t('bubble_hint')}</p>
        </div>
        <div class="bubble-actions">
            <button class="bubble-btn-ok" onclick="dismissBubble()">${t('bubble_ok')}</button>
            <button class="bubble-btn-settings" onclick="dismissAndOpenSettings()">${t('bubble_settings')}</button>
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

function dismissAndOpenSettings() {
    hideBubble();
    localStorage.setItem('plov_bubble_shown', '1');
    setTimeout(openSettings, 200);
}

// ── Новое устройство (только Advanced) ──────────────────────

function isNewDevice(uid) {
    if (securityMode !== SECURITY_MODES.ADVANCED) return false;
    return localStorage.getItem(`plov_device_${uid}`) !== deviceId;
}

function markDeviceTrusted(uid) {
    localStorage.setItem(`plov_device_${uid}`, deviceId);
}

window.initSecurity           = initSecurity;
window.setSecurityMode        = setSecurityMode;
window.toggleSettings         = toggleSettings;
window.openSettings           = openSettings;
window.closeSettings          = closeSettings;
window.showWelcomeBubble      = showWelcomeBubble;
window.showBubbleManual       = showBubbleManual;
window.hideBubble             = hideBubble;
window.dismissBubble          = dismissBubble;
window.dismissAndOpenSettings = dismissAndOpenSettings;
window.isNewDevice            = isNewDevice;
window.markDeviceTrusted      = markDeviceTrusted;
window.SECURITY_MODES         = SECURITY_MODES;
console.log('%cSecurity loaded', 'color:#00ff9d');
