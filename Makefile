.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

# ----------------------------------------------------------------------------
# Build
# ----------------------------------------------------------------------------

.PHONY: build
build: ## Compile the extension bundle (dist/)
	npm run build

.PHONY: watch
watch: ## Watch source and tests, recompiling on changes
	npm run watch:source & npm run watch:tests

.PHONY: clean
clean: ## Remove compiled output (out/ and dist/)
	npm run clean

.PHONY: dist
dist: ## Build the .vsix extension package
	npm run package

# ----------------------------------------------------------------------------
# Quality
# ----------------------------------------------------------------------------

.PHONY: lint
lint: ## Run ESLint and Prettier checks
	npm run lint

.PHONY: format
format: ## Auto-fix ESLint issues and reformat with Prettier
	npm run fix

.PHONY: test
test: ## Compile everything and run the test suite
	npm test
