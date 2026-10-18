import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import { ignores } from './eslint.config.mjs';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: [...ignores, '**/__tests__/**', 'testing/e2e/**'] },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    linterOptions: { reportUnusedDisableDirectives: false },
    plugins: { sonarjs, 'react-refresh': reactRefresh },
    rules: {
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-element-overwrite': 'error',
      'sonarjs/no-collection-size-mischeck': 'error',
      'sonarjs/no-empty-collection': 'error',
      'sonarjs/no-inverted-boolean-check': 'error',
      'sonarjs/no-redundant-jump': 'error',
      'sonarjs/no-useless-catch': 'error',
      'sonarjs/cognitive-complexity': ['error', 30],
    },
  },
];
