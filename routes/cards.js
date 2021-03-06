const initDB = require('../db').initDB
const getDB = require('../db').getDB
const router = require('express').Router()

router.get('/', (req, res) => {
  res.render('index.ejs')
})

router.get('/edit/:cardId', (req, res) => {
  getDB().collection('cards').findOne({ number: req.params.cardId }, (err, card) => {
    if (err) return console.log(err)

    res.render('edit.ejs', { card: card })
  })
})

router.post('/edit/:cardId', (req, res) => {
  getDB().collection('cards').findOneAndUpdate(
    { number: req.params.cardId },
    { $set: {
      label: req.body.label,
      uri: req.body.uri,
      shuffle: req.body.shuffle ? true : false,
      repeat: req.body.repeat ? true: false,
    }},
    { returnOriginal: false },
    (err, doc) => {
      if (err) return res.send(500, err)

      var io = req.app.get('socketio')
      io.emit('cardUpdated', doc.value)
      res.redirect('/cards')
    }
  )
})

module.exports = router
