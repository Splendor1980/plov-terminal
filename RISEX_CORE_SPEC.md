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

## 4. Register Signer — ИСПРАВЛЕНО

Старый код подписывал структуру с полями `account`+`nonceAnchor`+`nonceBitmap`,
которой нет ни в одном источнике доки. Верно (подтверждено двумя независимыми
страницами доки — `authservice_registersigner` и `integration.md`):

```
RegisterSigner(address signer,string message,uint40 expiration,uint256 nonce)   — подписывает account
VerifySigner(address account,uint256 nonce)                                      — подписывает signer
```
`nonce` — обычный уникальный uint256 (используем `Date.now()`), НЕ nonce_anchor/bitmap.

```json
POST /v1/auth/register-signer
{
  "account", "signer", "message", "nonce", "expiration",
  "account_signature", "signer_signature"
}
```

## 5. Place Order

Wire-формат — из OpenAPI (`orderservice_placeorder`), это то, что реально
принимает сервер:

```json
POST /v1/orders/place
{
  "market_id": 1,
  "size_steps": 100,      // размер В ШАГАХ (см. п.6), не в human-units
  "price_ticks": 50000,   // цена В ТИКАХ, не в human-units
  "side": 0,               // 0=Buy, 1=Sell
  "order_type": 0,         // 0=Market, 1=Limit
  "time_in_force": 0,      // 0=GTC,1=GTT,2=FOK,3=IOC
  "post_only": false,
  "reduce_only": false,
  "stp_mode": 0,
  "builder_id": 0,
  "client_order_id": "0",
  "ttl_units": 0,
  "permit": {
    "account": "0x...", "signer": "0x...",
    "nonce_anchor": "2", "nonce_bitmap_index": 0,
    "deadline": 1735689600,
    "signature": "0x..."
  }
}
```

Подпись (по аналогии с update-leverage/update-margin-mode/update-isolated-margin,
единственная схема, подтверждённая ПОВТОРНО в доке с точной формулой):

```
VerifyWitness(address account,address target,bytes32 hash,uint48 nonceAnchor,uint8 nonceBitmap,uint32 deadline)
target = router address (RISExUniversalRouter, из /v1/system/config → addresses.router)
hash   = keccak256(encodeOrderData(...))   — 47 байт, схема ниже
```

⚠️ **Единственное, что НЕ подтверждено дважды** — точная 47-байтовая упаковка
ордера под hash (взята из `integration.md`, т.к. OpenAPI не даёт этой детали).
Если размещение ордера падает с ошибкой подписи — **это первое место для
проверки**, вместе с ошибкой из `GET /v1/error-codes`.

```
[0:8]   uint64  marketId (BE)
[8:24]  uint128 size     (BE, 18 decimals)
[24:40] uint128 price    (BE, 18 decimals)
[40]    uint8   flags: bit0=side, bit1=postOnly, bit2=reduceOnly, bit3-4=stpMode
[41]    uint8   orderType
[42]    uint8   timeInForce
[43:47] uint32  expiry (BE)
```

## 6. Конвертация human-units → steps/ticks

Из `GET /v1/markets` → `market.config`: `step_size` (мин. шаг размера),
`step_price` (мин. шаг цены), оба — decimal-строки.

```
size_steps  = round(humanSize  / step_size)
price_ticks = round(humanPrice / step_price)
```

## 7. Cancel Order

```json
POST /v1/orders/cancel
{ "market_id": 1, "order_id": "...", "permit": {...той же формы...} }
```
`hash` для permit — из 32-байтовой упаковки:
```
cancelData = (marketId << 192) | orderId   →  keccak256(bytes32(cancelData))
```

## 8. Формат подписи в permit — ПОДТВЕРЖДЕНО МАТЕМАТИЧЕСКИ

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

## 9. Открытые вопросы
