import cp from 'child_process'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import vscode from 'vscode'
import config from './config'

const execFile = promisify(cp.execFile)

/**
 * The real home directory from the OS passwd database, unaffected by a
 * corrupted or sandbox-set HOME environment variable (e.g. /homeless-shelter).
 */
const realHome = os.userInfo().homedir

/**
 * Standard binary directories that are often absent from PATH when VS Code is
 * launched as a GUI application rather than from a terminal.  The list covers:
 *   - per-user Nix profiles (classic and nix-darwin)
 *   - system-wide Nix default profile
 *   - NixOS / nix-darwin system packages
 *   - Homebrew on Apple Silicon and Intel Macs
 *   - standard system locations that GUI apps on macOS routinely miss
 */
const extraPaths = [
	path.join(realHome, '.nix-profile', 'bin'),
	`/etc/profiles/per-user/${os.userInfo().username}/bin`,
	'/nix/var/nix/profiles/default/bin',
	'/run/current-system/sw/bin',
	'/opt/homebrew/bin',
	'/opt/homebrew/sbin',
	'/usr/local/bin',
	'/usr/bin',
	'/bin',
]

/**
 * Returns an augmented PATH that prepends well-known Nix binary directories to
 * the current PATH.  This ensures that `devenv` and tools it depends on (e.g.
 * `git`) can be found even when VS Code is launched as a GUI app without the
 * Nix profile sourced.
 */
export function augmentedPath(): string {
	const current = process.env['PATH'] ?? ''
	const extra = config.path.nixBinPaths.get()
	const prepend = [...extra, ...extraPaths].join(path.delimiter)
	return `${prepend}${path.delimiter}${current}`
}

export class CommandNotFoundError extends Error {
	constructor(public readonly path: string) {
		super(`${path}: command not found`)
	}
}

export type Data = Map<string, string | null>

export type Stdio = {
	stdout: string
	stderr: string
}

/**
 * Returns the working directory for devenv commands.
 *
 * NOTE: Only the first workspace folder is considered. Multi-root workspace
 * support is not implemented; use the `cwdOverride` parameter on individual
 * commands when a different folder is needed.
 */
export function cwd(): string {
	return vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? realHome
}

async function devenv(
	args: string[],
	env?: NodeJS.ProcessEnv,
	cwdOverride?: string,
): Promise<Stdio> {
	const options: cp.ExecOptionsWithStringEncoding = {
		encoding: 'utf8',
		cwd: cwdOverride ?? cwd(),
		env: {
			...process.env,
			HOME: realHome,
			PATH: augmentedPath(),
			...env,
			...config.extraEnv.get(),
		},
	}
	const command = config.path.executable.get()
	try {
		return await execFile(command, args, options)
	} catch (e) {
		if (
			e instanceof Error &&
			'path' in e && 'code' in e &&
			e.path === command &&
			(e.code === 'ENOENT' || e.code === 'EACCES')
		) {
			throw new CommandNotFoundError(command)
		}
		throw e
	}
}

export async function test(): Promise<void> {
	await devenv(['version'])
}

export async function dump(cwdOverride?: string): Promise<Data> {
	const { stdout } = await devenv(['print-dev-env', '--json'], undefined, cwdOverride)
	return parse(stdout)
}

type VariableEntry =
	| { type: 'exported'; value: string }
	| { type: 'unset' }
	| { type: 'var' | 'array' | 'unknown' }

function parse(stdout: string): Data {
	if (!stdout) return new Map()
	const record = JSON.parse(stdout) as { variables: Record<string, VariableEntry> }
	const entries: [string, string | null][] = []
	for (const [key, entry] of Object.entries(record.variables)) {
		if (isInternal(key)) continue
		if (key === 'PATH' && entry.type === 'exported') {
			// Devenv's PATH contains only Nix store paths for the declared
			// packages plus stdenv tools.  Replacing the system PATH wholesale
			// would remove git, system utilities, etc.  Instead prepend
			// devenv's entries to the real (augmented) system PATH so that
			// declared packages win but system tools remain reachable.
			const merged = `${entry.value}${path.delimiter}${augmentedPath()}`
			entries.push(['PATH', merged])
			continue
		}
		if (entry.type === 'exported') {
			entries.push([key, entry.value])
		} else if (entry.type === 'unset') {
			entries.push([key, null])
		} else {
			// 'var' | 'array' | 'unknown' — not exported to the environment; skip.
			// If devenv adds a new type the TypeScript compiler will flag this
			// cast and the exhaustive comment serves as a change-surface marker.
			const _exhaustive: { type: 'var' | 'array' | 'unknown' } = entry
			void _exhaustive
		}
	}
	return new Map(entries)
}

/**
 * Variables that are set by the Nix build sandbox and must never be applied to
 * a live VS Code / terminal session.  Applying them causes breakage such as:
 *   - HOME=/homeless-shelter  → mkdir/touch errors, git failures
 *   - TMP/TMPDIR pointing at a non-existent sandbox directory
 *
 * PATH is handled separately in parse(): devenv's PATH entries are prepended
 * to the real system PATH rather than replacing it wholesale.
 *
 * The list mirrors what the Nix stdenv sets unconditionally for every
 * derivation and what devenv strips when exporting its delta.
 */
const sandboxVariables = new Set([
	'HOME',
	'TMP',
	'TMPDIR',
	'TEMP',
	'TEMPDIR',
	'NIX_BUILD_TOP',
	'NIX_LOG_FD',
	'NIX_STORE',
	'builder',
	'name',
	'out',
	'outputs',
	'src',
	'system',
	'__ETC_PROFILE_SOURCED',
	'__structuredAttrs',
])

export function isInternal(key: string) {
	return (
		sandboxVariables.has(key) ||
		key.startsWith('DEVENV_') ||
		key.startsWith('NIX') ||
		key.startsWith('passAsFile')
	)
}

/**
 * Returns the paths to watch for changes that should trigger a reload.
 * devenv uses devenv.nix, devenv.yaml, devenv.lock, and optional local overrides.
 */
export function watchedPaths(root: string): string[] {
	return [
		`${root}/devenv.nix`,
		`${root}/devenv.yaml`,
		`${root}/devenv.lock`,
		`${root}/devenv.local.nix`,
		`${root}/devenv.local.yaml`,
	]
}
