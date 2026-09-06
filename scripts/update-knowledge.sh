#!/usr/bin/env bash
# 知识库更新 + 回归验证一条龙
# 用法: npm run kb:update  （在仓库根目录执行）
set -e
cd "$(dirname "$0")/.."

echo "▶ [1/6] 拉取知识库最新内容"
git submodule update --remote content/kline-buty

echo "▶ [2/6] changelog 自动片段（R10.7，对比上次内容快照）"
node scripts/check-kb-changelog.mjs

echo "▶ [3/6] kb 产物 diff 摘要 + changelog 草稿"
node scripts/kb-diff.mjs --update --changelog docs/kb-changelog-draft.md

echo "▶ [4/6] 契约校验"
node scripts/validate-knowledge-contract.mjs

echo "▶ [5/6] 同步资产与搜索索引"
node scripts/sync-knowledge-assets.mjs
node scripts/generate-search-index.mjs

echo "▶ [6/6] 构建回归验证"
npm run build

echo ""
echo "✅ 全部通过。如知识库有新提交，记得单独 commit submodule 指针："
NEW=$(git -C content/kline-buty rev-parse --short HEAD)
echo "   git add content/kline-buty && git commit -m \"chore: sync knowledge base to kline-buty@$NEW\""
