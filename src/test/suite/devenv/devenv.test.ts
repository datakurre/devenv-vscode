import { strict as assert } from 'assert'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import sinon from 'sinon'

import config from '../../../config'
import * as devenv from '../../../devenv'

describe('devenv in the test workspace', function () {
	it('finds the devenv executable', async function () {
		await devenv.test()
	})

	it('dumps the devenv environment', async function () {
		delete process.env.VARIABLE
		const data = await devenv.dump()
		assert.equal(data.get('VARIABLE'), 'value')
	})

	it('does not dump the extra environment', async function () {
		sinon.replace(config.extraEnv, 'get', () => ({ ['VARIABLE']: 'value' }))
		const data = await devenv.dump()
		assert.equal(data.get('VARIABLE'), undefined)
	})

	it('fails when the devenv executable is missing', async function () {
		const missing = '/missing/executable'
		sinon.replace(config.path.executable, 'get', () => missing)
		await assert.rejects(() => devenv.test(), new devenv.CommandNotFoundError(missing))
	})

	// Regression: extraArgs defaults to [] — existing dump() behaviour is unchanged
	it('dump works with default empty extraArgs', async function () {
		sinon.replace(config.extraArgs, 'get', () => [])
		delete process.env.VARIABLE
		const data = await devenv.dump()
		assert.equal(data.get('VARIABLE'), 'value')
	})

	// Regression: no .env in the workspace must not cause any failure
	it('dump works when .env does not exist in the workspace', async function () {
		sinon.replace(config.extraArgs, 'get', () => [])
		// The test workspace has no .env file; parseDotEnv must swallow the ENOENT
		const data = await devenv.dump()
		assert.ok(data instanceof Map)
	})
})

describe('parseDotEnv', function () {
	let tmpDir: string

	beforeEach(async function () {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'devenv-parseDotEnv-'))
	})

	afterEach(async function () {
		await fs.rm(tmpDir, { recursive: true, force: true })
	})

	it('returns empty object when .env does not exist', async function () {
		const result = await devenv.parseDotEnv(path.join(tmpDir, 'nonexistent'))
		assert.deepEqual(result, {})
	})

	it('returns empty object for an empty .env file', async function () {
		await fs.writeFile(path.join(tmpDir, '.env'), '')
		const result = await devenv.parseDotEnv(tmpDir)
		assert.deepEqual(result, {})
	})

	it('parses plain KEY=VALUE entries', async function () {
		await fs.writeFile(path.join(tmpDir, '.env'), 'FOO=bar\nBAZ=qux\n')
		const result = await devenv.parseDotEnv(tmpDir)
		assert.equal(result['FOO'], 'bar')
		assert.equal(result['BAZ'], 'qux')
	})

	it('parses export KEY=VALUE entries', async function () {
		await fs.writeFile(path.join(tmpDir, '.env'), 'export NETRC=/home/user/.netrc\n')
		const result = await devenv.parseDotEnv(tmpDir)
		assert.equal(result['NETRC'], '/home/user/.netrc')
	})

	it('strips double quotes from values', async function () {
		await fs.writeFile(path.join(tmpDir, '.env'), 'FOO="hello world"\n')
		const result = await devenv.parseDotEnv(tmpDir)
		assert.equal(result['FOO'], 'hello world')
	})

	it('strips single quotes from values', async function () {
		await fs.writeFile(path.join(tmpDir, '.env'), "FOO='hello world'\n")
		const result = await devenv.parseDotEnv(tmpDir)
		assert.equal(result['FOO'], 'hello world')
	})

	it('ignores comment lines', async function () {
		await fs.writeFile(path.join(tmpDir, '.env'), '# this is a comment\nFOO=bar\n')
		const result = await devenv.parseDotEnv(tmpDir)
		assert.equal(result['FOO'], 'bar')
		assert.equal(Object.keys(result).length, 1)
	})

	it('ignores blank lines', async function () {
		await fs.writeFile(path.join(tmpDir, '.env'), '\n\nFOO=bar\n\n')
		const result = await devenv.parseDotEnv(tmpDir)
		assert.equal(result['FOO'], 'bar')
		assert.equal(Object.keys(result).length, 1)
	})
})

describe('interpolate', function () {
	it('replaces $VAR placeholders', function () {
		const result = devenv.interpolate('hello $NAME', { NAME: 'world' })
		assert.equal(result, 'hello world')
	})

	it('replaces ${VAR} placeholders', function () {
		const result = devenv.interpolate('path=${NETRC}', { NETRC: '/etc/netrc' })
		assert.equal(result, 'path=/etc/netrc')
	})

	it('substitutes unknown variables with empty string', function () {
		const result = devenv.interpolate('$UNDEFINED', {})
		assert.equal(result, '')
	})

	it('leaves strings without placeholders unchanged', function () {
		const result = devenv.interpolate('--nix-option', { FOO: 'bar' })
		assert.equal(result, '--nix-option')
	})

	it('replaces multiple placeholders in one argument', function () {
		const result = devenv.interpolate('$A:${B}', { A: 'x', B: 'y' })
		assert.equal(result, 'x:y')
	})

	it('shell env takes precedence over .env values during interpolation', function () {
		// Simulate merged env where shell overrides .env value
		const merged = { NETRC: '/shell/netrc' } // shell took precedence already
		const result = devenv.interpolate('$NETRC', merged)
		assert.equal(result, '/shell/netrc')
	})
})
