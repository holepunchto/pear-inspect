const Hyperswarm = require('hyperswarm')
const { Session } = require('bare-inspector') // Also support 'inspector' (from pear) and maybe 'node:inspector/promises'

module.exports = class PearInspect {
  constructor ({ swarm, dhtKey }) {
    const hasNoSwarmOrKey = !swarm && !dhtKey
    const hasBothSwarmAndKey = swarm && dhtKey
    if (hasNoSwarmOrKey) throw new Error('pear-inspect needs swarm or dhtKey')
    if (hasBothSwarmAndKey) throw new Error('pear-inspect needs either swarm or dhtKey, not both')

    this.swarm = swarm
    this.dhtKey = dhtKey
  }

  async enable () {
    if (!this.swarm) {
      this.swarm = new Hyperswarm()
      const discovery = this.swarm.join(this.dhtKey, { server: true, client: true })
      await discovery.flushed()
    }

    this.connectionHandler = (conn, info) => {
      const session = new Session()
      session.connect()

      this.conn = conn
      this.conn.on('error', () => session.destroy())
      this.conn.on('data', async argsBuf => {
        const args = JSON.parse(argsBuf)
        try {
          const response = await session.post(...args)
          this.conn.write(Buffer.from(JSON.stringify({ response })))
        } catch (err) {
          this.conn.write(Buffer.from(JSON.stringify({ error: err.message })))
        }
      })
    }

    this.swarm.on('connection', this.connectionHandler)
  }

  async disable () {
    if (!this.connectionHandler) return

    this.swarm.off('connection', this.connectionHandler)
    this.connectionHandler = null

    const wasStartedWithKey = !!this.dhtKey
    if (wasStartedWithKey) {
      await this.swarm.destroy()
      this.swarm = null
    }
  }

  async post (...args) {
    // If not already connected, then establish connection to swarm
    // The connection handler has to be added before joining the swarm
    const shouldConnect = !this.swarm

    if (shouldConnect) {
      this.swarm = new Hyperswarm()
    }

    if (!this.connectionHandler) {
      console.log('setting connectionHandler')
      this.connectionHandler = (conn, info) => {
        console.log('setting connection')
        this.connection = conn
      }
      this.swarm.on('connection', this.connectionHandler)
      await this.swarm.flush()
    }

    if (shouldConnect) {
      this.swarm.join(this.dhtKey, { server: false, client: true })
      await this.swarm.flush()
    }

    // Promise that resolves when upon the next data/error event is fired
    return new Promise((resolve, reject) => {
      const onNextData = (argsBuf) => {
        const args = JSON.parse(argsBuf)
        const { response, error } = args

        this.connection.off('data', onNextData)
        this.connection.off('error', onNextError)

        if (error) return reject(error)

        const isEmptyResponse = JSON.stringify(response) === '{}'
        resolve(isEmptyResponse ? undefined : response)
      }
      const onNextError = (err) => {
        this.connection.off('data', onNextData)
        this.connection.off('error', onNextError)
        reject(err)
      }

      this.connection.once('data', onNextData)
      this.connection.once('error', onNextError)
      this.connection.write(Buffer.from(JSON.stringify(args)))
    })
  }
}
