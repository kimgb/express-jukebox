require('dotenv').config()

const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const app = express()
const MongoClient = require('mongodb').MongoClient
const http = require('http').Server(app)
const io = require('socket.io')(http)
const request = require('request')

const { Sonos } = require('sonos')
const speaker = new Sonos(process.env.SONOS_SPEAKER_IP)

app.use(express.static(__dirname))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

// app.use((req, res, next) => {
//   res.header('Access-Control-Allow-Origin', '*')
//   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
//
//   if (req.method === 'OPTIONS') {
//     res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET')
//     return res.status(200).json({});
//   }
//
//   next()
// })
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
//
// io.on('connection', (socket) => {
//   console.log('a user is connected')
//
//   socket.on('disconnect', () => {
//     console.log('user disconnected')
//   })
// })

app.get('/', (req, res) => {
  res.redirect('/cards')
})

app.get('/cards', (req, res) => {
  res.render('index.ejs')
})

app.get('/cards/edit/:cardId', (req, res) => {
  db.collection('cards').findOne({ number: req.params.cardId }, (err, card) => {
    if (err) return console.log(err)

    res.render('edit.ejs', { card: card })
  })
})

app.post('/cards/edit/:cardId', (req, res) => {
  db.collection('cards').findOneAndUpdate(
    { number: req.params.cardId },
    { $set: {
      label: req.body.label,
      uri: req.body.uri,
      shuffle: req.body.shuffle ? true : false,
      repeat: req.body.repeat ? true: false,
    }},
    (err, result) => {
      if (err) return res.send(500, err)

      io.emit('cardUpdated', req.body)
      res.redirect('/cards')
    }
  )
})

// var cardAPI = require('./routes/api-v1-cards')
// app.use('/api/v1/cards', cardAPI)

app.get('/api/v1/cards', (req, res) => {
  db.collection('cards').find().toArray((err, cards) => {
    if (err) return console.log(err)

    res.send(cards)
  })
})

app.post('/api/v1/cards', (req, res) => {
  db.collection('cards').insertOne(req.body, (err, results) => {
    if (err) return console.log(err)

    // console.log(results)
    io.emit('cardAdded', req.body)
    res.send(results)
  })
})

app.put('/api/v1/cards/:cardId', (req, res) => {
  db.collection('cards').findOne({ number: req.params.cardId }, (err, card) => {
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
      db.collection('cards').insertOne({ number: req.params.cardId }, (err, result) => {
        if (err) return console.log(err)

        io.emit('cardAdded', { number: req.params.cardId })
        res.send({ message: 'Card created with number ' + req.params.cardId })
      })
    } else { // card that's been scanned but still has no URI
      res.send({ message: 'Card exists, but awaiting configuration' })
    }
  })
})

app.delete('/api/v1/cards/:cardId', (req, res) => {
  db.collection('cards').findOneAndDelete(
    { number: req.params.cardId },
    (err, result) => {
      if (err) return res.send(500, err)

      io.emit('cardDeleted', req.params.cardId)
      res.send(result)
    }
  )
})

app.get('/api/v1/search/spotify', (req, res) => {
  var id = process.env.SPOTIFY_CLIENT_ID
  var secret = process.env.SPOTIFY_CLIENT_SECRET
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

var db
MongoClient.connect(process.env.DB_CONNECTION_STR, { useNewUrlParser: true }, (err, client) => {
  if (err) return console.log(err)
  db = client.db('jukebox')

  http.listen(3000, () => {
    console.log('listening on 3000')
  })
})
