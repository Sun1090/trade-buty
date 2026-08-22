#!/usr/bin/env bash
# 知识库更新 + 回归验证一条龙
# 用法: npm run kb:update  （在仓库根目录执行）
set -e
cd "$(dirname "$0")/.."

echo "▶ [1/4] 拉取知识库最新内容"
git submodule update --remote content/kline-buty

echo "▶ [2/4] 契约校验"
node scripts/validate-knowledge-contract.mjs

echo "▶ [3/4] 同步资产与搜索索引"
node scripts/sync-knowledge-assets.mjs
node scripts/generate-search-index.mjs

echo "▶ [4/4] 构建回归验证"
npm run build

echo ""
echo "✅ 全部通过。如知识库有新提交，记得单独 commit submodule 指针："
NEW=$(git -C content/kline-buty rev-parse --short HEAD)
echo "   git add content/kline-buty && git commit -m \"chore: sync knowledge base to kline-buty@$NEW\""
