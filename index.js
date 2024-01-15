const { Session } = require('bare-inspector')

module.exports = class BareInspectorSwarm {
  constructor (swarm) {
    this.swarm = swarm
    this.connectionHandler = (conn, info) => {
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
    }

    swarm.on('connection', this.connectionHandler)
  }

  destroy () {
    this.swarm.off('connection', this.connectionHandler)
  }
}
