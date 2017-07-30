"use strict";

module.exports = {
  title: 'edit-fight',
  port: 4000,
  origin: process.env.NODE_ORIGIN,
  pruneInterval: 30,
  saveInterval: 10,
  maxWords: 250,
  maxChatLines: 100,
  fileFormat: 'data/storyNNN.json',
  filename: 'data/story.json',
  chatFilename: 'data/chat.json'
}