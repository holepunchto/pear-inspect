# Pear Inspect Protocol

The goal is to be able to use chrome://inspect and DevTools to debug a Pear User App running in terminal mode.

![Sequence diagram][sequence-diagram.png]

## chrome://inspect discovery

In the chrome://inspect window there is a list of processes it's able to process. This is done over http://localhost:9229. On the Pear-side of things, this is handled by the `Pear Inspector`.

`Pear Inspector` is its own Pear desktop app.

## DevTools debugging a User App (DevTools <--> terminal.js[User App])

It's first important to understand that a User App will be run in a way similar to `$ pear dev . --inspect`. The User App's code will not know that it's being debugged, and there's no need to add any code to it.

It's also important to understand that when Pear runs a terminal app, it's really the file `terminal.js` that does most of the wrapping. Since Pear is using `bare` when running a terminal app, we do not have access to node's module `inspector`. Instead the `bare-inspector` module is used. It's working the same way, so they are interchangable.

When a debug session is running, this is what's going on:

```
DevTools  <==websocket==>  Pear Inspector  <==hyperdht==>  terminal.js  <==bare-inspector==> User App
```

Note that `terminal.js` and `User App` is the same process.

The reason for using `hyperdht` between `Pear Inspector` and `terminal.js` is because it's already encrypted and works using the `bare` runtime.

## Exchange of the hyperdht keys

Before `Pear Inspector` can communicate with `terminal.js` it needs the public key to connect to `terminal.js`. Since they do not have direct access to each other, this exchange is done using `Sidecar`.

This exchange is handled using an IPC method in Pear.

When a Pear User App is started with `--inspect` it sends a message to `Sidecar` saying that it's availble for inspection and it's `public key`. `Pear Inspector` polls `Sidecar` every X seconds (or gets sent a message..?) to get a list of the apps that are available for inspection and their `public keys`.
