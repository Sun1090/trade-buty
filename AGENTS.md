# AGENTS.md

This file is the agent entry point: it routes to concrete rules. Don't pile every detail here; keep it scannable.

## Project

Trade Buty is a free, neutral trading-education platform for Chinese-speaking users worldwide: graded courses (Learn) × real market charts and replay (Practice). Content is sourced from the [kline-buty](https://github.com/sun1090/kline-buty) trading knowledge base.

## Required Reading

1. [`docs/plan.md`](docs/plan.md) — product positioning, roadmap, content-constitution red lines.
2. [`docs/research.md`](docs/research.md) — six rounds of market research conclusions.
3. Before writing code: read every section on this page; Next.js-specific notes are in the auto-generated block at the bottom.

## Non-reversible Product Decisions

- **Content constitution**: no return promises, no stock/fund recommendations, no broker referrals; every piece of content must have a "⚠️ Risk Warning" block.
- P0–P3 are entirely free; core courses are free forever.
- Targeted at Chinese-speaking users worldwide, deployed on Vercel without ICP filing; no mainland-ICP route.
- The knowledge base is a submodule reference (`content/kline-buty`); **never edit its content in-place from this site**. Changes go to the kline-buty repo.
- Markdown rendering must be lenient: documents missing frontmatter or assets should warn and skip, never break the build.
- The framework is Next.js (App Router); do not revisit Astro / VitePress migration.

## Commands

```bash
npm run dev          # dev server (localhost:3000)
npm run build        # production build (must run at repo root)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
```

## Naming Conventions

- Files created in this repo (components, scripts, docs, quiz banks, etc.) use **English names, no numeric prefixes**.
- Knowledge-base submodule content is exempt (its naming is governed by the kline-buty repo).

## Knowledge-Base Contract (build dependency; changes need sync)

This site's parsing depends on the following kline-buty structures (2026-08 bilingual restructure). Evaluate the impact whenever the kline-buty repo is restructured:

1. Language-rooted directories: `docs/knowledge/{zh,en}/`; zh must have all 27 chapters, en may fill in gradually.
2. Each chapter is an English-slug directory (e.g. `getting-started/`) containing a `README.md` (chapter intro; H1 titled `NN · Name`).
3. Lesson filenames are English slugs (e.g. `candlestick-basics.md`), ordered by the leading number of the frontmatter `title`.
4. Frontmatter fields: `title`, `description`.
5. Cross-chapter relative links use slugs: `(../futures/)`、`(../futures/margin.md)`.
6. Assets live under each chapter's `_assets/`.
7. VitePress legacy: `## 篇目一览` + `<DocCards/>` are filtered out by this site's render pipeline.

Site URLs use the slug directly: `/[locale]/knowledge/{chapter}/{doc}`. Legacy numeric routes are deprecated.

## Submodule Operations

- After the first clone, run `git submodule update --init` to get the content.
- Update the knowledge base with `npm run kb:update` (pull + contract check + asset/index sync + build regression, all-in-one).
- When a commit includes a submodule-pointer change, the commit message must state which knowledge-base version it synced to.
- Before building, confirm `content/kline-buty/docs/knowledge/` exists; if missing, raise a clear error rather than serving an empty page.

## Content Rendering Contract (with the knowledge base)

- Chapter directories: `docs/knowledge/NN-*/`; the chapter intro is the directory's `README.md`, body lessons are numbered `.md` files.
- Frontmatter contract fields: `title` (`NN · 标题`), `description`; missing fields degrade to filename / first H1.
- VitePress container syntax (`::: warning 标题 ... :::`) is converted to callout blocks in the render pipeline.
- Relative links and `_assets/` image paths are rewritten to in-site routes; assets are copied to `public/knowledge-assets/` by a prebuild script.
- Anchor links must scroll the page to the real target heading.

## Commit Convention

- Angular Convention (`feat(scope): ...`).
- No `Co-Authored-By` or any AI sign-off.
- One commit = one logical topic.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
