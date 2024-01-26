const HyperDht = require('hyperdht')
const { EventEmitter } = require('events')

const VERSION = 1

class Inspector {
  constructor ({ dhtServer, keyPair, inspector, filename }) {
    const hasKeys = keyPair && (keyPair.publicKey && keyPair.secretKey)
    if (!inspector) throw new Error('Inspector constructor needs inspector to run, like "inspector/promises" or "bare-inspector"')
    if (dhtServer && hasKeys) throw new Error('Inspector constructor cannot take both dhtServer and keyPair')

    this.filename = filename || require?.main?.filename
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
      let session = null

      let hasReceivedHandshake = false
      const disconnectSession = () => {
        if (!session) return
        const isBareInspector = !session.disconnect
        if (isBareInspector) {
          session.destroy()
        } else {
          session.disconnect()
        }
        session = null
      }
      socket.setKeepAlive(5000)
      socket.on('close', disconnectSession)
      socket.on('error', () => {
        // Ignore all errors. Running pear-inspect should not affect the surrounding app
      })
      socket.on('data', async data => {
        if (!hasReceivedHandshake) {
          hasReceivedHandshake = true

          const { pearInspectVersion } = JSON.parse(data)
          const isRemoteVersionTooNew = pearInspectVersion > VERSION
          if (isRemoteVersionTooNew) {
            console.error('[pear-inspect] The remote end has a newer version than this one. Destroying socket.')
            socket.destroy()
            return
          }

          socket.write(JSON.stringify({
            pearInspectVersion: VERSION,
            filename: this.filename
          }))
          return
        }

        const { id, method, params, pearInspectMethod } = JSON.parse(data)

        // This is a way to handle sending information about thread back
        if (pearInspectMethod === 'connect') {
          session = new Session()
          session.connect()
          session.on('inspectorNotification', msg => socket.write(JSON.stringify(msg)))
          return
        }

        if (pearInspectMethod === 'disconnect') {
          disconnectSession()
          return
        }

        session?.post(method, params, (err, result) => {
          if (err) {
            socket.write(JSON.stringify({ id, error: err }))
          } else {
            socket.write(JSON.stringify({ id, result }))
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

    if (!this.dhtServerHandledExternally) {
      await this.dht.destroy()
      this.dht = null
      this.dhtServer = null
    }
  }
}

class Session extends EventEmitter {
  constructor ({ publicKey }) {
    super()

    const hasCorrectParams = !!publicKey
    if (!hasCorrectParams) throw new Error('Session constructor needs publicKey to connect to the hyperdht stream')

    let hasReceivedHandshake = false
    this.connected = false
    this.dhtClient = new HyperDht()
    this.dhtSocket = this.dhtClient.connect(publicKey)
    this.dhtSocket.write(JSON.stringify({ pearInspectVersion: VERSION }))
    this.dhtSocket.setKeepAlive(5000)
    this.dhtSocket.on('data', data => {
      if (!hasReceivedHandshake) {
        hasReceivedHandshake = true

        const { pearInspectVersion, filename } = JSON.parse(data)
        const isRemoteVersionTooNew = pearInspectVersion > VERSION
        if (isRemoteVersionTooNew) {
          console.error('[pear-inspect] The remote end has a newer version than this one. Destroying socket.')
          this.dhtSocket.destroy()
        } else {
          this.emit('info', { filename })
        }

        return
      }

      this.emit('message', JSON.parse(data))
    })
    this.dhtSocket.on('error', err => {
      const ignoreError = err?.message?.includes('connection timed out')
      if (ignoreError) return
      this.emit('error', err)
    })
    this.dhtSocket.on('close', () => {
      this.emit('close')
      this.destroy()
    })
  }

  post (params) {
    if (!this.connected) throw new Error('Session is not connected. .connect() needs to be called prior to .post()')

    this.dhtSocket?.write(JSON.stringify(params))
  }

  connect () {
    this.connected = true
    this.dhtSocket?.write(JSON.stringify({ pearInspectMethod: 'connect' }))
  }

  disconnect () {
    this.connected = false
    this.dhtSocket?.write(JSON.stringify({ pearInspectMethod: 'disconnect' }))
  }

  async destroy () {
    if (!this.dhtClient) return

    await this.dhtSocket.destroy()
    await this.dhtClient.destroy()
    this.dhtClient = null
    this.dhtSocket = null
  }
}

module.exports = {
  Inspector,
  Session
}
