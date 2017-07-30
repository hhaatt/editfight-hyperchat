"use strict";

const WebSocket = require('ws')
const config = require('./config')
const log = require('./log')

class Server {

  constructor(options) {
    this.shouldAllow = options.shouldAllow
    this.commands = {}
  }

  run() {
    log(`Running on port ${config.port}`)

    this.wss = new WebSocket.Server({
      port: config.port,
      verifyClient: this.verify.bind(this)
    })

    setInterval(
      this.prune.bind(this),
      config.pruneInterval * 1000
    )

    this.wss.on(
      'connection',
      this.connection.bind(this)
    )
  }

  verify(info) {
    const ip = info.req.connection.remoteAddress
    log(`Verifying ${ip}`)

    if (config.origin && info.origin !== config.origin) {
      log(`Rejected ${ip}: bad origin "${info.origin}"`)
      return false
    }

    if (this.shouldAllow && !this.shouldAllow(ip)) {
      log(`Rejected ${ip}: max conns`)
      return false
    }

    log(`Accepted ${ip}`)
    return true
  }

  connection(ws, req) {
    const ip = req.connection.remoteAddress
    log(`Connection from ${ip}`)

    ws.ip = ip
    ws.isAlive = true

    this.onopen(ws)

    ws.on('pong', () => {
      ws.isAlive = true
    })

    ws.on('close', (code, reason) => {
      this.onclose(ws)
      log(`Disconnected ${ip} with code [${code}] reason [${reason}]`)
    })

    ws.on('message', (message) => {
      log(`Received message from IP ${ip}: ${message}`)

      try {
        const json = JSON.parse(message)

        Object.entries(json).forEach(([key, value]) => {
          const cmd = this.commands[key]
          if (cmd) cmd(ws, value)
        })
      }
      catch (e) {
        log(`Error: ${e}`)
      }
    })
  }

  prune() {
    this.wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        log('Pruning dead connection.')
        return ws.terminate()
      }

      ws.isAlive = false
      ws.ping('', false, true)
    })
  }

  send(ws, msg) {
    this.sendTo([ws], msg)
  }

  sendToAll(msg) {
    this.sendTo(this.wss.clients, msg)
  }

  sendTo(clients, msg) {
    const data = JSON.stringify(msg)
    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })
  }

}

module.exports = { Server }