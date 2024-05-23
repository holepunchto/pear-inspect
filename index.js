const HyperDht = require('hyperdht')
const { EventEmitter } = require('events')
const b4a = require('b4a')
const path = require('path')
const { isBare } = require('which-runtime')

const VERSION = 2

class Inspector {
  constructor ({ dhtServer, inspectorKey, inspector, filename } = {}) {
    if (dhtServer && inspectorKey) throw new Error('Inspector constructor cannot take both dhtServer and inspectorKey')
    if (!inspector) {
      try {
        inspector = require('inspector')
      } catch {
        throw new Error('Inspector constructor needs inspector to run, like "inspector" or "bare-inspector"')
      }
    }

    const pearFilename = global?.Pear?.config?.dir && path.join(global.Pear.config.dir, global.Pear.config.main)
    this.filename = filename || pearFilename || require?.main?.filename || process?.argv?.[1]
    this.inspector = inspector
    this.dhtServer = dhtServer || null
    this.inspectorKey = inspectorKey || null
    this.dhtServerHandledExternally = !!dhtServer
    this.stopping = false
    this.oldGlobalConsole = null
  }

  _overrideGlobalConsole () {
    // Overriding the global.console is needed for bare-inspector (and pear-inspect)
    // to be able to read logs
    const bareInspectorConsole = new this.inspector.Console()
    const newGlobalConsole = {}
    for (const method of Object.keys(bareInspectorConsole)) {
      newGlobalConsole[method] = (...args) => {
        bareInspectorConsole[method](...args)
        this.oldGlobalConsole[method](...args)
      }
    }

    this.oldGlobalConsole = global.console
    global.console = newGlobalConsole
  }

  _resetGlobalConsole () {
    if (!this.oldGlobalConsole) return

    global.console = this.oldGlobalConsole
    this.oldGlobalConsole = null
  }

  async enable () {
    const shouldCreateServer = !this.dhtServer
    const shouldGenerateSeed = shouldCreateServer && !this.inspectorKey

    if (shouldGenerateSeed) {
      const keyPair = HyperDht.keyPair()
      const seed = keyPair.secretKey.subarray(0, 32)
      this.inspectorKey = seed
      this.publicKey = keyPair.publicKey
      this.secretKey = keyPair.secretKey
    } else {
      const keyPair = HyperDht.keyPair(this.inspectorKey)
      this.publicKey = keyPair.publicKey
      this.secretKey = keyPair.secretKey
    }

    if (shouldCreateServer) {
      this.dht = new HyperDht()
      this.dhtServer = this.dht.createServer({
        firewall (remotePublicKey, remote) {
          return !b4a.equals(remotePublicKey, this.publicKey)
        }
      })
    }

    if (isBare) this._overrideGlobalConsole()

    this.connectionHandler = socket => {
      let session = null

      let hasReceivedHandshake = false
      const disconnectSession = () => {
        if (!session) return
        if (isBare) {
          session.destroy()
          this._resetGlobalConsole()
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
          session = new this.inspector.Session()

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
      await this.dhtServer.listen({
        publicKey: this.publicKey,
        secretKey: this.secretKey
      })
      return this.inspectorKey
    }
  }

  async disable () {
    if (!this.connectionHandler || this.stopping) return

    this.stopping = true
    this.dhtServer.off('connection', this.connectionHandler)
    this.connectionHandler = null

    if (isBare) this._resetGlobalConsole()

    if (!this.dhtServerHandledExternally) {
      await this.dht.destroy()
      this.dht = null
      this.dhtServer = null
    }
  }
}

class Session extends EventEmitter {
  constructor ({ inspectorKey, publicKey }) {
    super()

    const hasCorrectParams = (inspectorKey && !publicKey) || (!inspectorKey && publicKey)
    if (!hasCorrectParams) throw new Error('Session constructor needs inspectorKey or publicKey to connect to the hyperdht stream')

    let hasReceivedHandshake = false
    this.connected = false
    this.dhtClient = new HyperDht()
    this.dhtSocket = null
    if (inspectorKey) {
      const keyPair = HyperDht.keyPair(inspectorKey)
      this.dhtSocket = this.dhtClient.connect(keyPair.publicKey, { keyPair })
    } else {
      this.dhtSocket = this.dhtClient.connect(publicKey)
    }
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
