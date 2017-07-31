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
  allowedUpvoteTimes: 3,
  upvotesNeededToMoveUp: 3,
  differenceThreshold: 100,
}

process.title = 'editfight-lines'

const party = new Party({
  maxConns: 3
})

const banned = [
  '192.227.165.56',
  '176.31.171.134',
]

const server = new Server({
  port: config.port,
  origin: config.origin,
  pruneInterval: config.pruneInterval,
  shouldAllow: (ip) => (banned.indexOf(ip) === -1) && party.canAdd(ip)
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

const maybeBan = {}

server.commands = {

  say(ws, text) {
    server.sendToAll({
      announcement: text
    })
  },

  text(ws, text) {
    text = text.substring(0, config.charLimit)

    const oldLen = ws.line.text.length
    const newLen = text.length

    console.log(oldLen, newLen, ws.terminate)

    if (newLen != 0 && Math.abs(oldLen - newLen) > config.differenceThreshold) {
      maybeBan[ws.ip] = (maybeBan[ws.ip] || 0) + 1
      if (maybeBan >= 3) {
        banned.push(ws.ip)
      }
      ws.terminate()
      return
    }

    ws.line.text = text
    server.sendToAll({ update: { uuid: ws.uuid, text } })
  },

  upvote(ws, uuid) {
    console.log('upvoting', uuid)
    if (ws.upvotedTimes >= config.allowedUpvoteTimes)
      return

    ws.upvotedTimes = (ws.upvotedTimes || 0) + 1

    const oldIndex = lines.findIndex((line) => line.uuid === uuid)
    if (oldIndex > 0) {
      const line = lines[oldIndex]
      line.upvotes = (line.upvotes || 0) + 1
      if (line.upvotes >= config.upvotesNeededToMoveUp) {
        moveUp(oldIndex)
      }
    }
  },

  autotop(ws, bla) {
    let oldIndex = lines.findIndex((line) => line.uuid === ws.uuid)
    if (oldIndex < 1) return

    const line = lines[oldIndex]
    line.autotop = true

    for (let i = oldIndex; i > 0; i--) {
      moveUp(i)
    }
  }

}

function moveUp(oldIndex) {
  const newIndex = oldIndex - 1
  const line = lines[oldIndex]
  const tmpLine = lines[newIndex]

  if (tmpLine.autotop)
    return

  lines[newIndex] = line
  lines[oldIndex] = tmpLine
  server.sendToAll({ moved: oldIndex })
}

function hashForString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return hash
}

server.run()