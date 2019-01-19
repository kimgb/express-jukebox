var typingTimer, searchStr
const doneTypingInterval = 500

function initSpotifySearch() {
  // $("#spotifySearchString").keypress((e) => {
  //   console.log("KeyboardEvent: key='" + e.key + "' | code='" + e.code + "'")
  // })

  $("#spotifySearchString").on('input', (e) => {
    clearTimeout(typingTimer)

    if($("#spotifySearchString").val().length > 3) {
      clearSpotifyResults()
      append(spotifyResults, loader())
      typingTimer = setTimeout(searchSpotify, doneTypingInterval)
    }
  })

  $("#spotifySearchString").keydown((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()

      if($("#spotifySearchString").val().length > 3) {
        clearTimeout(typingTimer)
        clearSpotifyResults()
        append(spotifyResults, loader())
        searchSpotify()
      }
    }
  })
}

function clearSpotifyResults() {
  var spotifyResults = document.getElementById('spotifyResults')

  while (spotifyResults.firstChild) {
    spotifyResults.removeChild(spotifyResults.firstChild)
  }
}

function searchSpotify() {
  var type = "track,album,playlist"
  var q = encodeURI($("#spotifySearchString").val())

  var spotifyResults = document.getElementById('spotifyResults')

  fetch(`/api/v1/search/spotify?q=${q}&type=${type}`).then((response) => {
    return response.json()
  }).then((data) => {
    while (spotifyResults.firstChild) {
      spotifyResults.removeChild(spotifyResults.firstChild)
    }

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

function createNode(element) {
  return document.createElement(element)
}

function append(parent, el) {
  return parent.appendChild(el)
}

function loader() {
  var svg = createNode('img')
  svg.classList.add("mx-auto")
  svg.src = "/images/triangles.svg"
  svg.width = "100"
  svg.height = "100"

  return svg
}

function addSpotifyResultList(title, items) {
  // <h5 class="w-100 border-bottom">Albums</h5>
  // <div class="row" id="albumList"></div>
  var spotifyResults = document.getElementById('spotifyResults')
  var headingItem = createNode('h5')
  var rowItem = createNode('div')

  headingItem.classList.add("w-100", "border-bottom")
  headingItem.textContent = title
  rowItem.classList.add("row")

  items.forEach((item) => append(rowItem, buildSpotifyItem(item)))

  append(spotifyResults, headingItem)
  append(spotifyResults, rowItem)
}

function buildSpotifyItem(item) {
  var colItem = createNode('div')
  var itemLink = createNode('a')
  var itemThumbnail = createNode('img')
  var itemDetail = createNode('div')
  var itemName = createNode('span')
  var itemArtist = createNode('span')
  var lineBreak = createNode('br')

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

function buildCardItem(card) {
  var cardItem = createNode('li')
  var label = createNode('span')
  var btnGrp = createNode('div')
  var scanBtn = createNode('a')
  var editBtn = createNode('a')
  var deleteBtn = createNode('a')
  var editIcon = createNode('i')
  var deleteIcon = createNode('i')
  var scanIcon = createNode('i')

  cardItem.dataset.id = card._id
  cardItem.classList.add("list-group-item", "d-flex", "justify-content-between")
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
