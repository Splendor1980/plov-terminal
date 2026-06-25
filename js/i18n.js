// ============================================================
// js/i18n.js — ПОЛНЫЕ ПЕРЕВОДЫ RU/EN/ZH
// ============================================================

const LANGUAGES = {
    ru: {
        status_online:      '● Онлайн',
        status_offline:     '● Офлайн',
        btn_google:         '🔑 Войти через Google',
        btn_logout:         '🚪 Выйти',
        orderbook_title:    '📊 Стакан',
        ob_price:           'Цена',
        ob_volume:          'Кол-во',
        ob_total:           'Сумма',
        ob_spread:          'Спред',
        trades_title:       '⚡ Сделки',
        trades_time:        'Время',
        perp_mode:          'Перп · RISEx',
        spot_mode:          'Спот · Helios',
        leverage_label:     'Плечо:',
        amount_ph:          'Сумма USDC',
        btn_buy:            '📈 LONG',
        btn_sell:           '📉 SHORT',
        btn_buy_spot:       '📈 BUY',
        btn_sell_spot:      '📉 SELL',
        btn_buy_sub:        'Открыть лонг',
        btn_sell_sub:       'Открыть шорт',
        btn_buy_spot_sub:   'Купить BTC',
        btn_sell_spot_sub:  'Продать BTC',
        log_title:          '📋 Лог',
        wallet_title:       '💼 Кошелёк',
        bal_usdc:           'USDC',
        bal_wbtc:           'WBTC',
        bal_risex:          'RISEx',
        btn_deposit:        '↓ Депозит',
        btn_withdraw:       '↑ Вывод',
        position_title:     '📦 Позиция',
        pos_side:           'Сторона',
        pos_size:           'Размер',
        pos_entry:          'Вход',
        pos_liq:            'Ликвид.',
        pos_pnl:            'PnL',
        btn_close_pos:      '✕ Закрыть позицию',
        stats_title:        '📊 Статистика',
        stat_trades:        'Сделок',
        stat_winrate:       'Winrate',
        stat_volume:        'Объём',
        stat_best:          'Лучшая',
        stat_worst:         'Худшая',
        login_required:     '⚠️ Сначала войдите через Google',
        copied:             '✅ Адрес скопирован!',
        welcome:            '✅ Добро пожаловать',
        login_start:        '🔑 Нажмите «Войти через Google» для начала',
        faucet_loading:     '🚰 Запрашиваем тестовый USDC...',
        faucet_received:    '🎁 Получено 1000 USDC (тестовые)',
        faucet_used:        'ℹ️ Фаусет уже использован — добавляем виртуальный баланс',
        faucet_mock:        '💰 Виртуальный баланс: 1000 USDC (локальное тестирование)',
        wallet_loaded:      '🔑 Кошелёк загружен',
        wallet_created:     '🎉 Новый кошелёк создан',
        pin_title:          '🔐 Придумайте PIN (мин. 4 символа)',
        pin_confirm:        '🔐 Повторите PIN',
        pin_error_match:    '❌ PIN не совпадает',
        pin_min:            'Минимум 4 символа',
        pin_unlock:         '🔐 Введите PIN для подписи',
        pin_wrong:          '❌ Неверный PIN',
        pin_not_set:        '❌ PIN не задан',
        config_loaded:      '⚙️ Конфиг RISEx загружен',
        signer_reg:         '🔐 Регистрируем кошелёк в RISEx...',
        signer_ok:          '✅ Кошелёк зарегистрирован в RISEx',
        ws_connected:       '📡 WebSocket подключён',
        risex_ready:        '💡 RISEx готов к торговле',
        hotkeys_hint:       '💡 B = LONG, S = SHORT, Esc = сброс',
        order_pending:      '🚀 Размещаем ордер...',
        order_success:      '✅ Позиция открыта!',
        order_error:        '❌ Ошибка ордера:',
        close_pending:      '🔄 Закрываем позицию...',
        no_pos_close:       '⚠️ Нет позиции для закрытия',
        balance_low:        '❌ Недостаточно USDC (баланс:',
        amount_invalid:     '⚠️ Введите сумму USDC',
        withdraw_to:        'Адрес получателя (0x...):',
        withdraw_amount:    'Сумма USDC:',
        withdraw_confirm:   'Вывести USDC на адрес?',
        withdraw_pending:   '⏳ Отправляем транзакцию...',
        withdraw_success:   '✅ Выведено',
        withdraw_no_addr:   '❌ Нет адреса USDC контракта',
        tx_pending:         '📡 TX:',
        tx_explorer:        '🔗 Explorer',
        logout_confirm:     'Выйти из аккаунта?',
        logout_done:        '👋 Вы вышли из аккаунта',
        no_position:        'Нет открытой позиции',
        addr_invalid:       '❌ Неверный адрес',
        cors_warning:       '⚠️ CORS на localhost — на Vercel всё заработает',
    },
    en: {
        status_online:      '● Online',
        status_offline:     '● Offline',
        btn_google:         '🔑 Sign in with Google',
        btn_logout:         '🚪 Logout',
        orderbook_title:    '📊 Order Book',
        ob_price:           'Price',
        ob_volume:          'Size',
        ob_total:           'Total',
        ob_spread:          'Spread',
        trades_title:       '⚡ Trades',
        trades_time:        'Time',
        perp_mode:          'Perp · RISEx',
        spot_mode:          'Spot · Helios',
        leverage_label:     'Leverage:',
        amount_ph:          'Amount USDC',
        btn_buy:            '📈 LONG',
        btn_sell:           '📉 SHORT',
        btn_buy_spot:       '📈 BUY',
        btn_sell_spot:      '📉 SELL',
        btn_buy_sub:        'Open long',
        btn_sell_sub:       'Open short',
        btn_buy_spot_sub:   'Buy BTC',
        btn_sell_spot_sub:  'Sell BTC',
        log_title:          '📋 Log',
        wallet_title:       '💼 Wallet',
        bal_usdc:           'USDC',
        bal_wbtc:           'WBTC',
        bal_risex:          'RISEx',
        btn_deposit:        '↓ Deposit',
        btn_withdraw:       '↑ Withdraw',
        position_title:     '📦 Position',
        pos_side:           'Side',
        pos_size:           'Size',
        pos_entry:          'Entry',
        pos_liq:            'Liquidation',
        pos_pnl:            'PnL',
        btn_close_pos:      '✕ Close position',
        stats_title:        '📊 Statistics',
        stat_trades:        'Trades',
        stat_winrate:       'Winrate',
        stat_volume:        'Volume',
        stat_best:          'Best',
        stat_worst:         'Worst',
        login_required:     '⚠️ Please sign in with Google first',
        copied:             '✅ Address copied!',
        welcome:            '✅ Welcome',
        login_start:        '🔑 Click «Sign in with Google» to start',
        faucet_loading:     '🚰 Requesting testnet USDC...',
        faucet_received:    '🎁 Received 1000 USDC (testnet)',
        faucet_used:        'ℹ️ Faucet already used — adding virtual balance',
        faucet_mock:        '💰 Virtual balance: 1000 USDC (local testing)',
        wallet_loaded:      '🔑 Wallet loaded',
        wallet_created:     '🎉 New wallet created',
        pin_title:          '🔐 Set PIN (min. 4 characters)',
        pin_confirm:        '🔐 Repeat PIN',
        pin_error_match:    '❌ PINs do not match',
        pin_min:            'Minimum 4 characters',
        pin_unlock:         '🔐 Enter PIN to sign',
        pin_wrong:          '❌ Wrong PIN',
        pin_not_set:        '❌ PIN not set',
        config_loaded:      '⚙️ RISEx config loaded',
        signer_reg:         '🔐 Registering wallet in RISEx...',
        signer_ok:          '✅ Wallet registered in RISEx',
        ws_connected:       '📡 WebSocket connected',
        risex_ready:        '💡 RISEx ready for trading',
        hotkeys_hint:       '💡 B = LONG, S = SHORT, Esc = reset',
        order_pending:      '🚀 Placing order...',
        order_success:      '✅ Position opened!',
        order_error:        '❌ Order error:',
        close_pending:      '🔄 Closing position...',
        no_pos_close:       '⚠️ No position to close',
        balance_low:        '❌ Insufficient USDC (balance:',
        amount_invalid:     '⚠️ Enter USDC amount',
        withdraw_to:        'Recipient address (0x...):',
        withdraw_amount:    'Amount USDC:',
        withdraw_confirm:   'Withdraw USDC to address?',
        withdraw_pending:   '⏳ Sending transaction...',
        withdraw_success:   '✅ Withdrawn',
        withdraw_no_addr:   '❌ USDC contract address not loaded',
        tx_pending:         '📡 TX:',
        tx_explorer:        '🔗 Explorer',
        logout_confirm:     'Sign out?',
        logout_done:        '👋 Logged out',
        no_position:        'No open position',
        addr_invalid:       '❌ Invalid address',
        cors_warning:       '⚠️ CORS on localhost — will work on Vercel',
    },
    zh: {
        status_online:      '● 在线',
        status_offline:     '● 离线',
        btn_google:         '🔑 谷歌登录',
        btn_logout:         '🚪 退出',
        orderbook_title:    '📊 订单簿',
        ob_price:           '价格',
        ob_volume:          '数量',
        ob_total:           '总额',
        ob_spread:          '点差',
        trades_title:       '⚡ 成交',
        trades_time:        '时间',
        perp_mode:          '永续 · RISEx',
        spot_mode:          '现货 · Helios',
        leverage_label:     '杠杆:',
        amount_ph:          'USDC 金额',
        btn_buy:            '📈 做多',
        btn_sell:           '📉 做空',
        btn_buy_spot:       '📈 买入',
        btn_sell_spot:      '📉 卖出',
        btn_buy_sub:        '开多头',
        btn_sell_sub:       '开空头',
        btn_buy_spot_sub:   '买入 BTC',
        btn_sell_spot_sub:  '卖出 BTC',
        log_title:          '📋 日志',
        wallet_title:       '💼 钱包',
        bal_usdc:           'USDC',
        bal_wbtc:           'WBTC',
        bal_risex:          'RISEx',
        btn_deposit:        '↓ 充值',
        btn_withdraw:       '↑ 提现',
        position_title:     '📦 持仓',
        pos_side:           '方向',
        pos_size:           '规模',
        pos_entry:          '入场',
        pos_liq:            '清算价',
        pos_pnl:            '盈亏',
        btn_close_pos:      '✕ 平仓',
        stats_title:        '📊 统计',
        stat_trades:        '交易次',
        stat_winrate:       '胜率',
        stat_volume:        '交易量',
        stat_best:          '最佳',
        stat_worst:         '最差',
        login_required:     '⚠️ 请先通过谷歌登录',
        copied:             '✅ 地址已复制！',
        welcome:            '✅ 欢迎',
        login_start:        '🔑 点击「谷歌登录」开始',
        faucet_loading:     '🚰 请求测试 USDC...',
        faucet_received:    '🎁 获得 1000 USDC（测试）',
        faucet_used:        'ℹ️ 水龙头已使用 — 添加虚拟余额',
        faucet_mock:        '💰 虚拟余额：1000 USDC（本地测试）',
        wallet_loaded:      '🔑 钱包已加载',
        wallet_created:     '🎉 新钱包已创建',
        pin_title:          '🔐 设置 PIN（最少 4 位）',
        pin_confirm:        '🔐 确认 PIN',
        pin_error_match:    '❌ PIN 不匹配',
        pin_min:            '最少 4 个字符',
        pin_unlock:         '🔐 输入 PIN 签名',
        pin_wrong:          '❌ PIN 错误',
        pin_not_set:        '❌ 未设置 PIN',
        config_loaded:      '⚙️ RISEx 配置已加载',
        signer_reg:         '🔐 在 RISEx 注册钱包...',
        signer_ok:          '✅ 钱包已在 RISEx 注册',
        ws_connected:       '📡 WebSocket 已连接',
        risex_ready:        '💡 RISEx 已准备好交易',
        hotkeys_hint:       '💡 B = 做多, S = 做空, Esc = 重置',
        order_pending:      '🚀 下单中...',
        order_success:      '✅ 持仓已开！',
        order_error:        '❌ 订单错误:',
        close_pending:      '🔄 平仓中...',
        no_pos_close:       '⚠️ 无持仓可平',
        balance_low:        '❌ USDC 余额不足（余额:',
        amount_invalid:     '⚠️ 输入 USDC 金额',
        withdraw_to:        '收款地址 (0x...):',
        withdraw_amount:    'USDC 金额:',
        withdraw_confirm:   '提现 USDC 到地址？',
        withdraw_pending:   '⏳ 发送交易中...',
        withdraw_success:   '✅ 已提现',
        withdraw_no_addr:   '❌ USDC 合约地址未加载',
        tx_pending:         '📡 TX:',
        tx_explorer:        '🔗 区块浏览器',
        logout_confirm:     '退出账户？',
        logout_done:        '👋 已退出',
        no_position:        '无持仓',
        addr_invalid:       '❌ 地址无效',
        cors_warning:       '⚠️ localhost CORS — Vercel 上将正常运行',
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
            authBtn.textContent = t('btn_logout') + ' ' + (currentUser.displayName || '').slice(0, 12);
            authBtn.className   = 'btn-auth logout';
        } else {
            authBtn.textContent = t('btn_google');
            authBtn.className   = 'btn-auth';
        }
    }

    // Left panel
    const obTitle = document.querySelector('.panel-left .panel-title');
    if (obTitle) obTitle.innerHTML = `${t('orderbook_title')} <span class="badge-live" id="ob-live">LIVE</span>`;

    const obPriceL  = document.getElementById('ob-price-label');
    const obVolL    = document.getElementById('ob-vol-label');
    const obTotalL  = document.getElementById('ob-total-label');
    if (obPriceL)  obPriceL.textContent  = t('ob_price');
    if (obVolL)    obVolL.textContent    = t('ob_volume');
    if (obTotalL)  obTotalL.textContent  = t('ob_total');

    const spreadEl = document.getElementById('spread-label');
    if (spreadEl) spreadEl.textContent = t('ob_spread') + ': ';

    const tPriceL = document.getElementById('t-price-label');
    const tVolL   = document.getElementById('t-vol-label');
    const tTimeL  = document.getElementById('t-time-label');
    if (tPriceL) tPriceL.textContent = t('ob_price');
    if (tVolL)   tVolL.textContent   = t('ob_volume');
    if (tTimeL)  tTimeL.textContent  = t('trades_time');

    // Mode tabs
    document.querySelectorAll('.mode-tab').forEach(b => {
        if (b.dataset.mode === 'perp') b.textContent = t('perp_mode');
        if (b.dataset.mode === 'spot') b.textContent = t('spot_mode');
    });

    // Leverage label
    const levLabel = document.querySelector('.lev-label');
    if (levLabel) levLabel.textContent = t('leverage_label');

    // Amount input
    const inp = document.getElementById('amount-input');
    if (inp) inp.placeholder = t('amount_ph');

    // BUY/SELL кнопки
    const isPerp = typeof currentMode === 'undefined' || currentMode === 'perp';
    const buyLabel  = document.querySelector('#btn-buy .btn-label');
    const sellLabel = document.querySelector('#btn-sell .btn-label');
    const buySub    = document.getElementById('buy-sub');
    const sellSub   = document.getElementById('sell-sub');
    if (buyLabel)  buyLabel.textContent  = isPerp ? t('btn_buy')      : t('btn_buy_spot');
    if (sellLabel) sellLabel.textContent = isPerp ? t('btn_sell')     : t('btn_sell_spot');
    if (buySub)    buySub.textContent    = isPerp ? t('btn_buy_sub')  : t('btn_buy_spot_sub');
    if (sellSub)   sellSub.textContent   = isPerp ? t('btn_sell_sub') : t('btn_sell_spot_sub');

    // Log title
    const logTitle = document.querySelector('.log-wrap .panel-title');
    if (logTitle) logTitle.textContent = t('log_title');

    // Right panel — Wallet
    const walletTitle = document.querySelector('.panel-right .section:nth-child(1) .section-title');
    if (walletTitle) walletTitle.textContent = t('wallet_title');

    const balLabels = document.querySelectorAll('.bal-label');
    const balKeys   = ['bal_usdc', 'bal_wbtc', 'bal_risex'];
    balLabels.forEach((el, i) => { if (balKeys[i]) el.textContent = t(balKeys[i]); });

    const depBtn = document.querySelector('.btn-sm.btn-green');
    const witBtn = document.querySelector('.btn-sm.btn-red');
    if (depBtn) depBtn.textContent = t('btn_deposit');
    if (witBtn) witBtn.textContent = t('btn_withdraw');

    // Position
    const posTitle = document.querySelector('#pos-side')?.closest('.section')?.querySelector('.section-title');
    if (posTitle) posTitle.textContent = t('position_title');

    const posLabels = document.querySelectorAll('.pos-label');
    const posKeys   = ['pos_side','pos_size','pos_entry','pos_liq','pos_pnl'];
    posLabels.forEach((el, i) => { if (posKeys[i]) el.textContent = t(posKeys[i]); });

    const closePosBtn = document.getElementById('btn-close-pos');
    if (closePosBtn) closePosBtn.textContent = t('btn_close_pos');

    // Stats
    const statsTitle = document.querySelector('#stat-trades')?.closest('.section')?.querySelector('.section-title');
    if (statsTitle) statsTitle.textContent = t('stats_title');

    const statLabels = document.querySelectorAll('.panel-right .section:nth-child(3) .pos-label');
    const statKeys   = ['stat_trades','stat_winrate','stat_volume','stat_best','stat_worst'];
    statLabels.forEach((el, i) => { if (statKeys[i]) el.textContent = t(statKeys[i]); });

    // Quick pct buttons
    const pctBtns = document.querySelectorAll('.pct-btn');
    const pctKeys = ['25%','50%','75%', t('pct_max') || 'MAX'];
    pctBtns.forEach((el, i) => {
        if (i === 3) el.textContent = lang === 'zh' ? '最大' : 'MAX';
    });

    // Hotkeys
    const hotkeys = document.querySelector('.hotkeys');
    if (hotkeys) {
        hotkeys.innerHTML = `<kbd>B</kbd> ${isPerp ? 'LONG' : 'BUY'} &nbsp; <kbd>S</kbd> ${isPerp ? 'SHORT' : 'SELL'} &nbsp; <kbd>Esc</kbd> ${lang === 'zh' ? '重置' : lang === 'en' ? 'Reset' : 'Сброс'}`;
    }
}

function loadLanguage() {
    const saved = localStorage.getItem('plov_lang');
    if (saved && LANGUAGES[saved]) currentLang = saved;
    else currentLang = 'ru';
    // setLanguage вызывается после DOMContentLoaded
}

window.setLanguage  = setLanguage;
window.loadLanguage = loadLanguage;
window.t            = t;
console.log('%ci18n loaded', 'color:#00ff9d');
