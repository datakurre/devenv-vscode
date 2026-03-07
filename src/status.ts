import vscode from 'vscode'
import * as command from './command'
import config from './config'

export type Delta = {
	added: number
	changed: number
	removed: number
	/** Relative path string to display in the status bar, already computed by the caller. */
	relativeFolder?: string
}

// ---------------------------------------------------------------------------
// Pure formatting helper
// ---------------------------------------------------------------------------

function formatDelta(delta: Delta): { text: string; tooltip: string } {
	let text = '$(folder-active)'
	const tooltip = [
		`devenv loaded: ${delta.added} added, ${delta.changed} changed, ${delta.removed} removed`,
	]
	if (delta.relativeFolder) {
		text += ` ${delta.relativeFolder}`
		tooltip.push(`in: ${delta.relativeFolder}`)
	}
	if (config.status.showChangesCount.get()) {
		text += ` +${delta.added}/~${delta.changed}/-${delta.removed}`
	}
	tooltip.push('Reload…')
	return { text, tooltip: tooltip.join('\n') }
}

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

type LoadingState = { readonly kind: 'loading' }
type EmptyState = { readonly kind: 'empty' }
type LoadedState = { readonly kind: 'loaded'; readonly delta: Delta }
type FailedState = { readonly kind: 'failed' }

export type State = LoadingState | EmptyState | LoadedState | FailedState

export const State = {
	loading: { kind: 'loading' } as LoadingState,
	empty: { kind: 'empty' } as EmptyState,
	loaded: (delta: Delta): LoadedState => ({ kind: 'loaded', delta }),
	failed: { kind: 'failed' } as FailedState,
} as const

// ---------------------------------------------------------------------------
// Status bar item
// ---------------------------------------------------------------------------

function stateText(state: State): string {
	switch (state.kind) {
		case 'loading':
			return '$(folder)$(sync~spin)'
		case 'empty':
			return '$(folder)'
		case 'loaded':
			return formatDelta(state.delta).text
		case 'failed':
			return '$(folder)$(flame)'
	}
}

function stateTooltip(state: State): string {
	switch (state.kind) {
		case 'loading':
			return 'devenv loading…'
		case 'empty':
			return 'devenv empty\nOpen devenv.nix…'
		case 'loaded':
			return formatDelta(state.delta).tooltip
		case 'failed':
			return 'devenv failed\nReload…'
	}
}

function stateCommand(state: State): command.Devenv | undefined {
	switch (state.kind) {
		case 'loading':
			return undefined
		case 'empty':
			return command.Devenv.open
		case 'loaded':
			return command.Devenv.reload
		case 'failed':
			return command.Devenv.reload
	}
}

export class Item implements vscode.Disposable {
	private state: State = State.empty

	constructor(private item: vscode.StatusBarItem) {
		item.text = stateText(State.empty)
		item.show()
	}

	dispose() {
		this.item.dispose()
	}

	update(state: State) {
		this.state = state
		this.item.text = stateText(state)
		this.item.tooltip = stateTooltip(state)
		this.item.command = stateCommand(state)
	}

	refresh() {
		this.update(this.state)
	}
}
