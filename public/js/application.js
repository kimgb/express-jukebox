var typingTimer
var timers = {}
const doneTypingInterval = 500

function initTimeoutSearch(selector, search, opts = { minChars: 4 }) {
  // selector like "#spotifySearchString", search is a callback
  let input = document.querySelector(selector)
  let timer = timers[input.dataset.timerLabel]
  let resultList = document.querySelector(input.dataset.resultList)

  input.addEventListener('input', (e) => {
    clearTimeout(timer)

    if (input.value.length >= opts.minChars) {
      initLoad(resultList)
      timer = setTimeout(() => {
        search(input.value)
      }, (opts.timeoutInterval || doneTypingInterval))
    }
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()

      if (input.value.length >= opts.minChars) {
        clearTimeout(timer)
        initLoad(resultList)

        search(input.value)
      }
    }
  })
}

function clearChildren(elem) {
  while (elem.firstChild) { elem.removeChild(elem.firstChild) }
}

function initLoad(elem) {
  // if the loader is already the first child, nothing happens
  // if there are children, and they're not images, kill them!
  if (elem.firstChild && elem.firstChild.tagName !== "IMG") clearChildren(elem)

  // if there are now no children left, add the loader!
  if (!elem.firstChild) elem.append(loader())
}

function searchCards(str) {
  let urlParams = new URLSearchParams(window.location.search)
  urlParams.set('q', encodeURI(str))

  history.pushState(null, null, `/cards?${urlParams.toString()}`)
  getCards()
}

function searchSpotify(str) {
  var type = "track,album,playlist"
  var q = encodeURI(str)

  var spotifyResults = document.getElementById('spotifyResults')

  fetch(`/api/v1/spotify/search?q=${q}&type=${type}`).then((response) => {
    return response.json()
  }).then((data) => {
    clearChildren(spotifyResults)

    var albums = data.albums.items
    var playlists = data.playlists.items
    var tracks = data.tracks.items

    if (albums && albums.length > 0) {
      addSpotifyResultList("Albums", albums.slice(0,7))
    }

    if (playlists && playlists.length > 0) {
      addSpotifyResultList("Playlists", playlists.slice(0,7))
    }

    if (tracks && tracks.length > 0) {
      addSpotifyResultList("Songs", tracks.slice(0,7))
    }
  })
}

function previewSpotify(str) {
  if (str.match(/(?:[^:]+:){2,4}[^:]+/)) {
    let type, id
    [type, id] = str.split(':').slice(-2)

    if (["track", "album", "playlist"].includes(type) && id.length === 22) {
      let spotifyPreview = document.getElementById('spotifyPreview')

      fetch(`/api/v1/spotify/lookup?type=${type}&id=${id}`).then((response) => {
        return response.json()
      }).then((data) => {
        clearChildren(spotifyPreview)

        let result = buildSpotifyPreview(data)
        spotifyPreview.append(result)
      })
    }
  }
}

function createNode(element) {
  return document.createElement(element)
}

function append(parent, el) {
  return parent.appendChild(el)
}

function loader() {
  let svg = createNode('img')
  svg.classList.add("mx-auto")
  svg.src = "/images/triangles.svg"
  svg.width = "100"
  svg.height = "100"

  return svg
}

function addSpotifyResultList(title, items) {
  // <h5 class="w-100 border-bottom">Albums</h5>
  // <div class="row" id="albumList"></div>
  let spotifyResults = document.getElementById('spotifyResults')
  let headingItem = createNode('h5')
  let rowItem = createNode('div')

  headingItem.classList.add("w-100", "border-bottom")
  headingItem.textContent = title
  rowItem.classList.add("row")

  items.forEach((item) => append(rowItem, buildSpotifyItem(item)))

  append(spotifyResults, headingItem)
  append(spotifyResults, rowItem)
}

function buildSpotifyItem(item) {
  let colItem = createNode('div')
  let itemLink = createNode('a')
  let itemThumbnail = createNode('img')
  let itemDetail = createNode('div')
  let itemName = createNode('span')
  let itemArtist = createNode('span')
  let lineBreak = createNode('br')

  colItem.classList.add("mb-3", "col-xs-6", "col-sm-3")

  itemLink.classList.add("d-flex", "align-items-center", "spotify-item")
  itemLink.dataset.uri = item.uri
  itemLink.href = "#"

  itemThumbnail.classList.add("float-left", "item-thumbnail")
  itemThumbnail.alt = `${item.name} cover`
  // 2 is normally 64x64
  // Tracks needs to look up item.album.images[2].url
  if (typeof item.images !== "undefined") {
    itemThumbnail.src = item.images[item.images.length - 1].url
  } else {
    itemThumbnail.src = item.album.images[2].url
  }

  itemDetail.classList.add("ml-2", "item-detail")
  itemName.textContent = item.name
  // collect up to x or 'various artists'?
  // Playlists need to look up item.owner.display_name
  if (typeof item.artists !== "undefined") {
    itemArtist.textContent = item.artists[0].name
  } else {
    itemArtist.textContent = item.owner.display_name
  }

  append(itemDetail, itemName)
  append(itemDetail, lineBreak)
  append(itemDetail, itemArtist)

  append(itemLink, itemThumbnail)
  append(itemLink, itemDetail)

  append(colItem, itemLink)

  itemLink.addEventListener('click', (e) => {
    e.preventDefault()
    $("#cardURI").val(itemLink.dataset.uri)
  })

  return colItem
}

function buildSpotifyPreview(item) {
  let colItem = createNode('div')
  let itemThumbnail = createNode('img')
  let itemDetail = createNode('div')
  let itemName = createNode('span')
  let itemArtist = createNode('span')
  let lineBreak = createNode('br')

  colItem.classList.add("mb-3", "col-xs-6", "col-sm-3", "d-flex", "align-items-center")

  itemThumbnail.classList.add("float-left", "item-thumbnail")
  itemThumbnail.alt = `${item.name} cover`
  // 2 is normally 64x64
  // Tracks needs to look up item.album.images[2].url
  if (typeof item.images !== "undefined") {
    itemThumbnail.src = item.images[item.images.length - 1].url
  } else {
    itemThumbnail.src = item.album.images[2].url
  }

  itemDetail.classList.add("ml-2", "item-detail")
  itemName.textContent = item.name
  // collect up to x or 'various artists'?
  // Playlists need to look up item.owner.display_name
  if (typeof item.artists !== "undefined") {
    itemArtist.textContent = item.artists[0].name
  } else {
    itemArtist.textContent = item.owner.display_name
  }

  append(itemDetail, itemName)
  append(itemDetail, lineBreak)
  append(itemDetail, itemArtist)

  append(colItem, itemThumbnail)
  append(colItem, itemDetail)

  return colItem
}

function buildCardItem(card) {
  let cardItem = createNode('li')
  let label = createNode('span')
  let btnGrp = createNode('div')
  let scanBtn = createNode('a')
  let editBtn = createNode('a')
  let deleteBtn = createNode('a')
  let editIcon = createNode('i')
  let deleteIcon = createNode('i')
  let scanIcon = createNode('i')

  cardItem.dataset.id = card._id
  cardItem.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center")
  cardItem.id = "card" + card.number
  label.textContent = card.label ? card.label + ' [' + card.number + ']' : card.number

  btnGrp.classList.add("btn-group")
  btnGrp.attributes.role = "group"

  scanBtn.classList.add("btn", "btn-sm", "btn-warning")
  scanBtn.href = "#"
  scanBtn.id = "btnScanCard" + card.number
  scanBtn.dataset.number = card.number
  scanIcon.classList.add("fas", "fa-play")
  scanBtn.addEventListener('click', (e) => {
    e.preventDefault()
    scanCard(e.target.dataset.number)
  })

  editBtn.classList.add("btn", "btn-sm", "btn-primary")
  editBtn.href = "/cards/edit/" + card.number
  editIcon.classList.add("fas", "fa-edit")

  deleteBtn.classList.add("btn", "btn-sm", "btn-danger")
  deleteBtn.href = "#"
  deleteBtn.id = "btnDeleteCard" + card.number
  deleteBtn.dataset.number = card.number
  deleteIcon.classList.add("fas", "fa-trash")
  deleteBtn.addEventListener('click', (e) => {
    e.preventDefault()
    deleteCard(e.target.dataset.number)
  })

  append(scanBtn, scanIcon)
  append(editBtn, editIcon)
  append(deleteBtn, deleteIcon)

  append(btnGrp, scanBtn)
  append(btnGrp, editBtn)
  append(btnGrp, deleteBtn)

  append(cardItem, label)
  append(cardItem, btnGrp)

  return cardItem
}
