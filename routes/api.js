const config = require('../config')
const initDB = require('../db').initDB
const getDB = require('../db').getDB
const ObjectId = require('mongodb').ObjectID
const request = require('request')
const router = require('express').Router()

const { Sonos } = require('sonos')
const speaker = new Sonos(config.SONOS_SPEAKER_IP)

let io = (req) => { return req.app.get('socketio') }

router.get('/cards', (req, res) => {
  // let where = {}
  // let ltCardId = req.query.ltCardId
  // let gtCardId = req.query.gtCardId
  //
  // if (typeof(ltCardId) !== "undefined") {
  //   where = {"_id":{$lt:ObjectId(ltCardId)}}
  // } else if (typeof(gtCardId) !== "undefined") {
  //   where = {"_id":{$gt:ObjectId(gtCardId)}}
  // }

  let page = parseInt(req.query.page)
  let q = req.query.q
  let findOpts = {}

  if (q) {
    findOpts = { $text: { $search: q }}
  }

  getDB().collection('cards').find(findOpts).sort({ _id: -1 }).skip(10 * (page - 1)).limit(10).toArray((err, cards) => {
    if (err) return console.log(err)

    res.send(cards)
  })
})

router.post('/cards', (req, res) => {
  getDB().collection('cards').insertOne(req.body, (err, results) => {
    if (err) return console.log(err)

    // console.log(results)
    io(req).emit('cardAdded', req.body)
    res.send(results)
  })
})

router.put('/cards/:cardId', (req, res) => {
  getDB().collection('cards').findOne({ number: req.params.cardId }, (err, card) => {
    if (card && card.uri) { // scanned and configured
      var playMode
      if (card.shuffle && card.repeat) {
        playMode = "SHUFFLE"
      } else if (card.shuffle) {
        playMode = "SHUFFLE_NOREPEAT"
      } else if (card.repeat) {
        playMode = "REPEAT_ALL"
      } else {
        playMode = "NORMAL"
      }

      // The node Sonos API in use is async
      // Order of operations - clear queue; set play mode; add URI to queue; start playing
      // speaker.selectQueue() may be preferable to speaker.play(), as it does begin playback,
      // and might prevent issues with restarting a third-party session e.g. Spotify!
      speaker.flush().then(result => {
        console.log('Flushed queue %j', result)
        return speaker.setPlayMode(playMode)
      }).then(result => {
        console.log('Set play mode %j', result)
        return speaker.queue(card.uri)
      }).then(result => {
        console.log('Added to queue %j', result)
        return speaker.selectQueue()
        // return speaker.play()
      }).then(result => {
        console.log('Started playing queue %j', result)
      }).catch(err => {
        console.log('An error occurred: %j', err)
      })

      res.send({ message: 'Queued ' + card.uri + ' to play' })
    } else if (!card) { // never scanned before/deleted
      getDB().collection('cards').insertOne({ number: req.params.cardId }, (err, result) => {
        if (err) return console.log(err)

        io(req).emit('cardAdded', { number: req.params.cardId })
        res.send({ message: 'Card created with number ' + req.params.cardId })
      })
    } else { // card that's been scanned but still has no URI
      res.send({ message: 'Card exists, but awaiting configuration' })
    }
  })
})

router.delete('/cards/:cardId', (req, res) => {
  getDB().collection('cards').findOneAndDelete(
    { number: req.params.cardId },
    (err, result) => {
      if (err) return res.send(500, err)

      io(req).emit('cardDeleted', req.params.cardId)
      res.send(result)
    }
  )
})

router.get('/spotify/search', (req, res) => {
  var id = config.SPOTIFY_CLIENT_ID
  var secret = config.SPOTIFY_CLIENT_SECRET
  var auth_request = Buffer.from(`${id}:${secret}`).toString('base64')
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Basic ${auth_request}`
    },
    form: {
      grant_type: 'client_credentials'
    },
    json: true
  }

  console.log('obtaining client credentials access to Spotify')
  request.post(authOptions, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      // console.log(body)
      var options = {
        url: `https://api.spotify.com/v1/search?q=${req.query.q}&type=${req.query.type}`,
        headers: {
          'Authorization': `Bearer ${body.access_token}`
        },
        json: true
      }

      console.log(`client credentials obtained: ${body.access_token}`)
      console.log(`proceeding to make API search for "${req.query.q}"`)
      request.get(options, (error, response, body) => {
        if (error) return console.log(error)

        // returns {"albums": {"items":[ ... ]}, "playlists": {"items":[...]}, "tracks": {"items":[...]}}
        // most relevant info from each album object is:
        // album.album_type ("single", "album", ...?) "single" seems to include EPs
        // album.available_markets - filter on this array to make sure the album is available in "AU"? (Spotify may already be filtering)
        // album.images: array of objects with height, width and url (usually image 0 is 640x640, 1 is 300x300, 2 is 64x64)
        // album.name
        // album.artists[0].name (collect all names?)
        // album.total_tracks - might be more helpful than album_type
        // album.uri
        // e.g. search 'kesha+rainbow' presents two otherwise identical albums
        // but one has her butt concealed in the album art!!

        // relevant playlist info:
        // playlist.name
        // playlist.owner.display_name (?)
        // playlist.images (ditto album with order and sizes)
        // playlist.tracks.total
        // playlist.uri

        // track info:
        // track.album - full fledged album object
        // track.artists
        // track.name
        // track.duration_ms (e.g. 226440)
        // track.uri
        res.send(body)
      })
    }
  })
})

router.get('/spotify/lookup', (req, res) => {
  let id = config.SPOTIFY_CLIENT_ID
  let secret = config.SPOTIFY_CLIENT_SECRET
  let auth_request = Buffer.from(`${id}:${secret}`).toString('base64')
  let authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Basic ${auth_request}`
    },
    form: {
      grant_type: 'client_credentials'
    },
    json: true
  }

  console.log('obtaining client credentials access to Spotify')
  request.post(authOptions, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      // console.log(body)
      let url = `https://api.spotify.com/v1/${req.query.type}s/${req.query.id}`
      let options = {
        url: url,
        headers: {
          'Authorization': `Bearer ${body.access_token}`
        },
        json: true
      }

      console.log(`client credentials obtained: ${body.access_token}`)
      console.log(`proceeding to make API lookup at "${url}"`)
      request.get(options, (error, response, body) => {
        if (error) return console.log(error)

        res.send(body)
      })
    }
  })
})

module.exports = router
