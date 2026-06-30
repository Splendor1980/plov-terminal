// ============================================================
// js/i18n.js — TRANSLATIONS v3.0 (RISEx-only, signer-key based)
// ============================================================

const LANGUAGES = {
    en: {
        status_online:      '● Online',
        status_offline:     '● Offline',
        btn_google:         '🔑 Sign in',
        btn_logout:         '🚪 Logout',

        ob_title:            '📊 Order Book',
        ob_price:            'Price',
        ob_volume:           'Size',
        ob_total:            'Total',
        ob_spread:           'Spread',

        leverage_label:      'Leverage:',
        amount_ph:           'Amount USDC',
        btn_buy:             '📈 LONG',
        btn_sell:             '📉 SHORT',
        btn_buy_sub:         'Open long',
        btn_sell_sub:        'Open short',

        tab_log:             '📋 Log',
        tab_trades:          '⚡ Trades',
        tab_mytrades:        '💼 My Trades',
        col_side:            'Side',
        col_price:           'Price',
        col_size:            'Size',
        col_lev:             'Lev',
        col_pnl:             'PnL',
        col_time:            'Time',
        col_qty:             'Qty',

        signer_title:        '🔑 RISEx API Key',
        signer_hint:         'Connect your RISEx Signer Key to start real trading.',
        btn_get_key:         'Get API Key on rise.trade ↗',
        signer_save:         'Save',
        signer_security_note:'🔒 Stored locally in your browser only. Never sent to our servers.',
        signer_disconnect:   'Disconnect',
        signer_empty:        '⚠️ Please paste your Signer Key',
        signer_invalid:      '❌ Invalid private key format',
        signer_connected_msg:'✅ Signer connected:',
        signer_disconnected_msg: '🔌 Signer disconnected',
        signer_disconnect_confirm: 'Disconnect signer? You will need to re-enter your key.',
        signer_required:     '⚠️ Connect your RISEx Signer Key first',

        balance_title:       '💰 Balance',
        bal_usdc:            'USDC (RISEx)',

        position_title:      '📦 Position',
        pos_side:            'Side',
        pos_size:            'Size',
        pos_entry:           'Entry',
        pos_liq:             'Liquidation',
        pos_pnl:             'PnL',
        btn_close_pos:       '✕ Close position',

        stats_title:         '📊 Statistics',
        stat_trades:         'Trades',
        stat_winrate:        'Winrate',
        stat_volume:         'Volume',
        stat_best:           'Best',
        stat_worst:          'Worst',

        settings_title:      '⚙️ Settings',
        settings_language:   '🌐 Language',
        settings_help:       '❓ Help',

        bubble_title:        '👋 Welcome to PLOV!',
        bubble_p1:           'A focused scalping terminal for RISEx on RISE Chain.',
        bubble_how_title:    '🚀 How to start trading:',
        bubble_step1:        '1. Go to rise.trade → Settings → API Keys',
        bubble_step2:        '2. Create a Signer Key',
        bubble_step3:        '3. Deposit USDC to your RISEx account',
        bubble_step4:        '4. Paste the key into PLOV — start trading',
        bubble_hint:         'Settings available anytime via ⚙️',
        bubble_ok:           'Got it',
        bubble_get_key:      'Get API Key',

        login_required:      '⚠️ Please sign in first',
        copied:              '✅ Copied!',
        welcome:              '✅ Welcome',
        login_start:         '🔑 Click «Sign in» to access your account',
        config_loaded:       '⚙️ RISEx config loaded',
        ws_connected:        '📡 WebSocket connected',
        hotkeys_hint:        '💡 B = LONG, S = SHORT, Esc = reset',
        order_pending:       '🚀 Placing order...',
        order_success:       '✅ Position opened!',
        order_error:         '❌ Order error:',
        close_pending:       '🔄 Closing position...',
        no_pos_close:        '⚠️ No position to close',
        balance_low:         '❌ Insufficient USDC (balance:',
        amount_invalid:      '⚠️ Enter USDC amount',
        logout_confirm:      'Sign out?',
        logout_done:         '👋 Logged out',
        cors_warning:        'ℹ️ Localhost: API unavailable, orderbook will work on Vercel',
    },

    ru: {
        status_online:      '● Онлайн',
        status_offline:     '● Офлайн',
        btn_google:         '🔑 Войти',
        btn_logout:         '🚪 Выйти',

        ob_title:            '📊 Стакан',
        ob_price:            'Цена',
        ob_volume:           'Кол-во',
        ob_total:            'Сумма',
        ob_spread:           'Спред',

        leverage_label:      'Плечо:',
        amount_ph:           'Сумма USDC',
        btn_buy:             '📈 LONG',
        btn_sell:             '📉 SHORT',
        btn_buy_sub:         'Открыть лонг',
        btn_sell_sub:        'Открыть шорт',

        tab_log:             '📋 Лог',
        tab_trades:          '⚡ Сделки',
        tab_mytrades:        '💼 Мои сделки',
        col_side:            'Сторона',
        col_price:           'Цена',
        col_size:            'Размер',
        col_lev:             'Плечо',
        col_pnl:             'PnL',
        col_time:            'Время',
        col_qty:             'Кол-во',

        signer_title:        '🔑 RISEx API ключ',
        signer_hint:         'Подключи свой Signer Key с RISEx для реальной торговли.',
        btn_get_key:         'Получить ключ на rise.trade ↗',
        signer_save:         'Сохранить',
        signer_security_note:'🔒 Хранится только в твоём браузере. Никогда не отправляется на наши сервера.',
        signer_disconnect:   'Отключить',
        signer_empty:        '⚠️ Вставь свой Signer Key',
        signer_invalid:      '❌ Неверный формат приватного ключа',
        signer_connected_msg:'✅ Signer подключён:',
        signer_disconnected_msg: '🔌 Signer отключён',
        signer_disconnect_confirm: 'Отключить signer? Потребуется снова ввести ключ.',
        signer_required:     '⚠️ Сначала подключи RISEx Signer Key',

        balance_title:       '💰 Баланс',
        bal_usdc:            'USDC (RISEx)',

        position_title:      '📦 Позиция',
        pos_side:            'Сторона',
        pos_size:            'Размер',
        pos_entry:           'Вход',
        pos_liq:             'Ликвид.',
        pos_pnl:             'PnL',
        btn_close_pos:       '✕ Закрыть позицию',

        stats_title:         '📊 Статистика',
        stat_trades:         'Сделок',
        stat_winrate:        'Winrate',
        stat_volume:         'Объём',
        stat_best:           'Лучшая',
        stat_worst:          'Худшая',

        settings_title:      '⚙️ Настройки',
        settings_language:   '🌐 Язык',
        settings_help:       '❓ Справка',

        bubble_title:        '👋 Добро пожаловать в ПЛОВ!',
        bubble_p1:           'Сфокусированный терминал скальпинга для RISEx на RISE Chain.',
        bubble_how_title:    '🚀 Как начать торговать:',
        bubble_step1:        '1. Зайди на rise.trade → Settings → API Keys',
        bubble_step2:        '2. Создай Signer Key',
        bubble_step3:        '3. Задепозитируй USDC на свой RISEx аккаунт',
        bubble_step4:        '4. Вставь ключ в ПЛОВ — начинай торговать',
        bubble_hint:         'Настройки доступны в любой момент через ⚙️',
        bubble_ok:           'Понятно',
        bubble_get_key:      'Получить ключ',

        login_required:      '⚠️ Сначала войдите',
        copied:              '✅ Скопировано!',
        welcome:              '✅ Добро пожаловать',
        login_start:         '🔑 Нажмите «Войти» для доступа к аккаунту',
        config_loaded:       '⚙️ Конфиг RISEx загружен',
        ws_connected:        '📡 WebSocket подключён',
        hotkeys_hint:        '💡 B = LONG, S = SHORT, Esc = сброс',
        order_pending:       '🚀 Размещаем ордер...',
        order_success:       '✅ Позиция открыта!',
        order_error:         '❌ Ошибка ордера:',
        close_pending:       '🔄 Закрываем позицию...',
        no_pos_close:        '⚠️ Нет позиции для закрытия',
        balance_low:         '❌ Недостаточно USDC (баланс:',
        amount_invalid:      '⚠️ Введите сумму USDC',
        logout_confirm:      'Выйти из аккаунта?',
        logout_done:         '👋 Вы вышли из аккаунта',
        cors_warning:        'ℹ️ Localhost: API недоступен, стакан откроется на Vercel',
    },

    zh: {
        status_online:      '● 在线',
        status_offline:     '● 离线',
        btn_google:         '🔑 登录',
        btn_logout:         '🚪 退出',

        ob_title:            '📊 订单簿',
        ob_price:            '价格',
        ob_volume:           '数量',
        ob_total:            '总额',
        ob_spread:           '点差',

        leverage_label:      '杠杆:',
        amount_ph:           'USDC 金额',
        btn_buy:             '📈 做多',
        btn_sell:             '📉 做空',
        btn_buy_sub:         '开多头',
        btn_sell_sub:        '开空头',

        tab_log:             '📋 日志',
        tab_trades:          '⚡ 成交',
        tab_mytrades:        '💼 我的交易',
        col_side:            '方向',
        col_price:           '价格',
        col_size:            '规模',
        col_lev:             '杠杆',
        col_pnl:             '盈亏',
        col_time:            '时间',
        col_qty:             '数量',

        signer_title:        '🔑 RISEx API 密钥',
        signer_hint:         '连接您的 RISEx Signer Key 以开始真实交易。',
        btn_get_key:         '在 rise.trade 获取密钥 ↗',
        signer_save:         '保存',
        signer_security_note:'🔒 仅存储在您的浏览器本地，绝不发送至我们的服务器。',
        signer_disconnect:   '断开连接',
        signer_empty:        '⚠️ 请粘贴您的 Signer Key',
        signer_invalid:      '❌ 私钥格式无效',
        signer_connected_msg:'✅ Signer 已连接:',
        signer_disconnected_msg: '🔌 Signer 已断开',
        signer_disconnect_confirm: '断开 signer？需要重新输入密钥。',
        signer_required:     '⚠️ 请先连接 RISEx Signer Key',

        balance_title:       '💰 余额',
        bal_usdc:            'USDC (RISEx)',

        position_title:      '📦 持仓',
        pos_side:            '方向',
        pos_size:            '规模',
        pos_entry:           '入场',
        pos_liq:             '清算价',
        pos_pnl:             '盈亏',
        btn_close_pos:       '✕ 平仓',

        stats_title:         '📊 统计',
        stat_trades:         '交易次',
        stat_winrate:        '胜率',
        stat_volume:         '交易量',
        stat_best:           '最佳',
        stat_worst:          '最差',

        settings_title:      '⚙️ 设置',
        settings_language:   '🌐 语言',
        settings_help:       '❓ 帮助',

        bubble_title:        '👋 欢迎使用 PLOV！',
        bubble_p1:           '专注于 RISE Chain 上 RISEx 的剥头皮交易终端。',
        bubble_how_title:    '🚀 如何开始交易:',
        bubble_step1:        '1. 前往 rise.trade → 设置 → API 密钥',
        bubble_step2:        '2. 创建 Signer Key',
        bubble_step3:        '3. 向您的 RISEx 账户充值 USDC',
        bubble_step4:        '4. 将密钥粘贴到 PLOV — 开始交易',
        bubble_hint:         '设置随时可通过 ⚙️ 访问',
        bubble_ok:           '明白了',
        bubble_get_key:      '获取密钥',

        login_required:      '⚠️ 请先登录',
        copied:              '✅ 已复制！',
        welcome:              '✅ 欢迎',
        login_start:         '🔑 点击「登录」访问您的账户',
        config_loaded:       '⚙️ RISEx 配置已加载',
        ws_connected:        '📡 WebSocket 已连接',
        hotkeys_hint:        '💡 B = 做多, S = 做空, Esc = 重置',
        order_pending:       '🚀 下单中...',
        order_success:       '✅ 持仓已开！',
        order_error:         '❌ 订单错误:',
        close_pending:       '🔄 平仓中...',
        no_pos_close:        '⚠️ 无持仓可平',
        balance_low:         '❌ USDC 余额不足（余额:',
        amount_invalid:      '⚠️ 输入 USDC 金额',
        logout_confirm:      '退出账户？',
        logout_done:         '👋 已退出',
        cors_warning:        'ℹ️ 本地环境：API 不可用，订单簿将在 Vercel 上运行',
    }
};

function t(key) {
    const lang = (typeof currentLang !== 'undefined' ? currentLang : null) || 'en';
    return (LANGUAGES[lang] || LANGUAGES.en)[key] || `[${key}]`;
}

function setLanguage(lang) {
    if (!LANGUAGES[lang]) return;
    currentLang = lang;
    localStorage.setItem('plov_lang', lang);
    document.documentElement.lang = lang;

    document.querySelectorAll('.lang-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.lang === lang));

    // Status / auth button
    const status = document.getElementById('status-badge');
    if (status) {
        const online = typeof isLoggedIn !== 'undefined' && isLoggedIn;
        status.textContent = online ? t('status_online') : t('status_offline');
        status.className   = 'status-badge ' + (online ? 'online' : 'offline');
    }
    const authBtn = document.getElementById('btn-auth');
    if (authBtn) {
        if (typeof isLoggedIn !== 'undefined' && isLoggedIn && typeof currentUser !== 'undefined' && currentUser) {
            authBtn.textContent = t('btn_logout') + ' ' + (currentUser.displayName||'').slice(0,12);
            authBtn.className   = 'btn-auth logout';
        } else {
            authBtn.textContent = t('btn_google');
            authBtn.className   = 'btn-auth';
        }
    }

    // Order book
    const set = (id, key) => { const el = document.getElementById(id); if (el) el.textContent = t(key); };
    set('ob-price-label', 'ob_price');
    set('ob-vol-label',   'ob_volume');
    set('ob-total-label', 'ob_total');
    set('spread-label',   'ob_spread');
    const obTitle = document.getElementById('ob-panel-title');
    if (obTitle) obTitle.innerHTML = t('ob_title') + ' <span class="badge-live" id="ob-live">LIVE</span>';

    // Leverage
    const levLabel = document.getElementById('lev-label-text');
    if (levLabel) levLabel.textContent = t('leverage_label');

    // Amount
    const inp = document.getElementById('amount-input');
    if (inp) inp.placeholder = t('amount_ph');

    // Buy/sell
    const buyLabel  = document.querySelector('#btn-buy .btn-label');
    const sellLabel = document.querySelector('#btn-sell .btn-label');
    const buySub    = document.getElementById('buy-sub');
    const sellSub   = document.getElementById('sell-sub');
    if (buyLabel)  buyLabel.textContent  = t('btn_buy');
    if (sellLabel) sellLabel.textContent = t('btn_sell');
    if (buySub)    buySub.textContent    = t('btn_buy_sub');
    if (sellSub)   sellSub.textContent   = t('btn_sell_sub');

    // Hotkeys
    const hotkeys = document.getElementById('hotkeys-text');
    if (hotkeys) {
        const resetWord = lang === 'zh' ? '重置' : lang === 'ru' ? 'Сброс' : 'Reset';
        hotkeys.innerHTML = `<kbd>B</kbd> LONG &nbsp; <kbd>S</kbd> SHORT &nbsp; <kbd>Esc</kbd> ${resetWord}`;
    }

    // Tabs
    set('tab-log',      'tab_log');
    set('tab-trades',   'tab_trades');
    set('tab-mytrades', 'tab_mytrades');

    const myTradesHeaders = document.querySelectorAll('#pane-mytrades .my-trades-header-inline span');
    const myKeys = ['col_side','col_price','col_size','col_lev','col_pnl','col_time'];
    myTradesHeaders.forEach((el,i) => { if (myKeys[i]) el.textContent = t(myKeys[i]); });

    const tradesHeaders = document.querySelectorAll('#pane-trades .my-trades-header-inline span');
    const tradeKeys = ['col_price','col_qty','col_time'];
    tradesHeaders.forEach((el,i) => { if (tradeKeys[i]) el.textContent = t(tradeKeys[i]); });

    // Signer section
    set('signer-title',         'signer_title');
    set('signer-hint-text',     'signer_hint');
    set('btn-rise-api-text',    'btn_get_key');
    set('btn-save-signer',      'signer_save');
    set('signer-security-note', 'signer_security_note');
    set('btn-disconnect-signer','signer_disconnect');

    // Balance
    set('balance-title',  'balance_title');
    set('bal-label-usdc', 'bal_usdc');

    // Position
    set('position-title',   'position_title');
    set('pos-label-side',   'pos_side');
    set('pos-label-size',   'pos_size');
    set('pos-label-entry',  'pos_entry');
    set('pos-label-liq',    'pos_liq');
    set('pos-label-pnl',    'pos_pnl');
    set('btn-close-pos',    'btn_close_pos');

    // Stats
    set('stats-title',        'stats_title');
    set('stat-label-trades',  'stat_trades');
    set('stat-label-winrate', 'stat_winrate');
    set('stat-label-volume',  'stat_volume');
    set('stat-label-best',    'stat_best');
    set('stat-label-worst',   'stat_worst');

    // Settings panel
    const settingsTitle = document.querySelector('#settings-panel .settings-title');
    if (settingsTitle) settingsTitle.textContent = t('settings_title');
    const langLabel = document.querySelector('.settings-language .security-section-title');
    if (langLabel) langLabel.textContent = t('settings_language');
    const helpBtn = document.getElementById('btn-show-bubble');
    if (helpBtn) helpBtn.textContent = t('settings_help');

    if (typeof updateBubbleText === 'function' &&
        document.getElementById('welcome-bubble')?.classList.contains('visible')) {
        updateBubbleText();
    }
}

function loadLanguage() {
    const saved = localStorage.getItem('plov_lang');
    currentLang = (saved && LANGUAGES[saved]) ? saved : 'en';
}

window.setLanguage  = setLanguage;
window.loadLanguage = loadLanguage;
window.t            = t;
console.log('%ci18n loaded (v3.0)', 'color:#00ff9d');
