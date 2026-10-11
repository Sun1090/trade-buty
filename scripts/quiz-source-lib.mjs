import ts from "typescript";

/**
 * 固定题库「每章最少几道题」的下限（R6.4 定的纪律）。
 *
 * 它此前只以字面量 `3` 活在 `check-quiz-coverage.mjs` 的判断里，而 `docs/ops.md`、
 * `docs/perf-notes.md` 两处文档都把它抄成了一句现行说法——某一章把纪律提到 5 道，
 * 那两句不会红。抽成导出的常量就是给它立主人：门禁读它，文档登记也由它对账（R16.315）。
 */
export const MIN_QUESTIONS_PER_CHAPTER = 3;

function literalText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isIdentifier(node)) return node.text;
  return null;
}

function propertyValue(object, name) {
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (literalText(property.name) === name) return property.initializer;
  }
  return null;
}

function readStringProperty(object, name) {
  const value = propertyValue(object, name);
  return value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
    ? value.text
    : null;
}

function readQuestionCount(object) {
  const value = propertyValue(object, "questions");
  return value && ts.isArrayLiteralExpression(value) ? value.elements.length : null;
}

function toEntry(key, object) {
  if (!key || !object || !ts.isObjectLiteralExpression(object)) return null;
  return {
    key,
    chapterNum: readStringProperty(object, "chapterNum"),
    docSlug: readStringProperty(object, "docSlug"),
    questionCount: readQuestionCount(object),
  };
}

function readElementAccessKey(node) {
  if (!ts.isElementAccessExpression(node)) return null;
  if (!ts.isIdentifier(node.expression) || node.expression.text !== "QUIZZES") return null;
  const key = node.argumentExpression;
  return key && (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key))
    ? key.text
    : null;
}

/**
 * Parse chapter quiz mounts without importing TypeScript source or relying on
 * brittle cross-block regular expressions.
 */
export function parseQuizMounts(source, fileName = "quizzes.ts") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const entries = [];

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "QUIZZES") continue;
        if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) continue;
        for (const property of declaration.initializer.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const entry = toEntry(literalText(property.name), property.initializer);
          if (entry) entries.push(entry);
        }
      }
      continue;
    }

    if (!ts.isExpressionStatement(statement) || !ts.isBinaryExpression(statement.expression)) {
      continue;
    }
    const assignment = statement.expression;
    if (assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken) continue;
    const key = readElementAccessKey(assignment.left);
    const entry = toEntry(key, assignment.right);
    if (entry) entries.push(entry);
  }

  return entries;
}
