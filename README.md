# Trade Buty

**English** | [中文](README.zh-CN.md)

A free, neutral trading-education platform for Chinese-speaking users worldwide: graded courses (Learn) × real market charts and historical replay (Practice).

> No stock picks · No broker referrals · No return promises · Core courses free forever

**Live**: <https://trade-buty.vercel.app>

## Product

- **Learn**: 27 chapters / 173 lessons in a systematic trading knowledge base (sourced from the open-source [kline-buty](https://github.com/sun1090/kline-buty)), with a three-stage learning path.
- **Practice**: real market K-line charts (Binance REST + WebSocket), blind-box historical replay training, up/down quizzes.
- **Test**: 27 chapter quizzes (81 questions, all explained), reading-progress tracking.
- **Bilingual**: full Chinese/English UI (`/zh` `/en`), mobile 320px-adapted.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, SSG) · TypeScript · React 19 |
| Styling | Tailwind CSS v4 (CSS-first theme tokens, dark terminal style) |
| Charts | lightweight-charts v5 |
| Content | kline-buty knowledge base as a git submodule, lenient rendering pipeline |
| Search | build-time JSON index + client-side retrieval |
| Quality | ESLint · tsc · Vitest-ready · Playwright visual audit · GitHub Actions CI |

## Quick Start

```bash
git clone https://github.com/Sun1090/trade-buty.git
cd trade-buty
git submodule update --init   # pull the knowledge base content
npm install
npm run dev                   # http://localhost:3000
```

## Commands

```bash
npm run dev         # dev server
npm run build       # production build (prebuild syncs assets/index/contract checks)
npm run lint        # ESLint
npm run typecheck   # next typegen + tsc --noEmit
```

## Project Structure

```
src/
├── app/
│   ├── [locale]/          # zh/en bilingual routes (all SSG)
│   │   ├── knowledge/     # lesson pages: /[locale]/knowledge/{chapter}/{doc}
│   │   ├── chart/         # live market
│   │   ├── replay/        # replay trainer
│   │   ├── path/          # learning path
│   │   └── search/        # in-site search
│   └── sitemap.ts robots.ts
├── components/            # chart / quiz / progress components
├── lib/                   # content (rendering pipeline) i18n quizzes progress binance
├── middleware.ts          # locale redirect
scripts/                   # asset sync / search index / contract checks
docs/                      # plan.md research.md p2-research.md
content/kline-buty/        # knowledge base submodule (read-only)
```

## Docs

- [`docs/plan.md`](docs/plan.md) — product positioning, content constitution, roadmap (P0–P4)
- [`docs/research.md`](docs/research.md) — six rounds of market research
- [`docs/p2-research.md`](docs/p2-research.md) — account & cloud progress pre-research
- [`AGENTS.md`](AGENTS.md) — agent guidelines and knowledge-base contract

## Roadmap

- ✅ P0 Skeleton: site launch, search, SEO, CI/CD
- ✅ P1 Learn + Practice: market charts, replay training, quiz system, bilingual
- ⬜ P2 Account & cloud progress (see `docs/p2-research.md`)
- ⬜ P3 AI study companion (wrong-question-driven quizzing + RAG)
- ⬜ P4 Polish & growth

## Disclaimer

All content on this site is for learning and research only and does not constitute any investment advice. Cryptocurrency and financial-derivative trading carry extreme risk; you are responsible for your own actions. Market data comes from the [Binance public API](https://binance.com); comply with its terms of service when using it.

## License

MIT © sun1090 (knowledge-base content is copyrighted by the kline-buty project)

## Sponsor

If you find this project helpful, consider buying the author a coffee to support ongoing development ☕

<table>
  <tr>
    <td align="center"><img src="public/donate-alipay.jpg" width="200" alt="Alipay QR" /><br/>Alipay</td>
    <td align="center"><img src="public/donate-wechat.jpg" width="200" alt="WeChat QR" /><br/>WeChat</td>
  </tr>
</table>
