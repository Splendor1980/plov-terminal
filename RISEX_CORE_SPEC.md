# PLOV × RISEx — спецификация торгового ядра

Основано на `developer.rise.trade/reference/*` (auto-generated OpenAPI-страницы,
`*service_*.md`) — они совпадают с полями, которые реально возвращает live API
(проверено логами). Прозовый гайд `integration.md` местами устарел/расходится
с OpenAPI (другие имена полей, camelCase вместо snake_case) — при конфликте
**приоритет всегда у OpenAPI-схем**, `integration.md` используется только там,
где OpenAPI не даёт деталей (байтовая упаковка ордера).

## 1. Модель account / signer — ПОДТВЕРЖДЕНО, теперь поддержано в коде

- **account** — основной (фондированный) аккаунт RISEx.
- **signer** — делегат-ключ, авторизованный торговать от имени account.
  Может совпадать с account (self-authorized) либо быть отдельным адресом
  (создан через rise.trade → API → Generate → Authorize).

Подтверждено вживую: аккаунт с Acct. Equity на rise.trade и отдельно
сгенерированный/авторизованный API-кошелёк — РАЗНЫЕ адреса, деньги остаются
на account, транзакция не нужна.

PLOV хранит оба: `signerAddress` (из приватного ключа) и `riseAccountAddress`
(вводится отдельным полем, по умолчанию = signerAddress для обратной
совместимости). Используется как `account = riseAccountAddress || signerAddress`
во всех запросах (баланс/позиция/ордера).

⚠️ **Важное ограничение**: `RegisterSigner` подписывается ключом ACCOUNT, а
PLOV имеет только ключ signer'а (ключ account — это Rabby/MetaMask,
намеренно никогда не передаётся в PLOV). Поэтому если account ≠ signer,
PLOV **не может** сам зарегистрировать signer — авторизация должна быть
уже сделана на rise.trade → API → Authorize API Wallet (что и происходит
в штатном сценарии). Код это учитывает: при account ≠ signer собственный
вызов register-signer пропускается.

## 2. Баланс — ПОДТВЕРЖДЕНО ЖИВЬЁМ

`GET /v1/account/cross-margin-balance?account=` →
`{"data":{"balance":"6.996176654671112539"}}` — это и есть Acct. Equity/
коллатерал (проверено вживую, совпало с сайтом). Формат — **человекочитаемая
decimal-строка**, делить на 1e6/1e18 не нужно, просто `parseFloat`.

`GET /v1/account/balance?account=&token=` — сырой ончейн-баланс кошелька
(ERC-20 `balanceOf`), НЕ используем для отображения баланса, оставлен в доке
для справки (может пригодиться отдельно, если понадобится показывать именно
"свободные" недепонированные USDC на кошельке).

`GET /v1/account/portfolio-details` — 404, такого пути нет (или другой,
не найденный путь) — не используем.

## 3. EIP-712 домен

`GET /v1/auth/eip712-domain` → `{name, version, chain_id, verifying_contract}`
(snake_case, подтверждено логами). Тип:
```
EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)
```

## 4. Register Signer — ИСПРАВЛЕНО (дока оказалась устаревшей!)

⚠️ Доковый текст (`authservice_registersigner`, `integration.md`) утверждает
`RegisterSigner(address signer,string message,uint40 expiration,uint256 nonce)`
— это **устарело/неверно**. Точная структура — из исходников официального SDK
`risex-client@0.1.11` (`createRegisterSignerSignatures`):

```
RegisterSigner(address account,address signer,string message,uint32 expiration,uint48 nonceAnchor,uint8 nonceBitmap)  — подписывает account
VerifySigner(address account,uint48 nonceAnchor,uint8 nonceBitmap)                                                     — подписывает signer
```
`message` — фиксированная строка **"Registering signer for RISEx"** (не любая
своя). `nonceAnchor = nonce_anchor+1`, `nonceBitmap = 0` (для ЭТОЙ функции — не
путать с nonce для order-permit'ов, там другая логика, см. §6).

```json
POST /v1/auth/register-signer
{
  "account", "signer", "message",
  "nonce_anchor", "nonce_bitmap_index", "expiration",
  "account_signature", "signer_signature",   // hex, НЕ base64 (в отличие от permit.signature в ордерах!)
  "label"
}
```

## 5. Place Order — ТОЧНАЯ ФОРМУЛА ИЗ ИСХОДНИКОВ SDK

Публичная дока НЕ даёт формулу для ордера (в отличие от isolated-margin/
leverage/margin-mode). Формула извлечена из исходников официального SDK
`risex-client@0.1.11` (npm-пакет, `dist/esm/index.mjs`) — то есть это не
догадка, а точная копия того, что использует сам RISEx.

**Хэш ордера — НЕ 47 сырых байт (это была ошибочная версия из integration.md).**
Правильно: один битово-упакованный `uint256` + `abi.encode`:

```js
ACTION_PLACE_ORDER_HASH = keccak256(toUtf8Bytes("RISE_PERPS_PLACE_ORDER_V1"))

// orderFlags — один байт:
orderFlags = (side&1) | (post_only?2:0) | (reduce_only?4:0)
           | ((stp_mode&3)<<3) | ((order_type&1)<<5) | ((time_in_force&3)<<6)

// packed uint256:
data = (market_id & 0xFFFF) << 70n
     | (size_steps & 0xFFFFFFFF) << 38n
     | (price_ticks & 0xFFFFFF) << 14n
     | (orderFlags & 0xFF) << 6n
     | (1 /* headerVersion */ << 1)   // headerVersion всегда 1

headerFlags = 1 /* V3_FLAG_PERMIT */  // + biты BUILDER(2)/CLIENT_ID(4)/TTL(16) если применимо

hash = keccak256(abi.encode(
  ["bytes32","uint8","uint256","uint16","uint64","uint16"],
  [ACTION_PLACE_ORDER_HASH, headerFlags, data, builder_id, BigInt(client_order_id), ttl_units]
))
```

Permit — тот же `VerifyWitness`, что и везде (§8), `target` = router.

⚠️ **Market-ордера всегда `price_ticks: 0`** (не текущая цена!) — подтверждено
из `marketBuy`/`marketSell` в SDK. `order_type: 0=Market,1=Limit`,
`time_in_force: 3=IOC` для маркет-ордеров (`0=GTC` для лимитных) —
подтверждено оттуда же, совпадает с бизнес-валидацией сервера, которую мы
поймали вживую ("market orders require FOK or IOC").

## 6. Nonce для permit — ИСПРАВЛЕНО (расхождение с SDK)

Было: `nonceAnchor = current+1, nonceBitmap = 0` всегда. Правильно (из
`createPermitParams` в SDK):
```
nonceAnchor = nonce_anchor (БЕЗ +1)
nonceBitmap = current_bitmap_index (не всегда 0!)
если nonceBitmap > 207: nonceAnchor += 1, nonceBitmap = 0
```
Для `register-signer` (отдельная функция `createRegisterSignerSignatures`) —
там `+1` и `bitmap=0` ДЕЙСТВИТЕЛЬНО верны, это не противоречие, две разные
функции с разной логикой.

## 7. Конвертация human-units → steps/ticks

Из `GET /v1/markets` → `market.config`: `step_size` (мин. шаг размера),
`step_price` (мин. шаг цены), оба — decimal-строки.

```
size_steps  = round(humanSize  / step_size)
price_ticks = round(humanPrice / step_price)
```

## 8. Cancel Order — ИСПРАВЛЕНО (order_id ≠ resting_order_id, перепутали)

```json
POST /v1/orders/cancel
{ "market_id": 1, "order_id": "0x0000...0092" /* ОРИГИНАЛЬНЫЙ order_id, длинный hex */, "permit": {...} }
```
⚠️ Живая ошибка, которую поймали: если отправить `resting_order_id` (короткое
число без `0x`) в поле `order_id` — сервер вернёт `invalid order_id: decode
order_id hex: hex string without 0x prefix`. Это два разных значения:
- **`order_id`** — длинный hex, идёт в тело запроса как есть.
- **`resting_order_id`** — используется ТОЛЬКО для вычисления hash подписи
  (ниже), в тело запроса не попадает.

Hash для permit — из точной формулы SDK (bytes32,uint256,uint256):
```
hash = keccak256(abi.encode(["bytes32","uint256","uint256"],
  [ACTION_CANCEL_ORDER_HASH, BigInt(market_id), BigInt(resting_order_id)]))
```
`ACTION_CANCEL_ORDER_HASH = keccak256(toUtf8Bytes("RISE_PERPS_CANCEL_ORDER_V1"))`.

Оба значения (`order_id` и `resting_order_id`) приходят вместе в одном
объекте от `GET /v1/orders/open?account=&market_id=` (см. §7).

## 9. Формат подписи в permit — ПОДТВЕРЖДЕНО МАТЕМАТИЧЕСКИ

`permit.signature` — **base64**, не hex! (стандартная конвенция OpenAPI
`format: byte` / protobuf-JSON для bytes-полей). Подтверждено точным
совпадением: наша 132-символьная hex-строка (65 байт), при ошибочном чтении
как base64, даёт ровно `132/4*3 = 99` байт — именно это число сервер и вернул
в ошибке `"signature must be 64 or 65 bytes, got 99"`. Исправлено через
`hexSigToBase64()` в `js/risex.js`.

⚠️ Не проверено: возможно, та же проблема есть у `account_signature`/
`signer_signature` в `register-signer` (сейчас не критично — в delegate-режиме
этот вызов пропускается, см. §1). Если понадобится self-authorized сценарий —
проверить в первую очередь.

- ~~Точная 47-байтовая схема ордера (п.5)~~ — **подтверждено вживую**: сервер
  вернул бизнес-валидацию ("market orders require FOK or IOC time_in_force"),
  а не ошибку подписи/авторизации — значит permit/hash/domain проходят
  проверку. `order_type: 0=Market` тоже подтвердился (сервер понял ордер
  именно как market и применил соответствующее правило по time_in_force).
- `getportfoliodetails` — 404, не существует по этому пути, не используем.
  `cross-margin-balance` — подтверждён и используется (см. §2).
- SDK `risex-client` через CDN не работает (нет UMD-сборки в пакете) — торговый
  путь теперь полностью на собственной подписи, без SDK.

## 10. Открытые вопросы

## 11. Trade History (My Trades) — синхронизация с реальностью

`GET /v1/trade-history?account=&limit=` → `Fill[]` (подтверждено исходниками
SDK, `getAccountTradeHistory`). Поля: `fill_id, order_id, market_id, side,
size, price, fee, timestamp`. **Без leverage и без per-trade PnL** — их
нет на уровне отдельного филла (leverage — атрибут позиции, PnL по каждой
сделке отдельно не считается, есть только агрегированный `getRealizedPnl`).

Раньше «My Trades» был чисто локальным журналом в `localStorage` —
расходился с реальностью при закрытии браузера/несинхронной сессии. Теперь
сервер (`/v1/trade-history`) — источник правды, локальная запись только
для мгновенного отклика сразу после клика (помечена `pending`, тут же
перезаписывается настоящими данными).

## 12. TP/SL (Take Profit / Stop Loss) — новая фича

Два разных подписанта, важно не путать:

**A) Approve budget (один раз, ОБЯЗАТЕЛЬНО перед первым TP/SL):**
```
POST /v1/auth/approve-single
```
Подписывает **АККАУНТ** (не delegate signer!) — `PermitSingle(address account,
address operator, uint96 budget, uint32 allowanceExpiry, uint48 nonceAnchor,
uint8 nonceBitmap)`. `operator` = `system/config → addresses.operator_hub`.
`budget` — WAD (18 decimals), notional USD. `signature` — **hex**, не base64
(подтверждено примером в доке: `"0x1234..."`).

PLOV не хранит ключ account — используется `window.ethereum` (Rabby/MetaMask,
тот же паттерн, что и оплата подписки), не delegate signer.

**B) Place/Cancel TP/SL ордер (delegate signer, как обычные ордера):**
```
POST /v1/orders/tpsl         primaryType PlaceTpslOrder
POST /v1/orders/tpsl/cancel  primaryType CancelTpslOrder
GET  /v1/orders/tpsl?account=&market_id=
```
Enum-поля в JSON-теле — **строки** (`"BUY"/"SELL"`, `"TAKE_PROFIT"/"STOP_LOSS"`,
`"MARKET"/"LIMIT"`, `"MARK_PRICE"/"LAST_TRADED_PRICE"`, `"GTC"/...`), а в самой
EIP-712 подписи те же поля — **uint8** (числовое представление, предполагаем
порядок объявления enum = значение: BUY=0, TAKE_PROFIT=0, MARKET=0,
LAST_TRADED_PRICE=0 — НЕ подтверждено вживую, первое место для проверки).
`size`/`stop_price`/`limit_price` — человекочитаемые decimal-строки (не
steps/ticks, в отличие от обычных ордеров). `signature` — base64 (format:byte,
как и обычный permit.signature).

`size_percent_bps: 10000` = закрыть 100% позиции по триггеру (используем как
дефолт для простоты UX — TP/SL закрывает всю позицию целиком).

⚠️ Открытые вопросы: точное числовое значение enum'ов в подписи (см. выше),
и не проверено, что происходит если approve-single budget истёк/недостаточен
на момент срабатывания ордера (ошибка должна прийти от `/v1/orders/tpsl` при
размещении, а не при исполнении — не проверяли).
