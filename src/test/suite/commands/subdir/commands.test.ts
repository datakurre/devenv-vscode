import { strict as assert } from 'assert'
import path from 'path'

import vscode from 'vscode'

import { workspaceRoot } from '.'

context('commands in the subdirectory workspace', function () {
	const file = path.join(workspaceRoot, 'devenv.nix')

	context('without open editors', function () {
		specify('devenv.open opens the devenv.nix file', async function () {
			await vscode.commands.executeCommand('devenv.open')
			const filePath = vscode.window.activeTextEditor?.document.fileName
			assert.equal(filePath, file)
		})
	})
})
