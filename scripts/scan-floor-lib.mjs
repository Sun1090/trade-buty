/**
 * R16.83：计数型门禁共用的「扫描下限」。
 *
 * 一条门禁说「通过」时，它真正证明的范围取决于**它扫到了多少东西**。扫不到的那部分
 * 不会留下任何痕迹：目录改名、glob 失效、子模块没拉下来，都只会让分母变小，然后
 * 门禁对着越来越小的集合判绿。这类自伤本仓库已经踩了三次（R16.81 的注释让整张字典
 * 接口退出检查、R16.82 的下限远低于实测值、以及这里逐条实测出来的五道门禁）。
 *
 * 下限只卡「少扫」，而且只卡**跌破地板的那部分少扫**：新增文件永远不需要动这里；删掉
 * 一批文件时，只有当数量落到地板以下才会红，落在地板以上的缩小当场不响。地板以上的
 * 缩小由 `check-scan-counts.mjs` 那份基线台账负责（R16.146）：每一处 `recordScanCount`
 * 登记的数量与上一次入库的那一个相比，**变小就红**，要认这次缩小得显式跑
 * `npm run check:scan-counts -- --accept-shrink` 并把理由写进提交信息。
 * 每个下限旁边都写着实测当天的真实数量：脱离实测的下限要么形同虚设，要么第一天就红。
 */
import fs from "node:fs";

/**
 * @param {number} count 本次实际扫到的数量
 * @param {number} floor 允许的下限（必须为正整数：0 意味着永远不会响）
 * @param {string} what 被数的东西，用于报错文案（如「知识库 md 文件」）
 * @returns {string|null} 越界时返回一行说明，未越界返回 null
 */
export function scanFloorViolation({ count, floor, what }) {
  if (!Number.isInteger(floor) || floor < 1) {
    throw new Error(
      `「${what}」的扫描下限写成了 ${String(floor)}：下限必须是正整数，0 或负数意味着这道检查永远不会响`,
    );
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(
      `「${what}」的扫描数量是 ${String(count)}：不是非负整数说明计数本身坏了（例如目录缺失后 walk() 返回 undefined），不能当成 0 放过去`,
    );
  }
  if (count >= floor) return null;
  return `「${what}」本次只扫到 ${count} 个，下限 ${floor} 个（少 ${floor - count}）。扫描范围不会无缘无故缩小：先确认被扫的目录还在、glob 没写错、子模块已 init，再考虑改下限。`;
}

/**
 * R16.146：把「这一处扫描本次数到了多少」登记进基线台账。
 *
 * 只在聚合器 `check-scan-counts.mjs` 子进程里生效（它设 `SCAN_COUNTS_FILE`）；平时这道
 * 调用是 no-op，五道门禁的行为与登记之前完全一致。**数的是同一个变量**：调用点就贴在
 * `scanFloorViolation` 旁边，用的正是门禁自己判绿时读的那个 `count`，所以台账里的数字
 * 与门禁当场量到的数字不会是两套口径。少登记一处，聚合器那一侧就会少一行——它的
 * `MIN_KEYS` 地板正是为这种「登记点自己不见了」准备的。
 *
 * @param {{key: string, count: number, floor: number, what: string}} row
 */
export function recordScanCount({ key, count, floor, what }) {
  const target = process.env.SCAN_COUNTS_FILE;
  if (!target) return;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(key))) {
    throw new Error(`扫描基线的键名要小写短横线（如 kb-md-files），收到「${String(key)}」：键是台账里唯一的定位符，不能含空格、中文或大写`);
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`「${key}」本次数量是 ${String(count)}：不是非负整数，登记进台账只会把坏掉的计数伪装成基线`);
  }
  if (!Number.isInteger(floor) || floor < 1) {
    throw new Error(`「${key}」的地板是 ${String(floor)}：登记进台账的硬下限必须是正整数，否则台账里那一栏是假的`);
  }
  if (!String(what).trim()) {
    throw new Error(`「${key}」没写被数的东西：台账里那一行要能让人知道这个数是什么的个数`);
  }
  fs.appendFileSync(target, `${JSON.stringify({ key, count, floor, what })}\n`);
}
