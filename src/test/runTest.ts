import fs from 'fs/promises'
import path from 'path'

import { runTests } from '@vscode/test-electron'

const workspaces = ['.', 'subdir']

const extensionDevelopmentPath = path.resolve(__dirname, '../..')
const extensionTestsEnv = { ['PREDEFINED']: 'value' }

async function test(extensionTestsPath: string, workspacePath: string) {
	const disableExtensions = '--disable-extensions'
	const launchArgs = [workspacePath, disableExtensions]
	await runTests({ extensionDevelopmentPath, extensionTestsPath, extensionTestsEnv, launchArgs })
}

async function suiteExists(suitePath: string): Promise<boolean> {
	try {
		await fs.access(suitePath)
		return true
	} catch {
		return false
	}
}

/**
 * Discovers available test suites by scanning the suite directory for
 * subdirectories that contain an index file.  This means adding a new suite
 * only requires creating the directory — no changes to this runner are needed.
 */
async function discoverSuites(): Promise<string[]> {
	const suiteDir = path.resolve(__dirname, 'suite')
	const entries = await fs.readdir(suiteDir, { withFileTypes: true })
	const suites: string[] = []
	for (const entry of entries) {
		if (!entry.isDirectory()) continue
		const indexJs = path.join(suiteDir, entry.name, 'index.js')
		if (await suiteExists(indexJs)) {
			suites.push(entry.name)
		}
	}
	return suites
}

async function main(requestedSuites: string[]) {
	const allSuites = requestedSuites.length ? requestedSuites : await discoverSuites()
	let failed = false
	for (const suite of allSuites) {
		for (const workspace of workspaces) {
			const suitePath = path.resolve(__dirname, `suite/${suite}/${workspace}/`)
			const workspacePath = path.resolve(__dirname, `../../test/workspace/${workspace}`)
			if (!(await suiteExists(suitePath))) continue
			try {
				await test(suitePath, workspacePath)
			} catch {
				failed = true
			}
		}
	}
	if (failed) {
		console.error('Failed to run tests')
		process.exit(1)
	}
}

const [, , ...suites] = process.argv
void main(suites)
