"use strict";

const log = require('./lib/log')
const config = require('./lib/config')
const { Party } = require('./lib/party')
const { Story } = require('./lib/story')
const { Server } = require('./lib/server')
const { Discussion } = require('./lib/discussion')

process.title = config.title

const party = new Party(3)
const story = new Story()
const discussion = new Discussion()
const server = new Server({
  shouldAllow: (ip) => party.canAdd(ip)
})

let counter = {
  story: new Set(),
  chat: new Set(),
  what: new Set()
}

server.onopen = (ws) => {
  ws.hash = hashForString(ws.ip)
  party.add(ws.ip)

  ws.counter = counter.what
  ws.counter.add(ws)

  sendCounterUpdateToAll()

  server.send(ws, {
    words: story.words,
    lines: discussion.lines,
    hash: ws.hash,
    maxChatLines: config.maxChatLines,
  })
}

server.onclose = (ws) => {
  party.remove(ws.ip)
  ws.counter.delete(ws)
  sendCounterUpdateToAll()
}

function sendCounterUpdateToAll() {
  server.sendToAll({
    counts: {
      story: counter.story.size,
      chat: counter.chat.size,
      idle: counter.what.size
    },
  })
}

server.commands = {

  say(ws, json) {
    server.sendToAll({
      announcement: json.text
    })
  },

  tab(ws, json) {
    const theCounter = counter[json.tab]
    if (!theCounter || theCounter === ws.counter)
      return

    ws.counter.delete(ws)
    ws.counter = theCounter
    ws.counter.add(ws)

    sendCounterUpdateToAll()
  },

  story(ws, json) {
    const text = json.text.substring(0, 16).replace(/[^\x21-\x7F]/g, '')
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

  chat(ws, json) {
    const text = json.text.substring(0, 256).replace(/[^\x20-\x7F]/g, '')
    if (text.length === 0)
      return

    const line = {
      text: text,
      hash: ws.hash
    }

    discussion.add(line)

    server.sendToAll({
      lines: [line]
    })
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