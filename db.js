const config = require('./config')
const assert = require('assert')
const MongoClient = require('mongodb').MongoClient

let _db

function initDB(callback) {
  if (_db) {
    console.warn("Trying to init DB again!")
    return callback(null, _db)
  }

  MongoClient.connect(config.DB_CONNECTION_STR, { useNewUrlParser: true }, connected)

  function connected(err, client) {
    if (err) { return callback(err) }

    console.log("DB initialised")
    _db = client.db('jukebox')

    return callback(null, _db)
  }
}

function getDB() {
  assert.ok(_db, "DB has not been initialized. Call initDB first.")
  return _db
}

module.exports = {
  getDB,
  initDB
}
