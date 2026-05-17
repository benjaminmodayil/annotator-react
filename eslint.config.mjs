import tsParser from '@typescript-eslint/parser';
import perfectionist from 'eslint-plugin-perfectionist';

const perfectionistLineLength = perfectionist.configs['recommended-line-length'];

const warnPerfectionistRules = Object.fromEntries(
  Object.entries(perfectionistLineLength.rules).map(([ruleName, ruleConfig]) => [
    ruleName,
    Array.isArray(ruleConfig) ? ['warn', ...ruleConfig.slice(1)] : 'warn',
  ]),
);

export default [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'examples/vite-react/dist/**'],
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      sourceType: 'module',
    },
    plugins: perfectionistLineLength.plugins,
    rules: warnPerfectionistRules,
  },
];
