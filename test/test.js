const test = require('brittle')
const Hyperswarm = require('hyperswarm')
const BareInspectorSwarm = require('../')

const randomKey = Array(32).fill(0).map(() => Math.random().toString(36).charAt(2)).join('') // No access to crypto module
const topicKey = Buffer.from(randomKey)

let server

test('setup', async t => {
  server = new Hyperswarm()
  const discovery = server.join(topicKey, { server: true, client: false })
  await discovery.flushed()

  t.pass()
})

test('inspector can evaluate', async t => {
  t.plan(3)
  new BareInspectorSwarm(server) // eslint-disable-line no-new

  const client = new Hyperswarm()
  client.on('close', err => {
    console.log('client close', err)
  })
  client.on('connection', (conn, info) => {
    conn.on('data', async data => {
      const { result: { type, value, description } } = JSON.parse(data)
      t.is(type, 'number')
      t.is(value, 3)
      t.is(description, '3')
      client.destroy()
    })

    conn.write(Buffer.from(JSON.stringify(['Runtime.evaluate', { expression: '1 + 2' }])))
  })

  client.join(topicKey, { server: false, client: true })
  await client.flush()
})

test('teardown', async t => {
  await server.destroy()
  // t.pass()
})
