// ============================================================
// js/i18n.js — ПОЛНЫЕ ПЕРЕВОДЫ включая лог и безопасность
// ============================================================

const LANGUAGES = {
    ru: {
        // Статус
        status_online:       '● Онлайн',
        status_offline:      '● Офлайн',
        btn_google:          '🔑 Войти через Google',
        btn_logout:          '🚪 Выйти',
        // Стакан
        orderbook_title:     '📊 Стакан',
        ob_price:            'Цена',
        ob_volume:           'Кол-во',
        ob_total:            'Сумма',
        ob_spread:           'Спред',
        trades_title:        '⚡ Сделки',
        trades_time:         'Время',
        // Торговля
        perp_mode:           'Перп · RISEx',
        spot_mode:           'Спот · Helios',
        leverage_label:      'Плечо:',
        amount_ph:           'Сумма USDC',
        btn_buy:             '📈 LONG',
        btn_sell:            '📉 SHORT',
        btn_buy_spot:        '📈 BUY',
        btn_sell_spot:       '📉 SELL',
        btn_buy_sub:         'Открыть лонг',
        btn_sell_sub:        'Открыть шорт',
        btn_buy_spot_sub:    'Купить BTC',
        btn_sell_spot_sub:   'Продать BTC',
        log_title:           '📋 Лог',
        // Кошелёк
        wallet_title:        '💼 Кошелёк',
        bal_usdc:            'USDC',
        bal_wbtc:            'WBTC',
        bal_risex:           'RISEx',
        btn_deposit:         '↓ Депозит',
        btn_withdraw:        '↑ Вывод',
        // Позиция
        position_title:      '📦 Позиция',
        pos_side:            'Сторона',
        pos_size:            'Размер',
        pos_entry:           'Вход',
        pos_liq:             'Ликвид.',
        pos_pnl:             'PnL',
        btn_close_pos:       '✕ Закрыть позицию',
        // Статистика
        stats_title:         '📊 Статистика',
        stat_trades:         'Сделок',
        stat_winrate:        'Winrate',
        stat_volume:         'Объём',
        stat_best:           'Лучшая',
        stat_worst:          'Худшая',
        // Безопасность
        settings_title:      '⚙️ Настройки',
        security_title:      '🔒 Безопасность',
        sec_simple_label:    'Минимальная',
        sec_advanced_label:  'Максимальная',
        sec_simple_desc:     'Вход без PIN. Ключ хранится в браузере.',
        sec_advanced_desc:   'PIN-код + защита при входе с нового устройства.',
        sec_simple_on:       '✅ Минимальная безопасность — вход без PIN',
        sec_advanced_on:     '🔐 Максимальная безопасность включена',
        settings_language:   '🌐 Язык',
        settings_help:       '❓ Справка',
        // Пузырь
        bubble_title:        '👋 Добро пожаловать в ПЛОВ!',
        bubble_p1:           'Ваш кошелёк создан автоматически. Вы уже можете торговать.',
        bubble_p2:           'Выберите уровень безопасности:',
        bubble_simple_desc:  'Войди и торгуй сразу. Подходит для небольших сумм.',
        bubble_advanced_desc:'PIN-код при каждой подписи. Для серьёзных средств.',
        bubble_hint:         'Настройки доступны в любой момент через ⚙️',
        bubble_ok:           'Понятно',
        bubble_settings:     'Настроить',
        // Лог — все сообщения
        login_required:      '⚠️ Сначала войдите через Google',
        copied:              '✅ Адрес скопирован!',
        welcome:             '✅ Добро пожаловать',
        login_start:         '🔑 Нажмите «Войти через Google» для начала',
        faucet_loading:      '🚰 Начисляем стартовый баланс...',
        faucet_received:     '🎁 На ваш счёт зачислено 1000 USDC',
        faucet_used:         'ℹ️ Стартовый баланс уже начислен',
        faucet_mock:         '💰 Виртуальный баланс: 1000 USDC',
        wallet_loaded:       '🔑 Кошелёк загружен',
        wallet_created:      '🎉 Новый кошелёк создан',
        pin_title:           '🔐 Придумайте PIN (мин. 4 символа)',
        pin_confirm:         '🔐 Повторите PIN',
        pin_error_match:     '❌ PIN не совпадает',
        pin_min:             'Минимум 4 символа',
        pin_unlock:          '🔐 Введите PIN для подписи',
        pin_wrong:           '❌ Неверный PIN',
        pin_not_set:         '❌ PIN не задан',
        config_loaded:       '⚙️ Конфиг RISEx загружен',
        signer_reg:          '🔐 Регистрируем кошелёк в RISEx...',
        signer_ok:           '✅ Кошелёк зарегистрирован в RISEx',
        ws_connected:        '📡 WebSocket подключён',
        hotkeys_hint:        '💡 B = LONG, S = SHORT, Esc = сброс',
        order_pending:       '🚀 Размещаем ордер...',
        order_success:       '✅ Позиция открыта!',
        order_error:         '❌ Ошибка ордера:',
        close_pending:       '🔄 Закрываем позицию...',
        no_pos_close:        '⚠️ Нет позиции для закрытия',
        balance_low:         '❌ Недостаточно USDC (баланс:',
        amount_invalid:      '⚠️ Введите сумму USDC',
        withdraw_to:         'Адрес получателя (0x...):',
        withdraw_amount:     'Сумма USDC:',
        withdraw_confirm:    'Вывести USDC?',
        withdraw_pending:    '⏳ Отправляем транзакцию...',
        withdraw_success:    '✅ Выведено',
        withdraw_no_addr:    '❌ Нет адреса USDC контракта',
        no_funds:            '⚠️ Нет средств для вывода',
        addr_invalid:        '❌ Неверный адрес',
        tx_pending:          '📡 TX:',
        tx_explorer:         '🔗 Смотреть в Explorer',
        logout_confirm:      'Выйти из аккаунта?',
        tab_log:             '📋 Лог',
        tab_trades:          '⚡ Сделки',
        tab_mytrades:        '💼 Мои сделки',
        logout_done:         '👋 Вы вышли из аккаунта',
        cors_warning:        'ℹ️ Localhost: API недоступен, стакан откроется на Vercel',
        new_device_warning:  '⚠️ Вход с нового устройства — проверьте настройки безопасности',
    },

    en: {
        status_online:       '● Online',
        status_offline:      '● Offline',
        btn_google:          '🔑 Sign in with Google',
        btn_logout:          '🚪 Logout',
        orderbook_title:     '📊 Order Book',
        ob_price:            'Price',
        ob_volume:           'Size',
        ob_total:            'Total',
        ob_spread:           'Spread',
        trades_title:        '⚡ Trades',
        trades_time:         'Time',
        perp_mode:           'Perp · RISEx',
        spot_mode:           'Spot · Helios',
        leverage_label:      'Leverage:',
        amount_ph:           'Amount USDC',
        btn_buy:             '📈 LONG',
        btn_sell:            '📉 SHORT',
        btn_buy_spot:        '📈 BUY',
        btn_sell_spot:       '📉 SELL',
        btn_buy_sub:         'Open long',
        btn_sell_sub:        'Open short',
        btn_buy_spot_sub:    'Buy BTC',
        btn_sell_spot_sub:   'Sell BTC',
        log_title:           '📋 Log',
        wallet_title:        '💼 Wallet',
        bal_usdc:            'USDC',
        bal_wbtc:            'WBTC',
        bal_risex:           'RISEx',
        btn_deposit:         '↓ Deposit',
        btn_withdraw:        '↑ Withdraw',
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
        security_title:      '🔒 Security',
        sec_simple_label:    'Basic',
        sec_advanced_label:  'Advanced',
        sec_simple_desc:     'No PIN required. Key stored in browser.',
        sec_advanced_desc:   'PIN on every signature. New device protection.',
        sec_simple_on:       '✅ Basic security — no PIN required',
        sec_advanced_on:     '🔐 Advanced security enabled',
        settings_language:   '🌐 Language',
        settings_help:       '❓ Help',
        bubble_title:        '👋 Welcome to PLOV!',
        bubble_p1:           'Your wallet was created automatically. You can start trading now.',
        bubble_p2:           'Choose your security level:',
        bubble_simple_desc:  'Sign in and trade instantly. Good for small amounts.',
        bubble_advanced_desc:'PIN on every transaction. For serious funds.',
        bubble_hint:         'Settings available anytime via ⚙️',
        bubble_ok:           'Got it',
        bubble_settings:     'Configure',
        login_required:      '⚠️ Please sign in with Google first',
        copied:              '✅ Address copied!',
        welcome:             '✅ Welcome',
        login_start:         '🔑 Click «Sign in with Google» to start',
        faucet_loading:      '🚰 Adding starting balance...',
        faucet_received:     '🎁 1000 USDC added to your account',
        faucet_used:         'ℹ️ Starting balance already credited',
        faucet_mock:         '💰 Virtual balance: 1000 USDC',
        wallet_loaded:       '🔑 Wallet loaded',
        wallet_created:      '🎉 New wallet created',
        pin_title:           '🔐 Set PIN (min. 4 characters)',
        pin_confirm:         '🔐 Repeat PIN',
        pin_error_match:     '❌ PINs do not match',
        pin_min:             'Minimum 4 characters',
        pin_unlock:          '🔐 Enter PIN to sign',
        pin_wrong:           '❌ Wrong PIN',
        pin_not_set:         '❌ PIN not set',
        config_loaded:       '⚙️ RISEx config loaded',
        signer_reg:          '🔐 Registering wallet in RISEx...',
        signer_ok:           '✅ Wallet registered in RISEx',
        ws_connected:        '📡 WebSocket connected',
        hotkeys_hint:        '💡 B = LONG, S = SHORT, Esc = reset',
        order_pending:       '🚀 Placing order...',
        order_success:       '✅ Position opened!',
        order_error:         '❌ Order error:',
        close_pending:       '🔄 Closing position...',
        no_pos_close:        '⚠️ No position to close',
        balance_low:         '❌ Insufficient USDC (balance:',
        amount_invalid:      '⚠️ Enter USDC amount',
        withdraw_to:         'Recipient address (0x...):',
        withdraw_amount:     'Amount USDC:',
        withdraw_confirm:    'Withdraw USDC?',
        withdraw_pending:    '⏳ Sending transaction...',
        withdraw_success:    '✅ Withdrawn',
        withdraw_no_addr:    '❌ USDC contract address not loaded',
        no_funds:            '⚠️ No funds to withdraw',
        addr_invalid:        '❌ Invalid address',
        tx_pending:          '📡 TX:',
        tx_explorer:         '🔗 View in Explorer',
        logout_confirm:      'Sign out?',
        tab_log:             '📋 Log',
        tab_trades:          '⚡ Trades',
        tab_mytrades:        '💼 My trades',
        logout_done:         '👋 Logged out',
        cors_warning:        'ℹ️ Localhost: API unavailable, orderbook will work on Vercel',
        new_device_warning:  '⚠️ New device detected — check security settings',
    },

    zh: {
        status_online:       '● 在线',
        status_offline:      '● 离线',
        btn_google:          '🔑 谷歌登录',
        btn_logout:          '🚪 退出',
        orderbook_title:     '📊 订单簿',
        ob_price:            '价格',
        ob_volume:           '数量',
        ob_total:            '总额',
        ob_spread:           '点差',
        trades_title:        '⚡ 成交',
        trades_time:         '时间',
        perp_mode:           '永续 · RISEx',
        spot_mode:           '现货 · Helios',
        leverage_label:      '杠杆:',
        amount_ph:           'USDC 金额',
        btn_buy:             '📈 做多',
        btn_sell:            '📉 做空',
        btn_buy_spot:        '📈 买入',
        btn_sell_spot:       '📉 卖出',
        btn_buy_sub:         '开多头',
        btn_sell_sub:        '开空头',
        btn_buy_spot_sub:    '买入 BTC',
        btn_sell_spot_sub:   '卖出 BTC',
        log_title:           '📋 日志',
        wallet_title:        '💼 钱包',
        bal_usdc:            'USDC',
        bal_wbtc:            'WBTC',
        bal_risex:           'RISEx',
        btn_deposit:         '↓ 充值',
        btn_withdraw:        '↑ 提现',
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
        security_title:      '🔒 安全',
        sec_simple_label:    '基础',
        sec_advanced_label:  '高级',
        sec_simple_desc:     '无需 PIN。密钥存储在浏览器中。',
        sec_advanced_desc:   '每次签名需要 PIN。新设备保护。',
        sec_simple_on:       '✅ 基础安全 — 无需 PIN',
        sec_advanced_on:     '🔐 高级安全已启用',
        settings_language:   '🌐 语言',
        settings_help:       '❓ 帮助',
        bubble_title:        '👋 欢迎使用 ПЛОВ！',
        bubble_p1:           '您的钱包已自动创建。您现在可以开始交易。',
        bubble_p2:           '请选择安全级别：',
        bubble_simple_desc:  '登录即可交易。适合小额资金。',
        bubble_advanced_desc:'每次签名需要 PIN。适合大额资金。',
        bubble_hint:         '设置随时可通过 ⚙️ 访问',
        bubble_ok:           '明白了',
        bubble_settings:     '去设置',
        login_required:      '⚠️ 请先通过谷歌登录',
        copied:              '✅ 地址已复制！',
        welcome:             '✅ 欢迎',
        login_start:         '🔑 点击「谷歌登录」开始',
        faucet_loading:      '🚰 添加起始余额...',
        faucet_received:     '🎁 1000 USDC 已存入您的账户',
        faucet_used:         'ℹ️ 起始余额已发放',
        faucet_mock:         '💰 虚拟余额：1000 USDC',
        wallet_loaded:       '🔑 钱包已加载',
        wallet_created:      '🎉 新钱包已创建',
        pin_title:           '🔐 设置 PIN（最少 4 位）',
        pin_confirm:         '🔐 确认 PIN',
        pin_error_match:     '❌ PIN 不匹配',
        pin_min:             '最少 4 个字符',
        pin_unlock:          '🔐 输入 PIN 签名',
        pin_wrong:           '❌ PIN 错误',
        pin_not_set:         '❌ 未设置 PIN',
        config_loaded:       '⚙️ RISEx 配置已加载',
        signer_reg:          '🔐 在 RISEx 注册钱包...',
        signer_ok:           '✅ 钱包已在 RISEx 注册',
        ws_connected:        '📡 WebSocket 已连接',
        hotkeys_hint:        '💡 B = 做多, S = 做空, Esc = 重置',
        order_pending:       '🚀 下单中...',
        order_success:       '✅ 持仓已开！',
        order_error:         '❌ 订单错误:',
        close_pending:       '🔄 平仓中...',
        no_pos_close:        '⚠️ 无持仓可平',
        balance_low:         '❌ USDC 余额不足（余额:',
        amount_invalid:      '⚠️ 输入 USDC 金额',
        withdraw_to:         '收款地址 (0x...):',
        withdraw_amount:     'USDC 金额:',
        withdraw_confirm:    '提现 USDC？',
        withdraw_pending:    '⏳ 发送交易中...',
        withdraw_success:    '✅ 已提现',
        withdraw_no_addr:    '❌ USDC 合约地址未加载',
        no_funds:            '⚠️ 没有可提现的资金',
        addr_invalid:        '❌ 地址无效',
        tx_pending:          '📡 TX:',
        tx_explorer:         '🔗 在浏览器中查看',
        logout_confirm:      '退出账户？',
        tab_log:             '📋 日志',
        tab_trades:          '⚡ 成交',
        tab_mytrades:        '💼 我的交易',
        logout_done:         '👋 已退出',
        cors_warning:        'ℹ️ 本地环境：API 不可用，订单簿将在 Vercel 上运行',
        new_device_warning:  '⚠️ 检测到新设备 — 请检查安全设置',
    }
};

function t(key) {
    const lang = (typeof currentLang !== 'undefined' ? currentLang : null) || 'ru';
    return (LANGUAGES[lang] || LANGUAGES.ru)[key] || `[${key}]`;
}

function setLanguage(lang) {
    if (!LANGUAGES[lang]) return;
    currentLang = lang;
    localStorage.setItem('plov_lang', lang);

    document.querySelectorAll('.lang-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.lang === lang));

    // Top bar
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

    // Стакан
    const obPL = document.getElementById('ob-price-label');
    const obVL = document.getElementById('ob-vol-label');
    const obTL = document.getElementById('ob-total-label');
    const spL  = document.getElementById('spread-label');
    const tPL  = document.getElementById('t-price-label');
    const tVL  = document.getElementById('t-vol-label');
    const tTL  = document.getElementById('t-time-label');
    if (obPL) obPL.textContent = t('ob_price');
    if (obVL) obVL.textContent = t('ob_volume');
    if (obTL) obTL.textContent = t('ob_total');
    if (spL)  spL.textContent  = t('ob_spread') + ': ';
    if (tPL)  tPL.textContent  = t('ob_price');
    if (tVL)  tVL.textContent  = t('ob_volume');
    if (tTL)  tTL.textContent  = t('trades_time');

    // Режимы
    document.querySelectorAll('.mode-tab').forEach(b => {
        if (b.dataset.mode === 'perp') b.textContent = t('perp_mode');
        if (b.dataset.mode === 'spot') b.textContent = t('spot_mode');
    });

    // Плечо
    const levLabel = document.querySelector('.lev-label');
    if (levLabel) levLabel.textContent = t('leverage_label');

    // Input
    const inp = document.getElementById('amount-input');
    if (inp) inp.placeholder = t('amount_ph');

    // Кнопки BUY/SELL
    const isPerp = typeof currentMode === 'undefined' || currentMode === 'perp';
    const buyLabel  = document.querySelector('#btn-buy .btn-label');
    const sellLabel = document.querySelector('#btn-sell .btn-label');
    const buySub    = document.getElementById('buy-sub');
    const sellSub   = document.getElementById('sell-sub');
    if (buyLabel)  buyLabel.textContent  = isPerp ? t('btn_buy')          : t('btn_buy_spot');
    if (sellLabel) sellLabel.textContent = isPerp ? t('btn_sell')         : t('btn_sell_spot');
    if (buySub)    buySub.textContent    = isPerp ? t('btn_buy_sub')      : t('btn_buy_spot_sub');
    if (sellSub)   sellSub.textContent   = isPerp ? t('btn_sell_sub')     : t('btn_sell_spot_sub');

    // Правая панель
    const balLabels = document.querySelectorAll('.bal-label');
    const balKeys   = ['bal_usdc', 'bal_wbtc', 'bal_risex'];
    balLabels.forEach((el, i) => { if (balKeys[i]) el.textContent = t(balKeys[i]); });

    document.querySelector('.btn-sm.btn-green') &&
        (document.querySelector('.btn-sm.btn-green').textContent = t('btn_deposit'));
    document.querySelector('.btn-sm.btn-red') &&
        (document.querySelector('.btn-sm.btn-red').textContent = t('btn_withdraw'));

    const posLabels = document.querySelectorAll('.pos-label');
    const posKeys   = ['pos_side','pos_size','pos_entry','pos_liq','pos_pnl'];
    posLabels.forEach((el, i) => { if (posKeys[i]) el.textContent = t(posKeys[i]); });

    const closePosBtn = document.getElementById('btn-close-pos');
    if (closePosBtn) closePosBtn.textContent = t('btn_close_pos');

    // Настройки
    const settingsTitle = document.querySelector('#settings-panel .settings-title');
    if (settingsTitle) settingsTitle.textContent = t('settings_title');
    const secTitle = document.querySelector('.security-section-title');
    if (secTitle) secTitle.textContent = t('security_title');
    const secSimpleBtn = document.getElementById('sec-simple');
    const secAdvBtn    = document.getElementById('sec-advanced');
    if (secSimpleBtn) {
        secSimpleBtn.querySelector('.sec-label').textContent = t('sec_simple_label');
        secSimpleBtn.querySelector('.sec-desc').textContent  = t('sec_simple_desc');
    }
    if (secAdvBtn) {
        secAdvBtn.querySelector('.sec-label').textContent = t('sec_advanced_label');
        secAdvBtn.querySelector('.sec-desc').textContent  = t('sec_advanced_desc');
    }
    const helpBtn = document.getElementById('btn-show-bubble');
    if (helpBtn) helpBtn.textContent = t('settings_help');

    // Вкладки лога
    const tabLog      = document.getElementById('tab-log');
    const tabTrades   = document.getElementById('tab-trades');
    const tabMytrades = document.getElementById('tab-mytrades');
    if (tabLog)      tabLog.innerHTML      = t('tab_log');
    if (tabTrades)   tabTrades.innerHTML   = t('tab_trades');
    if (tabMytrades) tabMytrades.innerHTML = t('tab_mytrades');

    // Режимы торговли
    const modePerp = document.querySelector('.mode-tab[data-mode="perp"]');
    const modeSpot = document.querySelector('.mode-tab[data-mode="spot"]');
    if (modePerp) modePerp.textContent = t('perp_mode');
    if (modeSpot) modeSpot.textContent = t('spot_mode');

    if (typeof updateSecurityUI === 'function') updateSecurityUI();
    if (typeof updateBubbleText === 'function'  &&
        document.getElementById('welcome-bubble')?.classList.contains('visible')) {
        updateBubbleText();
    }
}

function loadLanguage() {
    const saved = localStorage.getItem('plov_lang');
    currentLang = (saved && LANGUAGES[saved]) ? saved : 'ru';
}

window.setLanguage  = setLanguage;
window.loadLanguage = loadLanguage;
window.t            = t;
console.log('%ci18n loaded', 'color:#00ff9d');
