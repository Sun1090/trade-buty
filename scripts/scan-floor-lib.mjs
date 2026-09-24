/**
 * R16.83：计数型门禁共用的「扫描下限」。
 *
 * 一条门禁说「通过」时，它真正证明的范围取决于**它扫到了多少东西**。扫不到的那部分
 * 不会留下任何痕迹：目录改名、glob 失效、子模块没拉下来，都只会让分母变小，然后
 * 门禁对着越来越小的集合判绿。这类自伤本仓库已经踩了三次（R16.81 的注释让整张字典
 * 接口退出检查、R16.82 的下限远低于实测值、以及这里逐条实测出来的五道门禁）。
 *
 * 下限只卡「少扫」，而且只卡**跌破地板的那部分少扫**：新增文件永远不需要动这里；删掉
 * 一批文件时，只有当数量落到地板以下才会红，落在地板以上的缩小当场不响（2026-09-25
 * 实测余量：`MIN_LISTED_FILES` 700 对 771、`MIN_KB_FILES` 400 对 419）。所以要真的删掉
 * 一批，仍需人自己改这个数并在提交信息里说清楚——地板替他响一次铃，不替他看账。
 * 每个下限旁边都写着实测当天的真实数量：脱离实测的下限要么形同虚设，要么第一天就红。
 */

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
