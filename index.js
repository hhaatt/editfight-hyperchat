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



let counter = new Set()

server.onopen = (ws) => {
  ws.hash = hashForString(ws.ip)
  party.add(ws.ip)

  counter.add(ws)

  sendCounterUpdateToAll()

  server.send(ws, {
    words: story.words,
    hash: ws.hash,
  })
}

server.onclose = (ws) => {
  party.remove(ws.ip)
  counter.delete(ws)
  sendCounterUpdateToAll()
}

function sendCounterUpdateToAll() {
  server.sendToAll({
    counter: counter.size
  })
}

server.commands = {

  say(ws, text) {
    server.sendToAll({
      announcement: text
    })
  },

  story(ws, text) {
    text = text.substring(0, 16).replace(/[^\x21-\x7F]/g, '')
    if (text.length === 0)
      return

    const word = {
      text: text,
      hash: ws.hash
    }

    story.add(word)

    if (story.full) {
      story.rollover()
      server.sendToAll({
        reset: true
      })
    }
    else {
      server.sendToAll({
        words: [word]
      })
    }
  },

}

function hashForString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return hash
}

server.run()