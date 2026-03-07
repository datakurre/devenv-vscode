import { strict as assert } from 'assert'

import * as devenv from '../../../../devenv'

describe('devenv in the subdirectory workspace', function () {
	it('finds the devenv executable', async function () {
		await devenv.test()
	})

	it('dumps the devenv environment', async function () {
		delete process.env.VARIABLE
		const data = await devenv.dump()
		assert.equal(data.get('VARIABLE'), 'value')
	})
})
