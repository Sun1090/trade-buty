# Progress

## 2026-09-11 — R12.18 Completion celebration audit (no profit hints)

Audited `ChapterCompleteCelebration` and found a real constitution violation, now fixed:

- The emoji sequence contained 📈 (bull-market gains) and 💎 ("diamond hands" holding meme), which violate the "never imply returns" rule. The list is now exported as `CELEBRATION_EMOJIS` and restricted to learning-neutral glyphs (🎉 📖 ✨ ✅ 📚 🎓); a regression test asserts the forbidden set ({📈💎🚀💰🤑🐂🌕}) stays excluded.
- Copy was hardcoded zh "篇章完成！" — now localized via `locale` prop (zh/en) and wired from the knowledge chapter page; the overlay gained `role="status"` for screen readers.
- Tests lock: celebration appears only for genuinely complete chapters, copy never mentions profit/win-rate/returns, and the overlay auto-dismisses.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/components/chapter-complete-celebration.test.tsx` passed (3 tests).
- Typecheck gate: `npm run typecheck` passed.

Next queue:

1. Watch PR #1 CI after this push.
2. Continue the remaining R12 suite: R12.13 privacy settings entry review, R12.14 retention docs, R12.15–R12.17 reminders, R12.25 retention metric audit docs.

## 2026-09-11 — R12.24 Guest-mode stats degradation contract

## 2026-09-11 — R12.24 Guest-mode stats degradation contract

Implemented R12.24 as a verified no-login parity contract (the stats page was already local-first; this locks it with regression coverage):

- Added `src/components/stats-client-guest.test.tsx`: three specs proving that with no AuthProvider and no Supabase env, the dashboard renders every section (overview, all four trends, weekly report + summary, next suggestion), the source badge reads "本机数据", range switching persists, a guest export produces the complete versioned payload (correct counts from seeded local ledgers), and no login wall / degraded placeholder text ever appears.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/components/stats-client-guest.test.tsx` passed (3 tests).

Next queue:

1. Watch PR #1 CI after this push.
2. Continue the remaining R12 suite: R12.13 privacy settings entry review, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 course-completion celebration audit, R12.25 retention metric audit docs.

## 2026-09-11 — R12.19 Editable weekly learning goal + R12.20 Local weekly summary

## 2026-09-11 — R12.19 Editable weekly learning goal + R12.20 Local weekly summary

Implemented R12.19 and R12.20 as one coherent goal-and-feedback pair (daily goal was already tier-editable with cloud double-write; the real gap was the weekly axis):

- Added `src/lib/weekly-summary.ts`: `WEEKLY_GOAL_TIERS` (45/90/150 min, default 90) with `getWeeklyGoalMin`/`setWeeklyGoalMin` (persists `tb-weekly-goal-min`, dispatches `tb-weekly-goal`, fire-and-forget cloud upsert), and pure `buildWeeklySummary()` over the study-time ledger + progress/quiz/review ledgers + replay history — last-7-calendar-day window compared by local date strings, corruption-tolerant, no fabricated dates.
- Cloud sync: migration `supabase/migrations/0007_weekly_goal_min.sql` adds `user_settings.weekly_goal_min`; hydrate merges local-intent-first like the daily goal; `syncWeeklyGoalUpsert` + queue executor `goal` kind now upserts whichever goal field is present; R12.9 conflict detection extended with the `weekly-goal` kind.
- Stats dashboard gains a "本周学习摘要 / Weekly learning summary" card showing the generated line (minutes, active days, completions, quizzes, reviews, replay rounds) plus achieved/remaining state and the editable goal tier row.
- Tests: pure builder (window boundaries with endpoint-inclusive semantics, corruption, achieved-only-on-real-minutes), storage tier clamping, cloud merge + conflict wiring, and three UI specs (summary render, tier edit persistence, honest achieved state).

Verification recorded:

- Targeted Vitest suites: `src/lib/weekly-summary.test.ts`, `src/lib/sync-conflicts.test.ts`, `src/lib/sync-layer-hydrate.test.ts`, `src/components/stats-client.test.tsx` all passed.
- Full suite: `npm test` passed with 137 test files and 1044 tests.
- Lint gate: `npm run lint -- --quiet` passed; typecheck gate passed; `npm run check:ai-copy` passed.

Next queue:

1. Watch PR #1 CI after this push.
2. Continue the remaining R12 suite: R12.13 privacy settings entry review, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 course-completion celebration audit, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.12 Versioned stats data export

## 2026-09-11 — R12.12 Versioned stats data export

Implemented R12.12 as a local, versioned JSON export on the stats dashboard:

- Added `src/lib/stats-export.ts`: `buildStatsExport()` (pure, injectable clock) emits `{ format: "trade-buty-stats-export", version: 1, exportedAt, locale, data }` with stable field names for courses/quizzes/replay/review/engagement/goals; all numeric inputs clamped so corrupt local state never produces NaN/negative garbage; `serializeStatsExport()` + `downloadStatsExport()` (blob + temp anchor, dated filename).
- Export button on the stats overview grid builds the payload from the live models — zero network calls (privacy-constitution compliant), labels bilingual.
- Tests: field-shape/version assertions, corrupt-input sanitization, null-percentage and locale coercion, JSON round-trip, and the download helper wiring.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/stats-export.test.ts src/components/stats-client.test.tsx` passed (24 tests).
- Full suite: `npm test` passed with 137 test files and 1034 tests.
- Lint gate: `npm run lint -- --quiet` passed; typecheck gate passed; `npm run check:ai-copy` passed.

Next queue:

1. Watch PR #1 CI after this push.
2. Continue the remaining R12 suite: R12.13 privacy settings entry review, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.11 Per-section empty-state CTAs on stats

## 2026-09-11 — R12.11 Per-section empty-state CTAs on stats

Implemented R12.11 as actionable empty states inside each stats trend section (the page-level new-user CTA from R4.5 only covers the all-zero case):

- Quiz trend: when no quiz was ever finished, links to the first chapter quiz (`/{locale}/knowledge/{firstChapter}`).
- Review efficiency: when the mistake log is empty and no review has ever been recorded, explains that quiz attempts feed the wrongbook and links to the first chapter quiz.
- Replay practice time: when no replay was ever done, links to `/{locale}/replay`.
- CTAs disappear as soon as real data exists (tests assert the toggle on finished quizzes / wrongbook entries).
- zh/en labels added (`ctaQuiz`/`ctaReview`/`ctaReplay`).

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/components/stats-client.test.tsx` passed (19 tests).
- Full suite: `npm test` passed with 136 test files and 1025 tests.
- Lint gate: `npm run lint -- --quiet` passed; typecheck gate passed; `npm run check:ai-copy` passed.
- PR #1 CI (vitest + mutation + deps + bundle + mobile) passed on `d9ace57`.

Next queue:

1. PR #1 remains open accumulating the R12 suite; keep batching and watch CI per push.
2. Continue the remaining R12 suite: R12.12 export versioning, R12.13 privacy settings entry review, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.9 Multi-device sync conflict notice

## 2026-09-11 — R12.9 Multi-device sync conflict notice

Implemented R12.9 as a truthful, auto-resolving conflict surface for multi-device sync:

- Added `src/lib/sync-conflicts.ts`: pure `detectMergeConflicts()` (daily-goal divergence when both sides explicitly set values, same-key wrongbook SRS/picked divergence with resolution direction), plus `tb-sync-conflicts` record/dismiss storage with per-timestamp dismissal so a genuinely new conflict set re-notifies.
- `hydrateFromCloud()` now computes conflicts from the pre-merge local snapshot vs. cloud rows and records them after every merge (empty conflicts clear prior records); failure paths never leave stale notices.
- The stats dashboard shows a dismissible "多设备同步提示 / Multi-device sync note" banner describing the automatic merge rules (local goal wins, newer review plan wins) instead of silently overwriting.
- Tests cover detection edge cases (one-side-unset is not a conflict, cloud-only keys ignored, resolution direction), storage/dismissal semantics, the hydrate wiring, and banner render/dismiss behavior.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/sync-conflicts.test.ts src/lib/sync-layer-hydrate.test.ts src/components/stats-client.test.tsx` passed.
- Full suite: `npm test` passed with 136 test files and 1025 tests.
- Lint gate: `npm run lint -- --quiet` passed; typecheck gate passed.

Next queue:

1. GitHub auth still needs reconnecting to push the R12 batches and watch CI on PR #1.
2. Continue the remaining R12 suite: R12.11 empty-state CTA review, R12.12 export versioning, R12.13 privacy settings, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.23 Stats consistency audit

## 2026-09-11 — R12.23 Stats consistency audit

Implemented R12.23 as a cross-aggregator reconciliation auditor plus dev-time diagnosis:

- Added `src/lib/stats-consistency.ts`: `auditStatsConsistency()` asserts the identities and range invariants that must hold when every stats widget reads the same local facts — course overview ↔ course trend (readDocs/doneChapters/totalDocs/completionPct), quiz done counts, replay rounds, wrong pending vs due/overdue ranges, and all percentage fields inside [0,100] or null.
- `StatsClient` runs the audit in non-production builds and `console.warn`s on drift (tree-shaken out of production bundles).
- Tests prove the real builders agree on a shared fixture (zero issues) and that the auditor catches course/quiz/replay/wrong drift, range inversions, out-of-range percentages, and missing inputs.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/stats-consistency.test.ts src/components/stats-client.test.tsx` passed.
- Full suite: `npm test` passed with 134 test files and 1015 tests.
- Lint gate: `npm run lint -- --quiet` passed; typecheck gate passed.

Next queue:

1. GitHub auth still needs reconnecting to push the R12 batches and watch CI on PR #1.
2. Continue the remaining R12 suite: R12.9 sync conflict notice, R12.11 empty-state CTA review, R12.12 export versioning, R12.13 privacy settings, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.8 Local/cloud data source labels

## 2026-09-11 — R12.8 Local/cloud data source labels

Implemented R12.8 as a truthful data-source indicator on the stats dashboard:

- Added `src/lib/cloud-sync-meta.ts`: `recordCloudSync()` / `getLastCloudSync()` for the last successful cloud-merge timestamp (`tb-last-cloud-sync`), corrupt-value safe.
- `hydrateFromCloud()` now records the timestamp after a successful merge (failed hydrations never fake a sync).
- The stats overview source pill is now dynamic: signed-out visitors see "本机数据 / This device"; signed-in users see "本机 + 云端 / Local + cloud" plus the last cloud-sync time (localized).
- Added zh/en labels and tests for the meta store, the hydrate wiring, and the signed-out rendering path.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/cloud-sync-meta.test.ts src/lib/sync-layer-hydrate.test.ts src/components/stats-client.test.tsx` passed.
- Full suite: `npm test` passed with 133 test files and 1010 tests.
- Lint gate: `npm run lint -- --quiet` passed.
- Typecheck gate: `npm run typecheck` passed.

Next queue:

1. GitHub auth still needs reconnecting to push R12.6–R12.8 batches and watch CI on PR #1.
2. Continue the remaining R12 suite: R12.9 sync conflict notice, R12.11 empty-state CTA review, R12.12 export versioning, R12.13 privacy settings, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.23 consistency checks, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.10 Time-range filter + R12.21 stats mobile layout gate

## 2026-09-11 — R12.10 Time-range filter + R12.21 stats mobile layout gate

Implemented R12.10 as a shared, persisted time-range filter for the four R12 trend sections, and turned R12.21 into an automated 320px gate for the stats page:

- Added `src/lib/stats-range.ts`: 7/30-day tiers with sanitizing read (invalid/missing → 7, read-only fallback), persisted `tb-stats-range-days`, and `tb-stats-range` broadcast event.
- `StatsClient` subscribes via `useSyncExternalStore` and re-aggregates all four trends (course completion, quiz score, review efficiency, replay time) at the selected range; charts switch to equal-width columns (`gridTemplateColumns` inline style, no Tailwind purge risk) and 30-day views get horizontal scroll containers so the 320px layout never overflows.
- Range toggle is keyboard/screen-reader accessible (`role="group"` + `aria-pressed`) and the course trend chart's accessible name now reflects the active range.
- R12.21: added `/zh/stats` and `/en/stats` to `check:mobile` (CI-gated 320px overflow regression) so every new stats component stays inside the mobile budget permanently.
- Added zh/en labels and tests for tier sanitization, persistence, event broadcast, toggle rendering, persisted 30-day re-aggregation, and grid column switching.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/stats-range.test.ts src/components/stats-client.test.tsx` passed.
- Full suite: `npm test` passed with 132 test files and 1004 tests.
- Lint gate: `npm run lint -- --quiet` passed.
- Typecheck gate: `npm run typecheck` passed.
- Mobile regression note: Playwright browser binaries cannot download inside this sandbox (cdn.playwright.dev blocked); `check:mobile` is extended and CI runs it with a real browser.

Next queue:

1. GitHub auth still needs reconnecting to push R12.6/R12.7/R12.10 commits and watch CI (PR #1 covers 74b9a1e).
2. Continue the remaining R12 suite: R12.8 local/cloud source labels, R12.9 sync conflict notice, R12.11 empty-state CTA review, R12.12 export versioning, R12.13 privacy settings, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.23 consistency checks, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.7 Personalized next learning suggestion

Implemented R12.7 as a deterministic, local-data-driven "Up next" suggestion (review dues > next unread > chapter quiz > replay warm-up):

- Added `src/lib/next-suggestion.ts`: `buildNextSuggestion()` pure decision function with localized hrefs, context titles, and honest reasons (`due-reviews` / `next-unread` / `chapter-quiz` / `replay-warmup` / `all-clear`).
- Stats page now serves chapter titles and doc metadata into `StatsClient`; the suggestion renders as a highlighted card directly under the learning overview section, recomputed from live local data on every progress event.
- Distinct from `/path`'s `TodayPick`: that one only considers reading progress, while R12.7 weighs SRS dues, quizzes, and replay practice.
- Added zh/en labels and fixture coverage for priority order, replay warm-up threshold (<3 rounds), corrupt inputs, slug fallbacks, and stats-page rendering of all three main branches.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/next-suggestion.test.ts src/components/stats-client.test.tsx` passed with 2 files and 17 tests.
- Full suite: `npm test` passed with 131 test files and 999 tests.
- Lint gate: `npm run lint -- --quiet` passed; `npm run check:ai-copy` passed.
- Typecheck gate: `npm run typecheck` passed.

Next queue:

1. GitHub auth in this sandbox expired mid-session (push + gh both rejected); local commits continue to accumulate on `arena/01a08e2f-trade-buty` and will be pushed once the connection is restored. PR #1 CI (run 34556180299, commit 74b9a1e) was still pending when the token lapsed — Vercel preview had already passed.
2. On reconnect: push, watch CI for 74b9a1e → 43a62fc → new R12.7 commit, fix any failures.
3. Continue the remaining R12 suite: R12.8 local/cloud source labels, R12.9 sync conflict notice, R12.10 time-range filters, R12.11 empty-state CTA review, R12.12 export versioning, R12.13 privacy settings, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.21 mobile layout, R12.23 consistency checks, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.6 Gentle streak recovery prompt

Implemented R12.6 as a fact-only, action-oriented recovery card (distinct from R4.3's fact reassurance inside DailyGoal):

- Added `src/lib/streak-recovery.ts`: `buildStreakRecovery()` pure decision function — shows only when the streak actually broke AND today has zero study minutes (hides automatically once the user restarts, so no nagging).
- Action priority derived from real local data: due SRS reviews first, then continue an unfinished chapter, else a replay warm-up; capped at two actions with localized hrefs.
- Added `src/components/streak-recovery-card.tsx` on `/[locale]/stats` with useSyncExternalStore subscriptions (auto-hides when today goes above zero), a per-day "later" dismiss (`tb-recovery-dismissed`), and accessible section labeling.
- Added zh/en stats labels for the recovery card.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/streak-recovery.test.ts src/components/streak-recovery-card.test.tsx src/components/stats-client.test.tsx` passed with 3 files and 18 tests.
- Full suite: `npm test` passed with 130 test files and 990 tests.
- Lint gate: `npm run lint -- --quiet` passed; `npm run check:ai-copy` passed.
- Typecheck gate: `npm run typecheck` passed.

Next queue:

1. Watch GitHub Actions on PR #1 and fix any failures.
2. Continue R12.7 personalized next suggestions and the remaining R12 retention suite: R12.8 local/cloud source labels, R12.9 sync conflict notice, R12.10 time-range filters, R12.11 empty-state CTA review, R12.12 export versioning, R12.13 privacy settings, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.21 mobile layout, R12.23 consistency checks, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.5 Replay practice time trend

Implemented R12.5 as local-data-first replay practice duration statistics with no fabricated durations:

- Extended `ReplayRecord` with optional `durationSec`; `replay-trainer` now records the measured round elapsed seconds (only when a round-start timestamp exists, capped at 8h).
- Added `src/lib/replay-time-trend.ts` as a versioned pure aggregator over local replay history: per-day rounds/duration/accuracy buckets, in-range summary, all-time totals, and best streak (merged with `tb-replay-best` at render time).
- Kept legacy semantics honest: rounds always count from real `at` timestamps, but old records without `durationSec` report `hasDurations: false` + warning `no-round-durations` and zero duration — never estimated.
- Integrated an accessible replay time section into `/[locale]/stats`: daily bars (duration labels), rounds in range, time in range, average per round, best streak, and a legacy no-duration notice.
- Added zh/en stats labels for the replay time section.
- Added tests for day bucketing, accuracy clamping, duration sanitization (negative/NaN/8h cap), legacy no-duration warnings, empty history, corrupt entries, range clamping, and stats-page rendering.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/replay-time-trend.test.ts src/components/stats-client.test.tsx` passed with 2 files and 15 tests.
- Full suite: `npm test` passed with 128 test files and 980 tests.
- Lint gate: `npm run lint -- --quiet` passed.
- Typecheck gate: `npm run typecheck` passed.
- Build gate: `npm run build` passed (Turbopack) with `/zh/stats` and `/en/stats` routes; bundle budget all green including `zh/stats` 306KB/320KB.
- Sandbox note: fonts.googleapis.com is unreachable from this dev sandbox, so the local build was verified with Geist temporarily self-hosted via `next/font/local`; committed code keeps the unchanged `next/font/google` layout and CI remains the authoritative build gate.

Next queue:

1. Watch GitHub Actions for R12.4+R12.5 and fix any failures.
2. Continue the remaining R12 retention suite: R12.6 streak recovery prompt, R12.7 personalized next suggestions, R12.8 local/cloud source labels, R12.9 sync conflict notice, R12.10 time-range filters, R12.11 empty-state CTA review, R12.12 export versioning, R12.13 privacy settings, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.21 mobile layout, R12.23 consistency checks, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.4 Wrongbook review efficiency (+R12.22 stats page bundle budget)

Implemented R12.4 as local-data-first wrongbook review efficiency statistics with no fabricated review dates, and landed the R12.22 stats-page performance budget work needed to ship it:

- Added `src/lib/review-attempt-ledger.ts`: `tb-review-attempts` local ledger (capped at 300 entries), written by `applySrsResult()` for every SRS answer — both correct/mastered and reset outcomes — with idempotent same-timestamp writes.
- Added `src/lib/wrongbook-efficiency.ts` as a versioned pure aggregator over the current wrongbook (authoritative pending state) and the review ledger: per-day reviews/correct/mastered buckets with accuracy, due-today/overdue backlog from SRS fields (backfill semantics consistent with `effectiveSrs`), average stage progress, and mastered totals.
- Kept legacy semantics honest: without a ledger the section reports `dataSource: "current-wrongbook-only"`, `hasLedger: false`, warning `no-review-dates`, and still shows live due/pending counts — no invented dates.
- Integrated an accessible review efficiency section into `/[locale]/stats` with a stacked correct/total mini chart and summary cards (reviews, accuracy, mastered, due now).
- R12.22: extracted the entire stats dictionary from `src/lib/i18n.ts` into `src/lib/i18n-stats.ts` (imported only by the stats page) so stats copy no longer inflates every route's shared chunk; added a dedicated `zh/stats` budget (320KB, measured 306KB) to `check-bundle.mjs`; extended `check-ai-copy.mjs` to scan both dictionary files.
- Added zh/en labels and deep-parity + no-CJK tests for the split stats dictionary.
- Added tests for trend bucketing, due/overdue/backfill semantics, corrupt/unknown entries, range clamping, ledger idempotency/capping, SRS ledger wiring, and stats-page rendering.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/wrongbook-efficiency.test.ts src/lib/review-attempt-ledger.test.ts src/components/stats-client.test.tsx src/lib/i18n-stats.test.ts src/lib/i18n.test.ts src/lib/wrongbook.test.ts` passed.
- Full suite: `npm test` passed with 128 test files and 980 tests.
- Lint gate: `npm run lint -- --quiet` passed.
- Typecheck gate: `npm run typecheck` passed.
- Build gate: `npm run build` passed (Turbopack); `npm run check:bundle` all green (home back to 295KB after the dictionary split).
- Bundle regression found and fixed during this task: pre-split dictionary additions pushed home routes to 297KB (>295KB budget); the i18n-stats extraction both fixed the budget and delivers R12.22.

# Progress (archived earlier entries below)

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
