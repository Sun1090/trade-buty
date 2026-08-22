import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const knowledgeRoot = path.join(root, "content/kline-buty/docs/knowledge");
const publicAssets = path.join(root, "public/knowledge-assets");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function main() {
  if (!fs.existsSync(knowledgeRoot)) {
    console.error(
      "[sync-knowledge-assets] content/kline-buty/docs/knowledge/ 不存在。" +
        "请先执行: git submodule update --init"
    );
    process.exit(1);
  }
  if (fs.existsSync(publicAssets)) {
    fs.rmSync(publicAssets, { recursive: true, force: true });
  }
  let count = 0;
  for (const locale of ["zh", "en"]) {
    const localeRoot = path.join(knowledgeRoot, locale);
    if (!fs.existsSync(localeRoot)) continue;
    for (const chapter of fs.readdirSync(localeRoot, { withFileTypes: true })) {
      if (!chapter.isDirectory()) continue;
      const assetsDir = path.join(localeRoot, chapter.name, "_assets");
      if (fs.existsSync(assetsDir)) {
        copyDir(assetsDir, path.join(publicAssets, locale, chapter.name));
        count++;
      }
    }
  }
  console.log(`[sync-knowledge-assets] synced ${count} asset dirs`);
}

main();
