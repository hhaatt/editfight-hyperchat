"use strict";

const fs = require('fs')
const config = require('./config')
const log = require('./log')

class Story {
  constructor() {
    this.filename = config.filename
    this.words = this.load()
    this.dirty = false

    setInterval(
      this.maybeSave.bind(this),
      config.saveInterval * 1000
    )
  }

  moveFile() {
    const regex = /N+/
    const found = config.fileFormat.match(regex)
    const digits = found[0].length
    const index = found.index

    let fileNumber = 0
    let newFilename

    while (true) {
      const numString = fileNumber.toString().padStart(digits, '0')
      newFilename = config.fileFormat.replace(regex, numString)
      log(`Trying filename "${newFilename}"...`)

      if (!fs.existsSync(newFilename)) {
        break
      }

      fileNumber++
    }

    fs.renameSync(config.filename, newFilename)
    log('Done: moved file to that filename')
  }

  load() {
    if (fs.existsSync(this.filename))
      return JSON.parse(fs.readFileSync(this.filename))
    else
      return []
  }

  get full() {
    return this.words.length >= config.maxWords
  }

  rollover() {
    this.forceSave()
    this.moveFile()
    this.words = []
    this.forceSave()
  }

  forceSave() {
    this.dirty = true
    this.maybeSave()
  }

  maybeSave() {
    if (!this.dirty)
      return

    fs.writeFileSync(this.filename, JSON.stringify(this.words))
    log(`Saving story to ${this.filename}.`)
    this.dirty = false
  }

  add(word) {
    this.words.push(word)
    this.dirty = true
  }
}

module.exports = { Story }