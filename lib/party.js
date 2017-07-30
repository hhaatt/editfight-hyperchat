"use strict";

class Party {
  constructor(maxConns) {
    this.maxConns = maxConns
    this.ips = {}
  }

  canAdd(ip) {
    return this.count(ip) < this.maxConns
  }

  count(ip) {
    return (this.ips[ip] || 0)
  }

  add(ip) {
    this.ips[ip] = this.count(ip) + 1
  }

  remove(ip) {
    this.ips[ip] = this.count(ip) - 1
    if (!this.ips[ip]) {
      delete this.ips[ip]
    }
  }
}

module.exports = { Party }