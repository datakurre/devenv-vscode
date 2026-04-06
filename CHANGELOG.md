# Change Log

All notable changes to this project will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.6.0] - 2026-04-06
### Changed
- Replace internal load events (`willLoad`, `didLoad`, `loaded`) with internal flags and direct calls to serialize reloads.
- Add `loadInFlight` and `loadPending` to avoid concurrent loads; `load()` now queues a pending load if one is already in flight.
- `load()` now logs the augmented PATH, runs `devenv.test()`, updates the status to `loading`, dumps data, and calls `onDidLoad()` directly.
- `onDidLoad()` now calls `onLoaded()` directly instead of firing an event.

## [0.5.2] - 2026-04-06
### Changed
- `devenv.exists()` now checks only for `devenv.nix`; `devenv.yaml` is no longer considered when detecting a project.

## [0.5.1] - 2026-04-06
### Fixed
- No longer shows an error popup when opening a project that does not use devenv (i.e. has no `devenv.nix` or `devenv.yaml`)

## [0.5.0] - 2026-03-19 
### Added
- New setting `devenv.extraArgs`: an array of extra arguments prepended to every devenv invocation. Each element is a separate argument. `$VAR` and `${VAR}` placeholders are interpolated at call time using values from a `.env` file in the workspace root merged with the shell environment (shell env takes precedence). Example: `["--nix-option", "extra-sandbox-paths", "$NETRC"]`

## [0.3.0] - 2026-03-16 
### Fixed
- Environment variables removed from `devenv.nix` are now correctly unset from the VS Code process environment and terminal environment collection on reload, instead of persisting until a full reset

## [0.2.0] - 2026-03-09
### Added
- Auto-detect `profile:` from `devenv.local.yaml` / `devenv.yaml` and pass `--profile <name>` to `devenv print-dev-env`; `devenv.local.yaml` takes precedence over `devenv.yaml`
- New setting `devenv.profile` to override the auto-detected profile (set to a string to pin a profile, or `null` to keep auto-detection)

## [0.1.0] - 2026-03-07
### Added
- Initial release as `cachix.devenv`, forked from the direnv VS Code extension
- Load environment variables from `devenv print-dev-env` into VS Code terminals and tasks
- Automatically augment PATH with standard Nix profile directories and common system paths so devenv and git are found when VS Code is launched as a GUI application
- Set `HOME` from the OS passwd database to avoid Nix sandbox `HOME=/homeless-shelter` breaking devenv startup
- Filter Nix build-sandbox variables (`HOME`, `PATH`, `TMP`, `NIX_*`, etc.) from being applied to the live VS Code session
- Suppress spurious "Restart extensions?" prompts on restore cycles and unchanged reloads
- New setting `devenv.path.nixBinPaths` for adding extra PATH directories in non-standard Nix installations
- Log augmented PATH and full error details to the `devenv` output channel for easier diagnostics
