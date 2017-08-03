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
  differenceThreshold: 30,
  voteDelay: 15,
  idleKickMinutes: 77,
}

process.title = 'editfight-lines'

const party = new Party({
  maxConns: 3
})

const banned = []

const server = new Server({
  port: config.port,
  origin: config.origin,
  pruneInterval: config.pruneInterval,
  shouldAllow: (ip) => (banned.indexOf(ip) === -1) && party.canAdd(ip)
})




const lines = []
const lifetimes = {}


server.onopen = (ws) => {
  ws.hash = hashForString(uuid())
  ws.uuid = uuid()
  ws.joined = (new Date()).getTime()

  party.add(ws.ip)

  server.send(ws, {
    initial: {
      lines,
      hash: ws.hash,
      uuid: ws.uuid,
      charLimit: config.charLimit,
      upvoteLimit: config.voteDelay,
      idleKickMinutes: config.idleKickMinutes,
      count: server.wss.clients.size - 1,
    },
  })

  server.sendToAll({ joined: true })
}

server.onclose = (ws) => {
  const leaving = (new Date()).getTime()
  const duration = leaving - ws.joined

  if (duration < 100) {
    const quickTimes = (lifetimes[ws.ip] || 0) + 1
    lifetimes[ws.ip] = quickTimes
    if (quickTimes >= 3) {
      banned.push(ws.ip)
    }
  }

  party.remove(ws.ip)

  if (ws.startedChatting) {
    const i = lines.indexOf(ws.line)
    lines.splice(i, 1)
    server.sendToAll({ removed: i })
  }

  server.sendToAll({ left: true })
}

const maybeBan = {}

const userCommands = {

  imadmin(ws) {
    makeAdmin(ws)
  },

  autotop(ws) {
    autotop(ws)
  },

  say(ws, text) {
    sayToAll(text)
  },

  upgrade(ws) {
    process.exit()
  },

}

server.commands = {

  say(ws, text) {
    sayToAll(text)
  },

  begin(ws, bla) {
    if (ws.startedChatting) {
      ws.terminate()
      return
    }

    ws.startedChatting = true

    const line = {
      hash: ws.hash,
      uuid: ws.uuid,
      text: '',
      upvotes: 1,
    }

    ws.line = line
    lines.push(line)
    server.sendToAll({ added: line })
  },

  unknownCommand(ws, { name, args }) {
    if (!name) return

    const cmd = userCommands[name]
    if (cmd) {
      cmd(ws, args)
    }
    else {
      log(`Unknown user command!`)
      // doesn't exist: maybe stop them
    }
  },

  color(ws, color) {
    rateLimit(ws, 'color', 0.25, () => {
      color = color.substring(0, 50)
      ws.line.color = color
      server.sendToAll({
        color: {
          uuid: ws.uuid,
          color: color
        }
      })
    })
  },

  text(ws, text) {
    resetKicker(ws)

    text = text.substring(0, config.charLimit)
    ws.line.text = text
    server.sendToAll({ update: { uuid: ws.uuid, text } })
  },

  upvote(ws, uuid) {
    if (ws.uuid === uuid) {
      ws.terminate()
      return
    }

    const now = (new Date()).getTime()
    if (ws.upvotedLast && now - ws.upvotedLast < (config.voteDelay * 1000))
      return
    ws.upvotedLast = now

    const i = lines.findIndex((line) => line.uuid === uuid)
    if (i === -1)
      return

    let bad = false
    server.wss.clients.forEach((otherWs) => {
      if (ws !== otherWs && ws.ip === otherWs.ip) {
        bad = true
        return
      }
    })

    // if (bad)
    //   return

    moveUp(i)

    server.wss.clients.forEach((ws) => {
      if (ws.uuid === uuid) {
        resetKicker(ws)
      }
    })
  },

  imadmin(ws, bla) {
    makeAdmin(ws)
  },

  autotop(ws, bla) {
    autotop(ws)
  },

  ban(ws, uuid) {
    server.wss.clients.forEach((ws) => {
      if (ws.uuid === uuid) {
        banned.push(ws.ip)
        ws.terminate()
      }
    })
  },

}

function sayToAll(text) {
  server.sendToAll({
    announcement: text
  })
}

function autotop(ws) {
  let oldIndex = lines.findIndex((line) => line.uuid === ws.uuid)
  if (oldIndex < 1) return

  const line = lines[oldIndex]
  line.autotop = true

  for (let i = oldIndex; i > 0; i--) {
    moveUp(i)
  }
}

function moveUp(oldIndex) {
  const newIndex = oldIndex - 1
  const line = lines[oldIndex]
  const tmpLine = lines[newIndex]

  if (tmpLine.autotop)
    return

  line.upvotes += 1

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

function makeAdmin(ws) {
  let i = lines.findIndex((line) => line.uuid === ws.uuid)
  const line = lines[i]
  line.admin = true
  server.sendToAll({ admin: i })
}

function resetKicker(ws) {
  if (ws.kicker) {
    clearTimeout(ws.kicker)
  }
  const n = config.idleKickMinutes * 1000 * 60 * ws.line.upvotes
  ws.kicker = setTimeout(() => kick(ws), n)
}

function kick(ws) {
  log('terminating')
  ws.terminate()
}

function rateLimit(ws, name, sec, fn) {
  ws.actions = ws.actions || {}
  ws.actions[name] = ws.actions[name] || { count: 0, ready: true }
  const action = ws.actions[name]

  if (!action.ready)
    return

  action.count += 1
  action.ready = false
  const delay = sec * 1000 * action.count
  setTimeout(() => action.ready = true, delay);
  fn()
}