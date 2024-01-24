const test = require('brittle')
const { AppInspector, Client } = require('../')
const HyperDht = require('hyperdht')
const inspector = require('inspector/promises')

let appInspector
let client

async function teardown () {
  await appInspector.disable()
  await client.destroy()
}

test('Inspector evaluates correctly', async t => {
  t.teardown(teardown)
  t.plan(5)
  appInspector = new AppInspector({ inspector })
  const { publicKey } = await appInspector.enable()

  client = new Client({ publicKey })
  client.once('message', ({ id, result, error }) => {
    const { type, value, description } = result
    t.is(id, 1)
    t.absent(error)
    t.is(type, 'number')
    t.is(value, 3)
    t.is(description, '3')
  })

  client.send({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression: '1 + 2' }
  })
})

test('Message with errornous code returns error', async t => {
  t.teardown(teardown)
  t.plan(3)

  appInspector = new AppInspector({ inspector })
  const { publicKey } = await appInspector.enable()

  client = new Client({ publicKey })
  client.once('message', ({ id, result, error }) => {
    t.is(id, 1)
    t.absent(result)
    t.is(error.code, 'ERR_INSPECTOR_COMMAND')
  })

  client.send({
    id: 1,
    method: 'incorrect_code'
  })
})

test('Message with no return value', async t => {
  t.teardown(teardown)
  t.plan(1)

  appInspector = new AppInspector({ inspector })
  const { publicKey } = await appInspector.enable()

  client = new Client({ publicKey })
  client.on('message', ({ result }) => {
    t.absent(result)
  })
  client.send({
    method: 'Runtime.discardConsoleEntries',
    params: {}
  })
})

test('Several calls with different return values to ensure order works', async t => {
  t.teardown(teardown)
  t.plan(10)

  appInspector = new AppInspector({ inspector })
  const { publicKey } = await appInspector.enable()

  client = new Client({ publicKey })
  client.on('message', ({ id, result }) => {
    const { value } = result
    t.is(id, value)
  })
  client.send({ id: 0, method: 'Runtime.evaluate', params: { expression: '0 + 0' } })
  client.send({ id: 1, method: 'Runtime.evaluate', params: { expression: '0 + 1' } })
  client.send({ id: 2, method: 'Runtime.evaluate', params: { expression: '0 + 2' } })
  client.send({ id: 3, method: 'Runtime.evaluate', params: { expression: '0 + 3' } })
  client.send({ id: 4, method: 'Runtime.evaluate', params: { expression: '0 + 4' } })
  client.send({ id: 5, method: 'Runtime.evaluate', params: { expression: '0 + 5' } })
  client.send({ id: 6, method: 'Runtime.evaluate', params: { expression: '0 + 6' } })
  client.send({ id: 7, method: 'Runtime.evaluate', params: { expression: '0 + 7' } })
  client.send({ id: 8, method: 'Runtime.evaluate', params: { expression: '0 + 8' } })
  client.send({ id: 9, method: 'Runtime.evaluate', params: { expression: '0 + 9' } })
})

test('publicKey needed for Client', t => {
  t.plan(1)
  t.exception(() => {
    new Client({ }) // eslint-disable-line no-new
  })
})

test('inspector needed for AppInspector', t => {
  t.plan(1)
  t.exception(() => {
    new AppInspector({ }) // eslint-disable-line no-new
  })
})

test('Use own hypderdht server for AppInspector', async t => {
  t.plan(3)

  const keyPair = HyperDht.keyPair()
  const dht = new HyperDht()
  const dhtServer = dht.createServer()
  await dhtServer.listen(keyPair)
  const appInspector = new AppInspector({ dhtServer, inspector })
  const res = await appInspector.enable()
  t.absent(res) // keys aren't returned when handled by self

  client = new Client({ publicKey: keyPair.publicKey })
  client.once('message', async ({ id, result }) => {
    t.is(id, 1)
    t.ok(result.value, 3)

    await appInspector.disable()
    await client.destroy()
    await dht.destroy()
  })

  client.send({ id: 1, method: 'Runtime.evaluate', params: { expression: '1 + 2' } })
})

test('Get messages from the AppInspector that was not sent by the Client', async t => {
  t.teardown(teardown)
  t.plan(3)

  appInspector = new AppInspector({ inspector })
  const { publicKey } = await appInspector.enable()

  client = new Client({ publicKey })
  client.once('message', async ({ id, method, params }) => {
    // `Runtime.executionContextCreated` happens as a side effect to calling `Runtime.enable`, but is not a direct response (i.e. `id` is not set)
    t.is(method, 'Runtime.executionContextCreated')
    t.absent(id)
    t.ok(params.context)
    await appInspector.disable()
    await client.destroy()
  })
  client.send({
    id: 1,
    method: 'Runtime.enable',
    params: {}
  })
})
