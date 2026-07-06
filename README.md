# ⚡ PLOV Scalping Terminal

**The fastest way to scalp on RISEx.**

PLOV is a focused, no-nonsense scalping terminal built specifically for [RISEx](https://rise.trade) — the perpetuals exchange on RISE Chain. While RISEx has a solid trading interface, PLOV is designed for one thing: getting in and out of positions fast.

![PLOV Terminal](https://plov-terminal.vercel.app)

🔗 **Live:** [plov-terminal.vercel.app](https://plov-terminal.vercel.app)

---

## Why PLOV?

RISEx runs on RISE Chain — an ultra-fast Ethereum L2 with 1-second block times and gas-free trading via their API. This makes it ideal for scalping. PLOV takes full advantage of that.

| Feature | RISEx default UI | PLOV |
|---|---|---|
| Real-time orderbook | ✅ | ✅ WebSocket |
| Keyboard shortcuts | ❌ | ✅ B / S / Esc |
| Focused scalping layout | ❌ | ✅ |
| No MetaMask required | ❌ | ✅ Signer Key only |
| Multilingual | ❌ | ✅ EN / RU / 中文 |
| Open source | ❌ | ✅ |

---

## How it works

PLOV connects directly to RISEx API using your **Signer Key** — a dedicated API key you create on [rise.trade](https://www.rise.trade/en/API). No MetaMask. No browser wallet. Just paste your key and trade.

```
rise.trade → Settings → API Keys → Create Signer Key
                    ↓
           Paste into PLOV → Start trading
```

Your key is stored **locally in your browser only**. Never sent to our servers.

---

## Features

- 📊 **Live orderbook** — real-time via WebSocket, polling fallback
- 📈 **Price chart** — live BTC-PERP price history
- ⚡ **One-click trading** — LONG / SHORT with configurable leverage (1x–25x)
- ⌨️ **Keyboard shortcuts** — `B` = Long, `S` = Short, `Esc` = Reset
- 💼 **Trade history** — track your session performance
- 📊 **Statistics** — winrate, volume, best/worst trade
- 🌐 **Multilingual** — English, Русский, 中文
- 🌙 **Dark / Light theme**
- 🔒 **Signer Key** — your key stays in your browser

---

## Tech stack

- **Vanilla JS** — no framework, fast and lean
- **ethers.js v6** — EIP-712 signing for orders
- **RISEx API** — REST + WebSocket (mainnet)
- **Firebase Auth** — Google sign-in for session tracking
- **Vercel** — hosting + API proxy (CORS)

---

## Getting started (local)

```bash
git clone https://github.com/Splendor1980/plov-terminal.git
cd plov-terminal
npx live-server --port=8080
```

Open `http://localhost:8080`

> Note: On localhost, orderbook uses polling fallback (WebSocket requires HTTPS). Full WebSocket works on Vercel.

---

## Switching mainnet / testnet

In `js/config.js`:

```js
const USE_MAINNET = true;   // ← false for testnet
```

One line switches all URLs, chainId, and WebSocket endpoint.

---

## Contributing

PRs welcome. If you're building on RISE Chain or integrating RISEx API, this codebase is a good reference for:
- EIP-712 order signing (`js/risex.js`)
- WebSocket orderbook with polling fallback
- Signer Key management without MetaMask

---

## Roadmap

- [ ] Real order placement (pending RISEx API clarification on `encodeOrder` format)
- [ ] ETH-PERP and other markets
- [ ] TP/SL orders
- [ ] Mobile-friendly layout
- [ ] $1/month subscription for advanced features

---

## Links

- 🌐 [plov-terminal.vercel.app](https://plov-terminal.vercel.app)
- 📖 [RISEx API docs](https://github.com/SmoothBot/risex-ts)
- ⛓️ [RISE Chain](https://risechain.com)
- 💬 [RISEx Discord](https://discord.gg/risex)
- 💬 [PLOV Discord](https://discord.gg/e6KWQDtdEk)
---

*Built with ⚡ for the RISE Chain ecosystem*
