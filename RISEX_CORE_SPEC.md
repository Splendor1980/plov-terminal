# PLOV × RISEx — спецификация торгового ядра

Основано на `developer.rise.trade/reference/*` (auto-generated OpenAPI-страницы,
`*service_*.md`) — они совпадают с полями, которые реально возвращает live API
(проверено логами). Прозовый гайд `integration.md` местами устарел/расходится
с OpenAPI (другие имена полей, camelCase вместо snake_case) — при конфликте
**приоритет всегда у OpenAPI-схем**, `integration.md` используется только там,
где OpenAPI не даёт деталей (байтовая упаковка ордера).

## 1. Модель account / signer

- **account** — основной кошелёк, на котором лежат деньги (тот, что залогинен
  на rise.trade, показывает Acct. Equity).
- **signer** — отдельный "сессионный" ключ, авторизованный торговать от имени
  account. Может быть тем же адресом, что и account (если так авторизовали на
  сайте), но не обязан быть.
- PLOV хранит только **signer** (приватный ключ, вставляемый пользователем).
  `account` в текущей версии = адрес этого же signer'а (self-authorized
  сценарий, как в API Wallets на rise.trade, где имя "PLOV" авторизовано на
  тот же адрес). Если понадобится поддержать "signer ≠ account" — это
  отдельное поле, не путать с текущим.

## 2. Баланс

`GET /v1/account/balance?account=&token=` — **сырой ончейн-баланс кошелька**
(`{"balance": "<uint256 string>"}`), USDC = 6 знаков. Это НЕ equity биржевого
аккаунта (задепонированный коллатерал) — для этого нужен
`accountservice_getportfoliodetails` / `accountservice_getcrossmarginbalance`
(ещё не сверяли структуру ответа — если после фикса ниже баланс всё равно 0,
а на сайте equity ненулевой — переходим на эти эндпоинты).

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

## 8. Открытые вопросы (нужен живой тест)

- Точная 47-байтовая схема ордера (п.5) — не подтверждена дважды.
- `getportfoliodetails`/`getcrossmarginbalance` — не сверяли структуру ответа,
  используем только если `/v1/account/balance` покажет 0 при известном
  ненулевом accountEquity.
- SDK `risex-client` через CDN не работает (нет UMD-сборки в пакете) — торговый
  путь теперь полностью на собственной подписи, без SDK.
