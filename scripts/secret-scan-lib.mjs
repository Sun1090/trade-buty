const SECRET_RULES = [
  {
    id: "private-key",
    label: "私钥文件头",
    pattern: /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/g,
  },
  {
    id: "aws-access-key",
    label: "AWS access key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    id: "github-token",
    label: "GitHub token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{22,255})\b/g,
  },
  {
    id: "openai-key",
    label: "OpenAI API key",
    pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: "stripe-live-secret",
    label: "Stripe live secret",
    pattern: /\bsk_live_[A-Za-z0-9]{20,}\b/g,
  },
  {
    id: "google-api-key",
    label: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    id: "slack-token",
    label: "Slack token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    id: "jwt",
    label: "JWT",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    id: "literal-secret-assignment",
    label: "疑似硬编码密钥赋值",
    pattern:
      /(?:^|[\s{,;])(?:[A-Za-z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PASSWD|SERVICE_ROLE_KEY)[A-Za-z0-9_]*)\s*[:=]\s*(['"`])([^'"`\n]{16,})\1/g,
    valueGroup: 2,
  },
  {
    id: "literal-secret-assignment",
    label: "疑似硬编码密钥赋值",
    pattern:
      /(?:^|[\s{,;])(?:[A-Za-z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PASSWD|SERVICE_ROLE_KEY)[A-Za-z0-9_]*)\s*[:=]\s*([A-Za-z0-9_./+=-]{16,})(?=\s*(?:$|[#;,\n]))/gm,
    valueGroup: 1,
  },
];

const PLACEHOLDER_PATTERNS = [
  /^(?:your|my|the|replace|change|example|sample|dummy|fake|test|mock|demo)(?:[_-].*)?$/i,
  /^(?:<[^>]+>|\{\{.*\}\}|\$\{.*\}|process\.env\.[A-Z0-9_]+|import\.meta\.env\.[A-Z0-9_]+)$/,
  /^(?:redacted|placeholder|changeme|secret|password|token|api[_-]?key)$/i,
  /^(?:x{3,}|0{3,}|_+|-+)$/,
  /\b(?:test|dummy|fake|mock|demo|example|sample|placeholder|redacted)\b/i,
];

export function isLikelyPlaceholder(value) {
  const normalized = String(value).trim();
  if (!normalized) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function locationAt(text, index) {
  const before = text.slice(0, index);
  const lines = before.split("\n");
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

export function scanText(text, file = "<memory>") {
  const findings = [];
  const seen = new Set();

  for (const rule of SECRET_RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = rule.valueGroup ? match[rule.valueGroup] : match[0];
      if (rule.valueGroup && isLikelyPlaceholder(value)) continue;

      const valueOffset = rule.valueGroup ? match[0].lastIndexOf(value) : 0;
      const index = match.index + Math.max(valueOffset, 0);
      const location = locationAt(text, index);
      const key = `${rule.id}:${location.line}:${location.column}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ file, rule: rule.id, label: rule.label, ...location });
    }
  }

  return findings.sort((a, b) => a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule));
}

export { SECRET_RULES };
