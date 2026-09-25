import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const featureNames = ['search', 'show-details', 'watch-tracking', 'comments', 'bee-review'];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict, jsxA11y.flatConfigs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  // Feature-folder boundaries: a feature never imports another feature.
  ...featureNames.map((feature) => ({
    files: [`src/features/${feature}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: featureNames.filter((f) => f !== feature).map((f) => `@/features/${f}*`),
              message: 'Features are self-contained. Compose features in src/pages or src/app.',
            },
            { group: ['@/pages*', '@/app*'], message: 'Features must not depend on pages/app.' },
          ],
        },
      ],
    },
  })),
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/features*', '@/pages*', '@/app*'], message: 'shared is a leaf layer.' }] },
      ],
    },
  },
);
