// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
	{
		ignores: ['out/**', 'dist/**', '**/*.d.ts', '.vscode-test/**'],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	...tseslint.configs.strict,
	...tseslint.configs.stylistic,
	{
		...tseslint.configs.recommendedTypeChecked[1],
		files: ['src/**/*.ts'],
	},
	prettierConfig,
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/consistent-type-definitions': ['error', 'type'],
			eqeqeq: 'error',
			'no-throw-literal': 'error',
		},
	},
)
