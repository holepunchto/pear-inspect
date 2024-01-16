const test = require('brittle')
const PearInspect = require('../')
const Hyperswarm = require('hyperswarm')

const randomKey = Array(32).fill(0).map(() => Math.random().toString(36).charAt(2)).join('') // No access to crypto module
const dhtKey = Buffer.from(randomKey)

let insideAppInspector
let outsideAppInspector

test('Setup', async t => {
  insideAppInspector = new PearInspect({ dhtKey })
  outsideAppInspector = new PearInspect({ dhtKey })

  await insideAppInspector.enable()
})

test('Inspector evaluates correctly', async t => {
  t.plan(3)

  const response = await outsideAppInspector.post('Runtime.evaluate', { expression: '1 + 2' })
  const { result: { type, value, description } } = response
  t.is(type, 'number')
  t.is(value, 3)
  t.is(description, '3')
})

test('Post with errornous code rejects promise', async t => {
  t.plan(1)
  t.exception(async () => {
    await outsideAppInspector.post('incorrect_code')
  })
})

test('Inspector with no return value', async t => {
  t.plan(1)

  const response = await outsideAppInspector.post('Runtime.discardConsoleEntries')
  t.absent(response)
})

test('Several calls with different return values to ensure order works', async t => {
  t.plan(10)

  const { result: { value: value0 } } = await outsideAppInspector.post('Runtime.evaluate', { expression: '0 + 0' })
  const { result: { value: value1 } } = await outsideAppInspector.post('Runtime.evaluate', { expression: '0 + 1' })
  const { result: { value: value2 } } = await outsideAppInspector.post('Runtime.evaluate', { expression: '0 + 2' })
  const { result: { value: value3 } } = await outsideAppInspector.post('Runtime.evaluate', { expression: '0 + 3' })
  const { result: { value: value4 } } = await outsideAppInspector.post('Runtime.evaluate', { expression: '0 + 4' })
  const { result: { value: value5 } } = await outsideAppInspector.post('Runtime.evaluate', { expression: '0 + 5' })
  const { result: { value: value6 } } = await outsideAppInspector.post('Runtime.evaluate', { expression: '0 + 6' })
  const { result: { value: value7 } } = await outsideAppInspector.post('Runtime.evaluate', { expression: '0 + 7' })
  const { result: { value: value8 } } = await outsideAppInspector.post('Runtime.evaluate', { expression: '0 + 8' })
  const { result: { value: value9 } } = await outsideAppInspector.post('Runtime.evaluate', { expression: '0 + 9' })

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

test('Teardown', async t => {
  await insideAppInspector.disable()
  await outsideAppInspector.disable()
})

test('Pass neither swarm nor dhtKey, throws error', t => {
  t.plan(1)
  t.exception(() => {
    new PearInspect({}) // eslint-disable-line no-new
  })
})

test('Pass bth swarm and dhtKey, throws error', t => {
  t.plan(1)
  t.exception(() => {
    new PearInspect({ // eslint-disable-line no-new
      swarm: 'a hyperswarm object',
      dhtKey
    })
  })
})

test('Use own swarm objects', async t => {
  t.plan(3)

  const insideAppHs = new Hyperswarm()
  const discovery = insideAppHs.join(dhtKey, { server: true, client: false })
  await discovery.flushed()

  const outsideAppHs = new Hyperswarm()
  await outsideAppHs.join(dhtKey, { server: false, client: true })

  const insideAppPI = new PearInspect({ swarm: insideAppHs })
  const outsideAppPI = new PearInspect({ swarm: outsideAppHs })

  await insideAppPI.enable()
  const { result } = await outsideAppPI.post('Runtime.evaluate', { expression: '1 + 2 ' })
  t.ok(result)

  t.is(insideAppHs.listenerCount('connection'), 1)
  await insideAppPI.disable()
  t.is(insideAppHs.listenerCount('connection'), 0)

  await insideAppHs.destroy()
  await outsideAppHs.destroy()
})
