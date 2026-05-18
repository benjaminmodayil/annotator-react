export const restrictedSyntaxSelectors = Object.freeze({
  directConsole: {
    message:
      "Use the application logger instead of direct console calls outside scripts, config, and tests.",
    selector: 'CallExpression[callee.object.name="console"]',
  },
  jsonParseBoundary: {
    message:
      "Prefer schema-validated JSON parsing at boundaries (Zod/TypeBox/etc.).",
    selector:
      'CallExpression[callee.object.name="JSON"][callee.property.name="parse"]',
  },
  processEnvBoundary: {
    message:
      "Read process.env only in a validated environment boundary module, then import typed config elsewhere.",
    selector: 'MemberExpression[object.name="process"][property.name="env"]',
  },
  throwingBareError: {
    message:
      "Throw typed/domain errors so callers can handle failures intentionally.",
    selector: 'ThrowStatement > NewExpression[callee.name="Error"]',
  },
});

export function mergeRestrictedSyntaxRules(severity, ...rulesOrSelectors) {
  const selectors = [];

  for (const ruleOrSelector of rulesOrSelectors) {
    if (!ruleOrSelector) {
      continue;
    }

    if (Array.isArray(ruleOrSelector)) {
      selectors.push(...ruleOrSelector.slice(1));
      continue;
    }

    selectors.push(ruleOrSelector);
  }

  return restrictedSyntaxRule(severity, ...selectors);
}

export function restrictedSyntaxRule(severity, ...selectors) {
  return [severity, ...selectors.filter(Boolean)];
}
