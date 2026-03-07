// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
	{
		ignores: ['out/**', 'dist/**', '**/*.d.ts'],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	...tseslint.configs.strict,
	...tseslint.configs.stylistic,
	prettierConfig,
	{
		languageOptions: {
			parserOptions: {
				project: './tsconfig.json',
			},
		},
		rules: {
			'@typescript-eslint/consistent-type-definitions': ['error', 'type'],
			eqeqeq: 'error',
			'no-throw-literal': 'error',
		},
	},
)
