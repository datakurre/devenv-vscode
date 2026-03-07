import path from 'path'

import vscode from 'vscode'

import { workspaceRoot } from '.'
import { assertEnvironmentIsLoaded } from '../assertions'

/**
 * Polls `condition` every `intervalMs` until it resolves without throwing or
 * `timeoutMs` elapses, at which point the last error is re-thrown.
 */
async function waitUntil(
	condition: () => Promise<void>,
	{ intervalMs = 500, timeoutMs = 30_000 } = {},
): Promise<void> {
	const deadline = Date.now() + timeoutMs
	let lastError: unknown
	while (Date.now() < deadline) {
		try {
			await condition()
			return
		} catch (err) {
			lastError = err
			await new Promise((resolve) => setTimeout(resolve, intervalMs))
		}
	}
	throw lastError
}

context('custom environments in the test workspace', function () {
	beforeEach(async function () {
		// XXX the environment is only loaded after opening an existing file?
		const file = path.join(workspaceRoot, 'file.txt')
		await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(file))
	})

	specify('devenv.reload loads the custom environment', async function () {
		await vscode.commands.executeCommand('devenv.reload')
		await assertEnvironmentIsLoaded()
	})

	specify('changing a watched file reloads the custom environment', async function () {
		await vscode.commands.executeCommand('devenv.reload')
		const watched = vscode.Uri.file(path.join(workspaceRoot, 'devenv.local.nix'))
		await vscode.workspace.fs.writeFile(watched, new TextEncoder().encode('{ pkgs, ... }: { env.VARIABLE = pkgs.lib.mkForce ""; }'))
		await waitUntil(() => assertEnvironmentIsLoaded(), { timeoutMs: 30_000 })
	})
})
