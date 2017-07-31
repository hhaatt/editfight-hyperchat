"use strict";

const log = require('./lib/log')
const { Party } = require('./lib/party')
const { Server } = require('./lib/server')
const uuid = require('uuid/v4');

const config = {
  port: 4000,
  origin: process.env.NODE_ORIGIN,
  pruneInterval: 30,
  charLimit: 1000,
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


server.onopen = (ws) => {
  ws.hash = hashForString(uuid())
  ws.uuid = uuid()

  party.add(ws.ip)

  server.send(ws, {
    initial: lines,
    hash: ws.hash,
    uuid: ws.uuid,
    charLimit: config.charLimit,
  })

  const line = {
    hash: ws.hash,
    uuid: ws.uuid,
    text: '',
  }

  ws.line = line
  lines.push(line)
  server.sendToAll({ added: line })
}

server.onclose = (ws) => {
  party.remove(ws.ip)

  const i = lines.indexOf(ws.line)
  lines.splice(i, 1)
  server.sendToAll({ removed: i })
}

server.commands = {

  say(ws, text) {
    server.sendToAll({
      announcement: text
    })
  },

  text(ws, text) {
    text = text.substring(0, config.charLimit)
    ws.line.text = text
    server.sendToAll({ update: { uuid: ws.uuid, text } })
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