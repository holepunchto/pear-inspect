const Hyperswarm = require('hyperswarm')
const { Session } = require('inspector')
const { EventEmitter } = require('stream')

class Inspector {
  constructor ({ swarm, dhtKey }) {
    const hasCorrectParams = (swarm && !dhtKey) || (!swarm && dhtKey)
    if (!hasCorrectParams) throw new Error('pear-inspect needs swarm or dhtKey, not both')

    this.swarm = swarm
    this.dhtKey = dhtKey
  }

  async enable () {
    this.connectionHandler = (conn, info) => {
      const session = new Session()
      session.connect()

      // Should probably send a message announcing itself (and its app key) to the Server

      conn.on('error', () => session.disconnect())
      conn.on('data', async argsBuf => {
        const args = JSON.parse(argsBuf)

        session.post(...args, (err, response) => {
          if (err) return conn.write(Buffer.from(JSON.stringify({ error: err.message })))

          conn.write(Buffer.from(JSON.stringify({ response })))
        })
      })
    }

    if (this.swarm) {
      this.swarm.on('connection', this.connectionHandler)
      await this.swarm.flush()
    } else {
      this.swarm = new Hyperswarm()
      this.swarm.on('connection', this.connectionHandler)
      this.swarm.join(this.dhtKey, { server: false, client: true })
      await this.swarm.flush()
    }
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
}

class Server extends EventEmitter {
  constructor ({ swarm, dhtKey }) {
    super()

    const hasCorrectParams = (swarm && !dhtKey) || (!swarm && dhtKey)
    if (!hasCorrectParams) throw new Error('pear-inspect needs swarm or dhtKey, not both')

    this.swarm = swarm
    this.dhtKey = dhtKey
  }

  async start () {
    const shouldCreateSwarm = !this.swarm

    if (shouldCreateSwarm) {
      this.swarm = new Hyperswarm()
    }

    this.connectionHandler = (conn, info) => {
      conn.on('error', err => {
        const shouldIgnoreError = err?.code === 'ECONNRESET'
        if (!shouldIgnoreError) this.emit('error', err)
      })
      this.emit('client', {
        post: (...args) => {
          return new Promise((resolve, reject) => {
            conn.once('data', argsBuf => {
              const args = JSON.parse(argsBuf)
              const { response, error } = args

              if (error) return reject(error)

              const isEmptyResponse = JSON.stringify(response) === '{}'
              resolve(isEmptyResponse ? undefined : response)
            })

            conn.write(Buffer.from(JSON.stringify(args)))
          })
        }
      })
    }

    this.swarm.on('connection', this.connectionHandler)

    if (shouldCreateSwarm) {
      const discovery = this.swarm.join(this.dhtKey, { server: true, client: false })
      await discovery.flushed()
    }
  }

  async stop () {
    if (!this.connectionHandler) return

    this.swarm.off('connection', this.connectionHandler)
    this.connectionHandler = null

    const wasStartedWithKey = !!this.dhtKey
    if (wasStartedWithKey) {
      await this.swarm.destroy()
      this.swarm = null
    }
  }
}

module.exports = {
  Inspector,
  Server
}
