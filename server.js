// require('dotenv').config()
const config = require('./config')

const initDB = require('./db').initDB
const getDB = require('./db').getDB
const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const app = express()
const MongoClient = require('mongodb').MongoClient
const http = require('http').Server(app)
const io = require('socket.io')(http)

const winston = require('winston')
const expressWinston = require('express-winston')

app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.use(expressWinston.logger({
  transports: [
    new winston.transports.Console()
  ],
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.json()
  )
}))

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
app.set('socketio', io)
//
// io.on('connection', (socket) => {
//   console.log('a user is connected')
//
//   socket.on('disconnect', () => {
//     console.log('user disconnected')
//   })
// })

var api = require('./routes/api')
var card = require('./routes/cards')

app.use('/api/v1', api)
app.use('/cards', card)

app.get('/', (req, res) => {
  res.redirect('/cards')
})

initDB((err) => {
  if (err) { throw err }

  http.listen(3000, () => {
    console.log('listening on 3000')
  })
})
