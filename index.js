const HyperDht = require('hyperdht')
const { EventEmitter } = require('events')

class AppInspector {
  constructor ({ dhtServer, keyPair, inspector }) {
    const hasKeys = keyPair && (keyPair.publicKey && keyPair.secretKey)
    if (!inspector) throw new Error('AppInspector constructor needs inspector to run, like "inspector/promises" or "bare-inspector"')
    if (dhtServer && hasKeys) throw new Error('AppInspector constructor cannot take both dhtServer and keyPair')

    this.inspector = inspector
    this.dhtServer = dhtServer || null
    this.publicKey = keyPair?.publicKey || null
    this.secretKey = keyPair?.secretKey || null
    this.dhtServerHandledExternally = !!dhtServer
    this.stopping = false
  }

  async enable () {
    const shouldCreateServer = !this.dhtServer
    const shouldCreateKeyPair = shouldCreateServer && !this.publicKey

    if (shouldCreateKeyPair) {
      const keyPair = HyperDht.keyPair()
      this.publicKey = keyPair.publicKey
      this.secretKey = keyPair.secretKey
    }

    if (shouldCreateServer) {
      this.dht = new HyperDht()
      this.dhtServer = this.dht.createServer()
    }

    this.connectionHandler = socket => {
      const { Session } = this.inspector
      this.session = new Session()
      this.session.connect()

      this.session.on('inspectorNotification', msg => {
        socket.write(JSON.stringify(msg))
      })
      socket.on('error', err => {
        if (!this.stopping) throw new Error(err)
      })
      socket.on('data', async data => {
        const { id, method, params } = JSON.parse(data)

        this.session.post(method, params, (err, result) => {
          if (err) {
            socket.write(JSON.stringify({ id, error: err }))
          } else {
            socket.write(JSON.stringify({ id, result: result.result }))
          }
        })
      })
    }

    this.dhtServer.on('connection', this.connectionHandler)

    if (shouldCreateServer) {
      const keyPair = {
        publicKey: this.publicKey,
        secretKey: this.secretKey
      }
      await this.dhtServer.listen(keyPair)
      return keyPair
    }
  }

  async disable () {
    if (!this.connectionHandler || this.stopping) return

    this.stopping = true
    this.dhtServer.off('connection', this.connectionHandler)
    this.connectionHandler = null
    this.session.disconnect()
    this.session = null

    if (!this.dhtServerHandledExternally) {
      await this.dht.destroy()
      this.dht = null
      this.dhtServer = null
    }
  }
}

class Client extends EventEmitter {
  constructor ({ publicKey }) {
    super()

    const hasCorrectParams = !!publicKey
    if (!hasCorrectParams) throw new Error('Client constructor needs publicKey to connect to the hyperdht stream')

    this.dhtClient = new HyperDht()
    this.peerStream = this.dhtClient.connect(publicKey)
    this.peerStream.on('data', data => this.emit('message', JSON.parse(data)))
  }

  send ({ id, method, params }) {
    this.peerStream.write(JSON.stringify({ id, method, params }))
  }

  async destroy () {
    if (!this.dhtClient) return

    await this.peerStream.destroy()
    await this.dhtClient.destroy()
    this.dhtClient = null
    this.peerStream = null
  }
}

module.exports = {
  AppInspector,
  Client
}
