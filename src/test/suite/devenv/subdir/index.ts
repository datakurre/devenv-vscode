import path from 'path'

import { runSuite, workspaceRoot as rootWorkspace } from '../..'

export const workspaceRoot = path.join(rootWorkspace, 'subdir')

export async function run() {
	await runSuite(workspaceRoot, __dirname)
}
