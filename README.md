# devenv

> **⚠️ Notice:** This extension is forked from [direnv/direnv-vscode] and has
> been rewritten for [devenv] using an LLM coding agent. Use with appropriate
> caution and review the source before deploying in production environments.

[devenv] is a tool for creating fast, declarative, reproducible, and composable
developer environments using [Nix].

This extension adds devenv support to Visual Studio Code
by loading environment variables from `devenv.nix` for the workspace root.

[devenv]: https://devenv.sh/
[Nix]: https://nixos.org/
[direnv/direnv-vscode]: https://github.com/direnv/direnv-vscode


## Features

### Custom Environment

This extension automatically loads the custom environment
devenv provides for the workspace by running `devenv print-dev-env`.
When `devenv.nix`, `devenv.yaml`, `devenv.lock`, or local override files are
modified, the extension automatically reloads the environment.

The custom environment is available in [integrated terminals][vscode-terminal],
in [custom tasks of type `shell`][vscode-tasks],
and in [environment variable substitutions (`${env:VAR}`)][vscode-env-vars].

[vscode-terminal]: https://code.visualstudio.com/docs/editor/integrated-terminal
[vscode-tasks]: https://code.visualstudio.com/docs/editor/tasks#_custom-tasks
[vscode-env-vars]: https://code.visualstudio.com/docs/editor/variables-reference#_environment-variables

### Commands

*	"devenv: Open devenv.nix file"
	opens an editor with the `devenv.nix` file for the workspace root.

*	"devenv: Reload environment"
	reloads the custom environment for the workspace.

*	"devenv: Reset and reload environment"
	resets the custom environment for the workspace, then reloads it.

### Status Item

The extension displays a status icon
that indicates whether it is currently working or has succeeded or failed.

Clicking the status item will also reload the custom environment.


## Requirements

This extension requires [devenv] to be installed.
See the [devenv installation guide](https://devenv.sh/getting-started/) for details.


## Settings

| Setting | Default | Description |
|---|---|---|
| `devenv.path.executable` | `devenv` | Path to the `devenv` executable. Set this to an absolute path if `devenv` is not on the PATH that VS Code sees. |
| `devenv.path.nixBinPaths` | `[]` | Extra directories to prepend to PATH when running `devenv`. The extension already adds the standard Nix profile directories and common system paths; use this only for non-standard install locations. |
| `devenv.extraEnv` | `{}` | Environment variables to set before running `devenv`. |
| `devenv.watchForChanges` | `true` | Automatically reload the environment when `devenv.nix`, `devenv.yaml`, `devenv.lock`, or local override files change. |
| `devenv.status.showChangesCount` | `true` | Show the count of added/changed/removed variables in the status bar. |
| `devenv.restart.automatic` | `false` | Automatically restart the extension host after the environment changes (instead of prompting). |


## Known Issues

Custom tasks with type `process` don't pick up on the modified environment.
Several task provider extensions provide these kinds of tasks.

When devenv *unsets* an environment variable
then in the terminal it will be set to empty
(what POSIX calls null).
[VSCode does not provide API to unset environment variables for the terminal.][vscode-evc]
The difference between null and unset variables is mostly academic
but some programs insist on treating them distinctly.

[vscode-evc]: https://github.com/microsoft/vscode/issues/185200

devenv evaluates Nix expressions so this extension requires trusted workspaces.
