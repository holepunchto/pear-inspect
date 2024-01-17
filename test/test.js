const test = require('brittle')
const Inspect = require('../')
const Hyperswarm = require('hyperswarm')

let server
let inspector
const randomKey = Array(32).fill(0).map(() => Math.random().toString(36).charAt(2)).join('') // No access to crypto module
const dhtKey = Buffer.from(randomKey)

async function teardown () {
  await inspector.destroy()
  await server.destroy()
}

test('Inspector evaluates correctly', async t => {
  t.teardown(teardown)
  t.plan(3)

  server = new Inspect({ dhtKey })
  inspector = new Inspect({ dhtKey })

  await server.serve(async client => {
    const { result: { type, value, description } } = await client.post('Runtime.evaluate', { expression: '1 + 2' })
    t.is(type, 'number')
    t.is(value, 3)
    t.is(description, '3')
  })

  await inspector.enable()
})

test('Post with errornous code rejects promise', async t => {
  t.teardown(teardown)
  t.plan(1)

  server = new Inspect({ dhtKey })
  inspector = new Inspect({ dhtKey })

  await server.serve(async client => {
    await t.exception(async () => {
      await client.post('incorrect_code')
    })
  })

  await inspector.enable()
})

test('Inspector with no return value', async t => {
  t.teardown(teardown)
  t.plan(1)

  server = new Inspect({ dhtKey })
  inspector = new Inspect({ dhtKey })

  await server.serve(async client => {
    const response = await client.post('Runtime.discardConsoleEntries')
    t.absent(response)
  })

  await inspector.enable()
})

test('Several calls with different return values to ensure order works', async t => {
  t.teardown(teardown)
  t.plan(10)

  server = new Inspect({ dhtKey })
  inspector = new Inspect({ dhtKey })

  await server.serve(async client => {
    const { result: { value: value0 } } = await client.post('Runtime.evaluate', { expression: '0 + 0' })
    const { result: { value: value1 } } = await client.post('Runtime.evaluate', { expression: '0 + 1' })
    const { result: { value: value2 } } = await client.post('Runtime.evaluate', { expression: '0 + 2' })
    const { result: { value: value3 } } = await client.post('Runtime.evaluate', { expression: '0 + 3' })
    const { result: { value: value4 } } = await client.post('Runtime.evaluate', { expression: '0 + 4' })
    const { result: { value: value5 } } = await client.post('Runtime.evaluate', { expression: '0 + 5' })
    const { result: { value: value6 } } = await client.post('Runtime.evaluate', { expression: '0 + 6' })
    const { result: { value: value7 } } = await client.post('Runtime.evaluate', { expression: '0 + 7' })
    const { result: { value: value8 } } = await client.post('Runtime.evaluate', { expression: '0 + 8' })
    const { result: { value: value9 } } = await client.post('Runtime.evaluate', { expression: '0 + 9' })

    t.is(value0, 0)
    t.is(value1, 1)
    t.is(value2, 2)
    t.is(value3, 3)
    t.is(value4, 4)
    t.is(value5, 5)
    t.is(value6, 6)
    t.is(value7, 7)
    t.is(value8, 8)
    t.is(value9, 9)
  })

  await inspector.enable()
})

test('Pass neither swarm nor dhtKey, throws error', t => {
  t.plan(1)
  t.exception(() => {
    new Inspect({}) // eslint-disable-line no-new
  })
})

test('Pass both swarm and dhtKey, throws error', t => {
  t.plan(1)
  t.exception(() => {
    new Inspect({ // eslint-disable-line no-new
      swarm: 'a hyperswarm object',
      dhtKey
    })
  })
})

test('Use own swarm objects', async t => {
  t.plan(5)

  const serverHs = new Hyperswarm()
  const discovery = serverHs.join(dhtKey, { server: true, client: false })
  await discovery.flushed()

  const inspectorHs = new Hyperswarm()
  await inspectorHs.join(dhtKey, { server: false, client: true })

  const server = new Inspect({ swarm: serverHs })
  await server.serve(async (client) => {
    const { result } = await client.post('Runtime.evaluate', { expression: '1 + 2 ' })
    t.ok(result)

    t.is(inspectorHs.listenerCount('connection'), 1)
    await inspector.destroy()
    t.is(inspectorHs.listenerCount('connection'), 0)

    t.is(serverHs.listenerCount('connection'), 1)
    await server.destroy()
    t.is(serverHs.listenerCount('connection'), 0)

    await inspectorHs.destroy()
    await serverHs.destroy()
  })

  const inspector = new Inspect({ swarm: inspectorHs })
  await inspector.enable()
})
