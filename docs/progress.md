# Progress

## 2026-09-07 — R12.3 Quiz score trend

Implemented R12.3 as a local-data-first quiz score trend with no fabricated historical dates:

- Added `src/lib/quiz-score-trend.ts` as a versioned pure aggregator over quiz definitions, current quiz progress, and the local attempt ledger.
- Added `tb-quiz-attempts` local ledger writes in `saveQuizProgress()` so completed positive-score quiz attempts record chapter, best, total, and timestamp.
- Kept current best scores authoritative in existing `tb-quiz-{chapter}` storage; the ledger is metadata only.
- Preserved legacy behavior: if no attempt ledger exists, trend output reports `dataSource: "current-quiz-progress-only"`, `hasLedger: false`, and warning `no-quiz-attempt-dates`.
- Tightened ledger writes so zero-score attempts are ignored and duplicate same-timestamp entries are not appended.
- Integrated an accessible quiz trend mini chart into `/[locale]/stats`, showing attempts in range, best score in range, current average score, completed quiz count, and a no-date notice for legacy data.
- Added zh/en stats labels for the quiz trend section.
- Added tests for trend bucketing, current best/average calculation, legacy no-date warnings, corrupt/unknown/invalid attempts, ledger normalization, zero-score/duplicate writes, and stats-page rendering.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/quiz-score-trend.test.ts src/lib/quiz-attempt-ledger.test.ts src/components/stats-client.test.tsx` passed with 3 files and 12 tests.
- Full suite: `npm test` passed with 124 test files and 952 tests.
- Lint gate: `npm run lint -- --quiet` passed.
- Typecheck gate: `npm run typecheck` passed.
- Build gate: `npm run build` passed with `/zh/stats` and `/en/stats` routes included.

Next queue:

1. Commit and push R12.3, then watch GitHub Actions and fix any failures.
2. Continue R12.4 wrongbook review efficiency and R12.5 replay practice duration with measurable local summaries.
3. Continue the remaining R12 retention suite: streak recovery, personalized next suggestions, local/cloud source labels, time-range filters, empty-state CTAs, export versioning, privacy/cleanup docs, reminder controls, weekly summaries, mobile/performance budgets, consistency checks, no-login degradation, and retention metric audit docs.


# Progress

## 2026-09-07 — R12.2 Course completion trend

Implemented R12.2 as local-data-first course completion trend support without fabricating timestamps for legacy progress:

- Added `src/lib/course-completion-trend.ts` as a versioned pure aggregator over chapters, current progress, and the local completion ledger.
- Added `tb-progress-completions` ledger writes in `markRead()` so only first-time reads record completion timestamps; duplicate reads do not update history.
- Kept legacy progress non-inventive: when no ledger exists, trend output reports `dataSource: "current-progress-only"`, `hasLedger: false`, and warning `no-completion-dates`.
- Integrated a 7-day accessible mini bar chart into `StatsClient`, showing course completions, completed chapters, read docs, completion percentage, and a legacy-data notice when completion dates are unavailable.
- Added zh/en `stats` labels for the course completion trend section.
- Added tests for aggregator bucketing, chapter completion counting, duplicate/legacy/empty/corruption handling, progress ledger write behavior, and stats-page rendering.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/course-completion-trend.test.ts src/lib/progress.test.ts` passed.
- Targeted Vitest component suite: `npx vitest run src/components/stats-client.test.tsx` passed.
- Full suite: `npm test` passed with 122 test files and 942 tests.
- Lint gate: `npm run lint -- --quiet` passed.
- Typecheck gate: `npm run typecheck` passed.
- Build gate: `npm run build` passed with `/zh/stats` and `/en/stats` routes included.

Next queue:

1. Commit and push R12.2, then watch GitHub Actions and fix failures.
2. Continue R12.3 quiz score trend and highest score with a local quiz completion ledger, preserving no-fabricated-dates semantics.
3. Continue R12.4 wrongbook review efficiency and R12.5 replay duration with measurable local summaries.
4. Continue the remaining R12 retention suite: streak recovery, personalized next suggestions, local/cloud source labels, time-range filters, empty-state CTAs, export versioning, privacy/cleanup docs, reminder controls, weekly summaries, mobile/performance budgets, consistency checks, no-login degradation, and retention metric audit docs.

## 2026-09-07 — R12.1 Learning overview card

Implemented the first R12 retention/statistics task as a real, tested stats feature:

- Added `src/lib/learning-overview.ts` with a versioned pure learning overview model for course progress, quiz records, replay practice, and engagement time.
- Added `src/lib/learning-overview.test.ts` covering stable output, duplicate course progress handling, empty/new status, invalid inputs, and rate sanitization.
- Integrated the overview into `/[locale]/stats` via `StatsClient`, including an accessible local-data source label and responsive course/quiz/replay/time cards.
- Added zh/en stats dictionary labels for the overview card.
- Marked R12.1 complete in `docs/roadmap.md` after tests and UI wiring were added.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/learning-overview.test.ts` passed with 1 file and 4 tests.
- Full suite: `npm test` passed with 120 test files and 934 tests.
- Lint gate: `npm run lint -- --quiet` passed.
- Typecheck gate: `npm run typecheck` passed after tightening numeric sanitization.
- Build gate: `npm run build` passed.

Next queue:

1. Commit and push R12.1, then watch GitHub Actions and fix failures.
2. Continue R12.2 course completion trends and R12.3 quiz score trends with pure aggregators plus stats-page rendering.
3. Continue R12.4 wrongbook review efficiency and R12.5 replay duration with measurable local data summaries.
4. Continue the remaining R12 retention suite: streak recovery, personalized next suggestions, local/cloud source labels, time-range filters, empty-state CTAs, export versioning, privacy/cleanup docs, reminder controls, weekly summaries, mobile/performance budgets, consistency checks, no-login degradation, and retention metric audit docs.


## 2026-09-07 — R11.9 AI quiz offline quality fixtures

Implemented offline fixture-driven quality gates for AI quiz generation:

- Added `src/lib/ai/fixtures/quiz-quality-cases.json` with locale-specific valid and invalid fixture cases.
- Added `src/lib/ai/quiz-quality-fixtures.test.ts` to exercise schema audit codes, accepted-question counts, relevance filtering, dedupe filtering, and quiz strategy boundaries from fixtures.
- Covered valid Chinese/English outputs, invalid roots, missing or too-short fields, duplicate options, answer validation, source accessibility, locale-specific source maps, explicit no-source, relevance thresholds, duplicate/near-duplicate questions, and chapter/variant difficulty counts.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/ai/quiz-quality-fixtures.test.ts` passed with 1 file and 23 tests.
- Full suite: `npm test` passed with 119 test files and 930 tests.
- Lint gate: `npm run lint -- --quiet` passed with no blocking errors.
- Typecheck gate: `npm run typecheck` passed.
- Build gate: `npm run build` passed.

Next queue:

1. Commit and push R11.9, then watch GitHub Actions and handle failures.
2. Continue R12 data insights tasks: learning overview card, course completion trend, quiz score trends, wrongbook review efficiency, replay practice duration, streak recovery prompt, personalized next learning suggestion, and local/cloud source labeling.

## 2026-09-07 — R11.7 / R11.8 AI quiz strategy and difficulty

Implemented configurable AI quiz generation strategy and difficulty preference:

- Added `src/lib/quiz-strategy.ts` with shared locale/difficulty/chapter/variant strategy resolution.
- Added unit coverage for expected question counts, cache keys, prompt versions, and storage-safe defaults in `src/lib/quiz-strategy.test.ts`.
- Updated `src/lib/ai/prompt.ts` so AI prompts carry difficulty, locale, cache version, token budget, relevance threshold, and chapter context through one strategy object.
- Updated `/api/ai/quiz` to resolve strategy on the server and derive cache keys from prompt version plus strategy cache key.
- Updated `AiChapterQuizCard` to expose 入门/进阶 controls, persist preference per locale, and submit difficulty with generation requests.
- Added component coverage for advanced preference persistence and request body.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/quiz-strategy.test.ts src/lib/ai/prompt.test.ts src/components/ai-chapter-quiz.test.tsx` passed with 3 files and 38 tests.
- Full suite: `npm test` passed with 118 test files and 907 tests.
- Lint gate: `npm run lint -- --quiet` passed with no blocking errors.
- Typecheck gate: `npm run typecheck` passed.
- Build gate: `npm run build` passed.

Next queue:

1. Continue R12 data insights tasks: learning overview card, course completion trend, quiz score trends, wrongbook review efficiency, replay practice duration, streak recovery prompt, personalized next learning suggestion, and local/cloud source labeling.
