"use strict";

const { Party } = require('./lib/party')
const { Server } = require('./lib/server')

const config = {
  port: 4000,
  origin: process.env.NODE_ORIGIN,
  pruneInterval: 30,
}

process.title = 'editfight-lines'

const party = new Party({
  maxConns: 3
})

const server = new Server({
  port: config.port,
  origin: config.origin,
  pruneInterval: config.pruneInterval,
  shouldAllow: (ip) => party.canAdd(ip)
})




const lines = []
const mapping = new Map()


server.onopen = (ws) => {
  ws.hash = hashForString(ws.ip)
  party.add(ws.ip)

  server.send(ws, {
    initial: lines,
    hash: ws.hash,
  })

  const line = {
    hash: ws.hash,
    text: '',
  }

  const newIndex = lines.push(line) - 1
  mapping.set(ws, newIndex)

  server.sendToAll({ added: { i: newIndex, line } })
}

server.onclose = (ws) => {
  party.remove(ws.ip)

  const i = mapping.get(ws)
  lines.splice(i, 1)
  mapping.delete(ws)

  server.sendToAll({ removed: i })
}

server.commands = {

  say(ws, text) {
    server.sendToAll({
      announcement: text
    })
  },

  text(ws, text) {
    text = text.substring(0, 16).replace(/[^\x20-\x7F]/g, '')

    const i = mapping.get(ws)
    lines[i].text = text
    server.sendToAll({ update: { i, text } })
  }

}

function hashForString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return hash
}

server.run()