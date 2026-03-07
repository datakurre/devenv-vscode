import { strict as assert } from 'assert'
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
})
