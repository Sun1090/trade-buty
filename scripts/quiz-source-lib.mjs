import ts from "typescript";

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
  return literalText(node.argumentExpression);
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
