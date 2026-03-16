import path from 'path'
import vscode from 'vscode'
import { checksum } from './checksum'
import * as command from './command'
import config from './config'
import * as devenv from './devenv'
import { Data } from './devenv'
import * as status from './status'

const enum Cached {
	checksum = 'devenv.checksum',
	environment = 'devenv.environment',
	cwdOverride = 'devenv.cwdOverride',
}
type EnvCache = [string, string | undefined][]

const installationUri = vscode.Uri.parse('https://devenv.sh/getting-started')

/**
 * Represents the original value of a tracked environment variable:
 * - `{ existed: false }` — the variable was not set before devenv loaded it (newly added)
 * - `{ existed: true; value: string }` — the variable had a previous value
 */
type OriginalValue = { existed: false } | { existed: true; value: string }

class Devenv implements vscode.Disposable {
	private output = vscode.window.createOutputChannel('devenv')
	private backup = new Map<string, OriginalValue>()
	private willLoad = new vscode.EventEmitter<void>()
	private didLoad = new vscode.EventEmitter<Data>()
	private loaded = new vscode.EventEmitter<void>()
	private failed = new vscode.EventEmitter<unknown>()
	private didUpdate = new vscode.EventEmitter<void>()
	private cwdOverride: string | undefined = undefined
	private watchers = vscode.Disposable.from()
	/** Keys that were already in effect before this load cycle began. */
	private knownKeys = new Set<string>()
	/** True when the current load follows a restore (cache hit) — environment already applied. */
	private isRestoreCycle = false

	constructor(
		private context: vscode.ExtensionContext,
		private status: status.Item,
	) {
		this.willLoad.event(() => this.onWillLoad())
		this.didLoad.event((e) => this.onDidLoad(e))
		this.loaded.event(() => this.onLoaded())
		this.failed.event((e) => this.onFailed(e))
		this.didUpdate.event(() => this.onDidUpdate())
	}

	private get environment() {
		return this.context.environmentVariableCollection
	}

	private get cache() {
		return this.context.workspaceState
	}

	dispose() {
		this.output.dispose()
		this.status.dispose()
		this.watchers.dispose()
	}

	async open(filePath?: string) {
		filePath ??= path.join(devenv.cwd(), 'devenv.nix')
		const uri = await uriFor(filePath)
		await vscode.commands.executeCommand('vscode.open', uri)
	}

	async configurationChanged(event: vscode.ConfigurationChangeEvent) {
		if (!config.isAffectedBy(event)) return
		if (
			config.path.isAffectedBy(event) ||
			config.extraEnv.isAffectedBy(event) ||
			config.profile.isAffectedBy(event)
		) {
			await this.reload()
		}
		if (config.status.isAffectedBy(event)) {
			this.status.refresh()
		}
	}

	async reload() {
		await this.resetCache()
		await this.load()
	}

	async reset() {
		this.resetEnvironment()
		await this.resetCache()
		await this.load()
	}

	restore() {
		const data = this.restoreCache()
		this.updateEnvironment(data)
		// Record which keys are already applied from the cache so that a
		// subsequent load with the same keys does not trigger a restart prompt.
		this.knownKeys = new Set(this.backup.keys())
		this.isRestoreCycle = data !== undefined
		void this.load()
	}

	private restoreCache(): Data | undefined {
		this.cwdOverride = this.cache.get<string>(Cached.cwdOverride) ?? undefined
		const storedChecksum = this.cache.get<string>(Cached.checksum)
		if (storedChecksum === undefined) return
		const entries = this.cache.get<EnvCache>(Cached.environment)
		if (!Array.isArray(entries)) return
		const data = new Map(entries.map(([key, value]) => [key, value ?? null]))
		const digest = checksum([...data.keys()].map((key) => [key, process.env[key]]))
		if (storedChecksum !== digest) return
		return data
	}

	private async updateCache() {
		const entries: EnvCache = []
		const checksumEntries: [string, string | undefined][] = []
		for (const [key, original] of this.backup) {
			checksumEntries.push([key, original.existed ? original.value : undefined])
			entries.push([key, process.env[key]])
		}
		await this.cache.update(Cached.checksum, checksum(checksumEntries))
		await this.cache.update(Cached.environment, entries)
		await this.cache.update(Cached.cwdOverride, this.cwdOverride)
	}

	private async resetCache() {
		await this.cache.update(Cached.checksum, undefined)
		await this.cache.update(Cached.environment, undefined)
		await this.cache.update(Cached.cwdOverride, undefined)
	}

	private createWatcher(file: string) {
		const dirname = path.dirname(file)
		const basename = path.basename(file)
		const pattern = new vscode.RelativePattern(vscode.Uri.file(dirname), basename)
		const watcher = vscode.workspace.createFileSystemWatcher(pattern)
		watcher.onDidChange(() => this.reload())
		watcher.onDidCreate(() => this.reload())
		watcher.onDidDelete(() => this.reload())
		this.output.appendLine(`watching: ${file}`)
		return watcher
	}

	private updateWatchers() {
		this.watchers.dispose()
		if (config.watchForChanges.get()) {
			const root = this.cwdOverride ?? devenv.cwd()
			this.watchers = vscode.Disposable.from(
				...devenv.watchedPaths(root).map((it) => this.createWatcher(it)),
			)
		}
	}

	private updateEnvironment(data?: Data) {
		if (data === undefined) return
		// Avoid updating the environment & cleaning out watchers if data is empty
		// such as when `devenv.dump()` is called twice without changes
		if (data.size === 0) return

		// Restore variables that were previously set by devenv but are no longer
		// present in the new environment dump (i.e. removed from devenv.nix).
		for (const [key, original] of this.backup) {
			if (!data.has(key)) {
				if (!original.existed) {
					// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
					delete process.env[key]
				} else {
					process.env[key] = original.value
				}
				this.environment.delete(key)
				this.backup.delete(key)
			}
		}

		for (const [key, value] of data) {
			if (!this.backup.has(key)) {
				// keep the oldest value
				const prev = process.env[key]
				this.backup.set(
					key,
					prev === undefined ? { existed: false } : { existed: true, value: prev },
				)
			}
			this.applyEntry(key, value)
		}
		this.updateWatchers()
	}

	private resetEnvironment() {
		for (const [key, original] of this.backup) {
			// Restore original process env; terminal env is fully cleared below
			if (!original.existed) {
				// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
				delete process.env[key]
			} else {
				process.env[key] = original.value
			}
		}
		this.backup.clear()
		this.environment.clear()
		this.cwdOverride = undefined
		this.updateWatchers()
	}

	/**
	 * Applies a single environment entry to both the process env and the
	 * VS Code terminal env collection.
	 * `null` means the variable should be unset; `undefined` is never passed here.
	 */
	private applyEntry(key: string, value: string | null) {
		// Process environment
		if (value === null) {
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete process.env[key]
		} else {
			process.env[key] = value
		}
		// Terminal environment collection
		const original = this.backup.get(key)
		if (value === null && (original === undefined || !original.existed)) {
			// Variable did not exist before and should be unset — just leave it absent
			this.environment.delete(key)
		} else {
			this.environment.replace(key, value ?? '') // can't unset, set to empty instead
		}
	}

	private async load() {
		await this.attempt(async () => {
			this.output.appendLine(`PATH: ${devenv.augmentedPath()}`)
			await devenv.test()
			this.willLoad.fire()
		})
	}

	private async attempt<T>(callback: () => Promise<T>) {
		try {
			await callback()
		} catch (err) {
			this.failed.fire(err)
		}
	}

	private async onWillLoad() {
		this.status.update(status.State.loading)
		try {
			const data = await devenv.dump(this.cwdOverride)
			this.didLoad.fire(data)
		} catch (err) {
			this.failed.fire(err)
		}
	}

	private async onDidLoad(data: Data) {
		this.updateEnvironment(data)
		await this.updateCache()
		this.loaded.fire()
		const currentKeys = new Set(this.backup.keys())
		const hasNewKeys = [...currentKeys].some((k) => !this.knownKeys.has(k))
		const hasRemovedKeys = [...this.knownKeys].some((k) => !currentKeys.has(k))
		const environmentChanged = hasNewKeys || hasRemovedKeys
		this.knownKeys = currentKeys
		const wasRestoreCycle = this.isRestoreCycle
		this.isRestoreCycle = false
		if (environmentChanged && !wasRestoreCycle) {
			this.didUpdate.fire()
		}
	}

	private onLoaded() {
		if (this.backup.size) {
			const delta = diffEnvironment(this.backup, this.output)
			const relativeFolder = this.cwdOverride
				? path.relative(devenv.cwd(), this.cwdOverride) || undefined
				: undefined
			const loaded: status.Delta = relativeFolder ? { ...delta, relativeFolder } : delta
			this.status.update(status.State.loaded(loaded))
		} else {
			this.status.update(status.State.empty)
		}
	}

	private async onFailed(err: unknown) {
		this.output.appendLine(`error: ${String(err)}`)
		this.status.update(status.State.failed)
		if (err instanceof devenv.CommandNotFoundError) {
			const options = ['Install', 'Configure']
			const choice = await vscode.window.showErrorMessage(
				`devenv error: ${err.message}`,
				...options,
			)
			if (choice === 'Install') {
				await vscode.env.openExternal(installationUri)
			}
			if (choice === 'Configure') {
				await config.path.executable.open()
			}
			return
		}
		const msg = message(err)
		if (msg !== undefined) {
			this.output.appendLine(`error details: ${msg}`)
			await vscode.window.showErrorMessage(`devenv error: ${msg}`)
		}
	}

	private async onDidUpdate() {
		if (await this.shouldRestart()) {
			if (vscode.env.remoteName === undefined) {
				await vscode.commands.executeCommand('workbench.action.restartExtensionHost')
			} else {
				await vscode.commands.executeCommand('workbench.action.reloadWindow')
			}
		}
	}

	private async shouldRestart() {
		if (config.restart.automatic.get()) return true
		const choice = await vscode.window.showWarningMessage(
			`devenv: Environment updated. Restart extensions?`,
			'Restart',
		)
		return choice === 'Restart'
	}
}

type Diff = { added: number; changed: number; removed: number }

function diffEnvironment(
	backup: Map<string, OriginalValue>,
	output: vscode.OutputChannel,
): Diff {
	let added = 0
	let changed = 0
	let removed = 0
	for (const [key, original] of backup) {
		if (!original.existed) {
			added += 1
			output.appendLine(`added: ${key}`)
		} else if (key in process.env) {
			changed += 1
			output.appendLine(`changed: ${key}`)
		} else {
			removed += 1
			output.appendLine(`removed: ${key}`)
		}
		if (original.existed) {
			output.appendLine(`was: ${original.value}`)
		}
		const now = process.env[key]
		if (now) {
			output.appendLine(`now: ${now}`)
		}
	}
	return { added, changed, removed }
}

function message(err: unknown) {
	if (typeof err === 'string') return err
	if (err instanceof Error) return err.message
	console.error('unhandled error', err)
	return
}

async function uriFor(filePath: string) {
	const uri = vscode.Uri.file(filePath)
	try {
		await vscode.workspace.fs.stat(uri)
		return uri
	} catch {
		return uri.with({ scheme: 'untitled' })
	}
}

export function activate(context: vscode.ExtensionContext) {
	const statusItem = new status.Item(vscode.window.createStatusBarItem())
	const instance = new Devenv(context, statusItem)
	context.subscriptions.push(instance)
	context.subscriptions.push(
		vscode.commands.registerCommand(command.Devenv.reload, async () => {
			await instance.reload()
		}),
		vscode.commands.registerCommand(command.Devenv.reset, async () => {
			await instance.reset()
		}),
		vscode.commands.registerCommand(command.Devenv.open, async () => {
			await instance.open()
		}),
		vscode.workspace.onDidChangeConfiguration(async (e) => {
			await instance.configurationChanged(e)
		}),
	)
	instance.restore()
}
