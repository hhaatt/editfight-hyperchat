"use strict";

const fs = require('fs')
const config = require('./config')
const log = require('./log')

class Discussion {
  constructor() {
    this.filename = config.chatFilename
    this.lines = this.load()
    this.dirty = false

    setInterval(
      this.maybeSave.bind(this),
      config.saveInterval * 1000
    )
  }

  load() {
    if (fs.existsSync(this.filename))
      return JSON.parse(fs.readFileSync(this.filename))
    else
      return []
  }

  maybeSave() {
    if (!this.dirty)
      return

    fs.writeFileSync(this.filename, JSON.stringify(this.lines))
    log(`Saving chat to ${this.filename}.`)
    this.dirty = false
  }

  add(line) {
    this.lines.push(line)
    this.lines = this.lines.slice(-config.maxChatLines)
    this.dirty = true
  }
}

module.exports = { Discussion }