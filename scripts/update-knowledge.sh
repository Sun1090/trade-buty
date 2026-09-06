#!/usr/bin/env bash
# 知识库更新 + 回归验证一条龙
# 用法: npm run kb:update  （在仓库根目录执行）
set -e
cd "$(dirname "$0")/.."

# R10.18：记录「更新前」的版本视图（仓库记录指针 + 工作区 HEAD），供末尾对比提示
RECORDED_BEFORE=$(git ls-files -s -- content/kline-buty | awk '$1=="160000"{print $2; exit}')
WORKING_BEFORE=$(git -C content/kline-buty rev-parse HEAD 2>/dev/null || echo "")

echo "▶ [1/6] 拉取知识库最新内容"
echo "   上游版本（更新前）: $(git -C content/kline-buty rev-parse --short HEAD 2>/dev/null || echo 无)"
git submodule update --remote content/kline-buty

WORKING_AFTER=$(git -C content/kline-buty rev-parse HEAD)
if [ "$WORKING_BEFORE" = "$WORKING_AFTER" ]; then
  echo "   （上游无新提交，仍为 ${WORKING_AFTER:0:7}）"
else
  echo "   上游版本（更新后）: ${WORKING_AFTER:0:7}"
fi

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
echo "✅ 全部通过。"
echo ""
echo "📦 上游版本变更提示（R10.18）："
echo "   仓库记录指针  : ${RECORDED_BEFORE:0:7}"
echo "   本次已更新至  : ${WORKING_AFTER:0:7}"
if [ "$RECORDED_BEFORE" = "$WORKING_AFTER" ]; then
  echo "   （仓库指针已是最新，无需提交指针）"
else
  echo "   ⚠️  仓库指针落后于工作区内容——必须连同下面文件一起提交，否则 CI（recursive checkout）会退回旧版内容："
  echo "       git add content/kline-buty scripts/kb-manifest.json docs/kb-changelog-draft.md"
  echo "       git commit -m \"chore: sync knowledge base to kline-buty@${WORKING_AFTER:0:7}\""
  echo "   📋 提交前本地门禁：npm run check:kb-pointer && npm run test && npm run typecheck"
  echo "       （KB 结构有变时另跑 npm run check:glossary / check:slug-conflicts / check:nav-chain）"
fi
