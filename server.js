require('dotenv').config()

const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const MongoClient = require('mongodb').MongoClient
const http = require('http').Server(app)
const io = require('socket.io')(http)

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
//
// io.on('connection', (socket) => {
//   console.log('a user is connected')
//
//   socket.on('disconnect', () => {
//     console.log('user disconnected')
//   })
// })

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
      number: req.body.number,
      label: req.body.label,
      uri: req.body.uri,
      shuffle: req.body.shuffle ? true : false,
      repeat: req.body.repeat ? true: false,
    }},
    (err, result) => {
      if (err) return res.send(500, err)

      res.redirect('/cards')
    }
  )
})

app.put('/cards/:cardId', (req, res) => {
  db.collection('cards').findOne({ number: req.params.cardId }, (err, card) => {
    if (card && card.uri) {
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

      speaker.setPlayMode(playMode)
      speaker.play(card.uri)

      res.send({ message: 'Queued ' + card.uri + ' to play' })
    } else if (!card) {
      db.collection('cards').insertOne({ number: req.params.cardId }, (err, result) => {
        if (err) return console.log(err)

        io.emit('cardAdded', { number: req.params.cardId })
        res.send({ message: 'Card created with number ' + req.params.cardId })
      })
    }
  })
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

var db
MongoClient.connect(process.env.DB_CONNECTION_STR, (err, client) => {
  if (err) return console.log(err)
  db = client.db('jukebox')

  http.listen(3000, () => {
    console.log('listening on 3000')
  })
})
