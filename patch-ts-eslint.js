/* eslint-disable */
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const packagesToPatch = [
	'typescript-eslint',
	'@typescript-eslint/eslint-plugin',
	'@typescript-eslint/parser',
	'@typescript-eslint/type-utils',
	'@typescript-eslint/typescript-estree',
	'@typescript-eslint/utils',
	'ts-api-utils',
]

for (const pkg of packagesToPatch) {
	const pkgPath = path.join(__dirname, 'node_modules', pkg)
	if (fs.existsSync(pkgPath)) {
		console.log(`Injecting typescript@5.9.3 into ${pkg}...`)
		try {
			execSync('npm install typescript@5.9.3 --no-save --no-package-lock --legacy-peer-deps', {
				cwd: pkgPath,
				stdio: 'inherit',
			})
		} catch (e) {
			console.error(`Failed to inject into ${pkg}`)
		}
	}
}
