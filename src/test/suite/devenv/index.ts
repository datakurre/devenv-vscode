import { runSuite, workspaceRoot } from '..'

export { workspaceRoot }

export async function run() {
	await runSuite(workspaceRoot, __dirname)
}
