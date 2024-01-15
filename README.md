# bare-inspector-swarm

Connects a [hyperswarm](https://github.com/holepunchto/hyperswarm) with a [bare-inspector](https://github.com/holepunchto/bare-inspector).

Instead of using `node` to run this, you are required to run with [bare](https://github.com/holepunchto/bare).

## Installation

```
npm i @holepunchto/bare-inspector-swarm
```

## Usage

On the server-side do this:

``` js
import Hyperswarm from 'hyperswarm'
import BareInspectorSwarm from 'bare-inspector-swarm'

const server = new Hyperswarm()
const topic = Buffer.alloc(32).fill('hello world')
const discovery = server.join(topic, { server: true, client: false })
await discovery.flushed()

const bis = new BareInspectorSwarm(server)

// To kill the BareInspectorSwarm:
//  bis.destroy()
```

On the client-side connect to the hyperswarm:

``` js
import Hyperswarm from 'hyperswarm'

const client = new Hyperswarm()

client.join(topic, { server: false, client: true })
await client.flush()

client.on('connection', conn => {
  // The client is now connected to the server which wraps the BareInspectorSwarm
  conn.write(Buffer.from(JSON.stringify(['Runtime.evaluate', { expression: '1 + 2' }])))

  conn.on('data', response => {
    // The response from doing ('Runtime.evaluate', { expression: '1 + 2' }) on the bare-inspector
    console.log(JSON.parse(response))
    /*
      {
        result: {
          type: 'number',
          value: 3,
          description: '3'
        }
      }
    */
  })
})
```
