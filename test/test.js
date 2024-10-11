const test = require('brittle')
const { Inspector, Session } = require('../')
const HyperDht = require('hyperdht')
const nodeInspector = require('inspector')
const { spawn } = require('child_process')
const createTestnet = require('@hyperswarm/testnet')

let inspector
let session

async function teardown () {
  await inspector?.disable()
  await session?.destroy()
}

async function setupTestnet (t) {
  const testnet = await createTestnet(10)
  t.teardown(() => testnet.destroy())
  return testnet.bootstrap
}

test('Inspector evaluates correctly', async t => {
  t.teardown(teardown)
  t.plan(5)

  const bootstrap = await setupTestnet(t)
  inspector = new Inspector({ inspector: nodeInspector, bootstrap })
  const inspectorKey = await inspector.enable()

  session = new Session({ inspectorKey, bootstrap })
  session.once('message', ({ id, result, error }) => {
    const { result: { type, value, description } } = result
    t.is(id, 1)
    t.absent(error)
    t.is(type, 'number')
    t.is(value, 3)
    t.is(description, '3')
  })

  session.connect()
  session.post({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression: '1 + 2' }
  })
})

test('Message with errornous code returns error', async t => {
  t.teardown(teardown)
  t.plan(3)

  const bootstrap = await setupTestnet(t)
  inspector = new Inspector({ inspector: nodeInspector, bootstrap })
  const inspectorKey = await inspector.enable()

  session = new Session({ inspectorKey, bootstrap })
  session.once('message', ({ id, result, error }) => {
    t.is(id, 1)
    t.absent(result)
    t.ok(error.code === 'ERR_INSPECTOR_COMMAND' || error.code === -32601) // Node or Bare
  })

  session.connect()
  session.post({
    id: 1,
    method: 'incorrect_code'
  })
})

test('Message with no return value, returns message with empty object', async t => {
  t.teardown(teardown)
  t.plan(1)

  const bootstrap = await setupTestnet(t)
  inspector = new Inspector({ inspector: nodeInspector, bootstrap })
  const inspectorKey = await inspector.enable()

  session = new Session({ inspectorKey, bootstrap })
  session.on('message', ({ result }) => {
    t.is(Object.keys(result).length, 0)
  })
  session.connect()
  session.post({
    method: 'Runtime.discardConsoleEntries',
    params: {}
  })
})

test('Several calls with different return values to ensure order works', async t => {
  t.teardown(teardown)
  t.plan(10)

  const bootstrap = await setupTestnet(t)

  inspector = new Inspector({ inspector: nodeInspector, bootstrap })
  const inspectorKey = await inspector.enable()

  session = new Session({ inspectorKey, bootstrap })
  session.on('message', ({ id, result }) => {
    const { result: { value } } = result
    t.is(id, value)
  })
  session.connect()
  session.post({ id: 0, method: 'Runtime.evaluate', params: { expression: '0 + 0' } })
  session.post({ id: 1, method: 'Runtime.evaluate', params: { expression: '0 + 1' } })
  session.post({ id: 2, method: 'Runtime.evaluate', params: { expression: '0 + 2' } })
  session.post({ id: 3, method: 'Runtime.evaluate', params: { expression: '0 + 3' } })
  session.post({ id: 4, method: 'Runtime.evaluate', params: { expression: '0 + 4' } })
  session.post({ id: 5, method: 'Runtime.evaluate', params: { expression: '0 + 5' } })
  session.post({ id: 6, method: 'Runtime.evaluate', params: { expression: '0 + 6' } })
  session.post({ id: 7, method: 'Runtime.evaluate', params: { expression: '0 + 7' } })
  session.post({ id: 8, method: 'Runtime.evaluate', params: { expression: '0 + 8' } })
  session.post({ id: 9, method: 'Runtime.evaluate', params: { expression: '0 + 9' } })
})

test('Enabling console allows to read logs', async t => {
  t.teardown(teardown)
  t.plan(4)

  const bootstrap = await setupTestnet(t)

  inspector = new Inspector({ inspector: nodeInspector, bootstrap })
  const inspectorKey = await inspector.enable()

  session = new Session({ inspectorKey, bootstrap })
  session.connect()

  session.once('message', ({ id, result }) => {
    // This first message is a reply to acknowledge that Console has been enabled.
    // These two checks are commented out because they'd otherwise result in a
    // console.log which then interferes with the test.
    // t.is(id, 1)
    // t.ok(result)

    session.once('message', ({ method, params: { message } }) => {
      // When running all the tests, message.text will sometimes be something from the previous test.
      // That is why this test just checks if there is text, and that the method is correct
      t.ok(message.text)
      t.is(method, 'Console.messageAdded')
      t.is(message.source, 'console-api')
      t.is(message.level, 'log')
    })

    console.log('Testing console.log')
  })

  session.post({ id: 1, method: 'Console.enable' })
})

test('publicKey needed for Session', t => {
  t.plan(1)
  t.exception(() => {
    new Session({ }) // eslint-disable-line no-new
  })
})

test('inspector is optional', t => {
  t.plan(1)

  const pearInspector = new Inspector({ })
  t.ok(pearInspector.inspector === nodeInspector)
})

test('Use own hypderdht server for Inspector', async t => {
  t.plan(3)

  const bootstrap = await setupTestnet(t)

  const keyPair = HyperDht.keyPair()
  const dht = new HyperDht({ bootstrap })
  const dhtServer = dht.createServer()
  await dhtServer.listen(keyPair)
  const inspector = new Inspector({ dhtServer, inspector: nodeInspector })
  const inspectorKey = await inspector.enable()
  t.absent(inspectorKey) // keys aren't returned when handled by self

  session = new Session({ publicKey: keyPair.publicKey, bootstrap })
  session.once('message', async ({ id, result }) => {
    t.is(id, 1)
    t.is(result.result.value, 3)

    await inspector.disable()
    await session.destroy()
    await dht.destroy()
  })

  session.connect()
  session.post({ id: 1, method: 'Runtime.evaluate', params: { expression: '1 + 2' } })
})

test('Use own inspectorKey', async t => {
  t.teardown(teardown)
  t.plan(2)

  const bootstrap = await setupTestnet(t)
  const inspectorKey = HyperDht.keyPair().secretKey.subarray(0, 32)
  inspector = new Inspector({ inspectorKey, inspector: nodeInspector, bootstrap })
  await inspector.enable()

  session = new Session({ inspectorKey, bootstrap })
  session.once('message', async ({ id, result }) => {
    t.is(id, 1)
    t.is(result.result.value, 3)
  })

  session.connect()
  session.post({ id: 1, method: 'Runtime.evaluate', params: { expression: '1 + 2' } })
})

test('Get messages from the Inspector that was not sent by the Session', async t => {
  t.teardown(teardown)
  t.plan(3)

  const bootstrap = await setupTestnet(t)
  inspector = new Inspector({ inspector: nodeInspector, bootstrap })
  const inspectorKey = await inspector.enable()

  session = new Session({ inspectorKey, bootstrap })
  session.once('message', async ({ id, method, params }) => {
    // `Runtime.executionContextCreated` happens as a side effect to calling `Runtime.enable`, but is not a direct response (i.e. `id` is not set)
    t.is(method, 'Runtime.executionContextCreated')
    t.absent(id)
    t.ok(params.context)
    await inspector.disable()
    await session.destroy()
  })
  session.connect()
  session.post({
    id: 1,
    method: 'Runtime.enable',
    params: {}
  })
})

test('Creating session, emits an info event', async t => {
  t.teardown(teardown)
  t.plan(1)

  const bootstrap = await setupTestnet(t)
  inspector = new Inspector({ inspector: nodeInspector, bootstrap })
  const inspectorKey = await inspector.enable()

  session = new Session({ inspectorKey, bootstrap })
  session.on('info', ({ filename }) => {
    t.ok(filename.endsWith('pear-inspect/test/test.js'))
  })
})

test('Calling .post(), ensure that "info" is emitted, then "message"', async t => {
  t.teardown(teardown)
  t.plan(2)

  const bootstrap = await setupTestnet(t)
  inspector = new Inspector({ inspector: nodeInspector, bootstrap })
  const inspectorKey = await inspector.enable()

  let calls = 0
  session = new Session({ inspectorKey, bootstrap })
  session.on('info', () => {
    calls += 1
    t.is(calls, 1)
  })
  session.on('message', () => {
    calls += 1
    t.is(calls, 2)
  })
  session.connect()
  session.post({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression: '1 + 2' }
  })
})

test('Calling .post() before .connect() throws', async t => {
  t.teardown(teardown)
  t.plan(1)

  const bootstrap = await setupTestnet(t)
  inspector = new Inspector({ inspector: nodeInspector, bootstrap })
  const inspectorKey = await inspector.enable()

  session = new Session({ inspectorKey, bootstrap })

  t.exception(() => {
    session.post({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression: '1 + 2' }
    })
  })
})

test('.post() after a .disconnect() throws', async t => {
  t.teardown(teardown)
  t.plan(2)

  const bootstrap = await setupTestnet(t)
  inspector = new Inspector({ inspector: nodeInspector, bootstrap })
  const inspectorKey = await inspector.enable()

  session = new Session({ inspectorKey, bootstrap })
  session.on('message', () => t.pass())

  session.connect()
  session.post({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression: '1 + 2' }
  })
  session.disconnect()
  t.exception(() => {
    session.post({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression: '1 + 2' }
    })
  })
})

test('Calling .connect() after a .disconnect() still allows .post()', async t => {
  t.teardown(teardown)
  t.plan(2)

  const bootstrap = await setupTestnet(t)
  inspector = new Inspector({ inspector: nodeInspector, bootstrap })
  const inspectorKey = await inspector.enable()

  session = new Session({ inspectorKey, bootstrap })
  session.on('message', () => t.pass())

  session.connect()
  session.post({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression: '1 + 2' }
  })

  session.disconnect()
  session.connect()

  session.post({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression: '1 + 2' }
  })
})

test('Setting filename overrides the default on', async t => {
  t.teardown(teardown)
  t.plan(1)

  const bootstrap = await setupTestnet(t)
  inspector = new Inspector({ inspector: nodeInspector, filename: 'foobar.js', bootstrap })
  const inspectorKey = await inspector.enable()

  session = new Session({ inspectorKey, bootstrap })
  session.on('info', ({ filename }) => {
    t.is(filename, 'foobar.js')
  })
})

test('All parameters are optional', async t => {
  t.teardown(teardown)
  t.plan(1)

  inspector = new Inspector()
  t.ok(inspector)
})

test('Filename is set for cjs', async t => {
  t.teardown(teardown)
  t.plan(1)
  inspector = new Inspector()
  t.ok(inspector.filename.endsWith('test/test.js'))
})

test('Filename is set for mjs', async t => {
  t.teardown(teardown)
  t.plan(1)

  const process = spawn('node', ['test/fixtures/module.mjs'])
  process.stderr.on('data', data => t.fail())
  process.stdout.on('data', filename => {
    filename = filename.toString().trim()
    t.ok(filename.endsWith('/test/fixtures/module.mjs'))
  })
})

// This test requires Pear to be installed, so is not run automatically
test.skip('Filename is set for Pear', async t => {
  t.teardown(teardown)
  t.plan(1)

  const process = spawn('pear', ['run', 'test/fixtures/pear-project'])
  process.stderr.on('data', data => t.fail())
  process.stdout.on('data', filename => {
    filename = filename.toString().trim()
    t.ok(filename.endsWith('/test/fixtures/pear-project/index.js'))
  })
})

test('Uses global Pear bootstrap', async t => {
  t.teardown(teardown)
  t.plan(2)

  global.Pear = { config: { dht: {} } }
  global.Pear.config.dht.bootstrap = await setupTestnet(t)
  inspector = new Inspector({ inspector: nodeInspector })
  const inspectorKey = await inspector.enable()
  session = new Session({ inspectorKey })

  t.is(inspector.bootstrap.toString(), global.Pear.config.dht.bootstrap.toString())
  t.is(session.bootstrap.toString(), global.Pear.config.dht.bootstrap.toString())
})
