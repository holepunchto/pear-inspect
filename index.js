const { Session } = require('bare-inspector')

module.exports = class BareInspectorSwarm {
  constructor (swarm) {
    swarm.on('connection', (conn, info) => {
      const session = new Session()
      session.connect()

      conn.on('data', async argsBuf => {
        const args = JSON.parse(argsBuf)
        const response = await session.post(...args)
        conn.write(Buffer.from(JSON.stringify(response)))
      })
      conn.on('error', () => {
        session.destroy()
      })
    })
  }
}
