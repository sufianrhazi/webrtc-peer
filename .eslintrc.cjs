module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 13,
        sourceType: 'module',
        ecmaFeatures: {},
    },
    plugins: ['@typescript-eslint'],
    settings: {
    },
    rules: {
        '@typescript-eslint/no-explicit-any': 0,
        '@typescript-eslint/no-empty-function': 0,
        '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
        'no-unused-vars': ['warn', { args: 'none' }],
        '@typescript-eslint/ban-ts-comment': 0,
        '@typescript-eslint/consistent-type-imports': 'error',
    },
    overrides: [
    ],
};
