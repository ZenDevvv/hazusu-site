import Lenis from 'lenis'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const lerp = (a, b, t) => a + (b - a) * t
const smootherstep = (value) => value * value * value * (value * (value * 6 - 15) + 10)
const folio = (number) => String(number).padStart(2, '0')

const moves = {
  keep: {
    label: 'Keep',
    x: 1,
    y: 0,
    angle: 0,
    color: 'var(--mint)',
    glow: [134, 217, 190, 0.22],
    rz: 2.8,
    ry: 5,
    rx: 1.8,
  },
  toss: {
    label: 'Toss',
    x: -1,
    y: 0,
    angle: 180,
    color: 'var(--pink)',
    glow: [255, 158, 196, 0.22],
    rz: -3,
    ry: -5.5,
    rx: 1.8,
  },
  fave: {
    label: 'Fave',
    x: 0,
    y: -1,
    angle: -90,
    color: 'var(--lilac)',
    glow: [207, 196, 236, 0.23],
    rz: 1.8,
    ry: -2.5,
    rx: 4.5,
  },
  skip: {
    label: 'Skip',
    x: 0,
    y: 1,
    angle: 90,
    color: 'var(--paper)',
    glow: [245, 240, 251, 0.18],
    rz: -2,
    ry: 2.5,
    rx: -3.5,
  },
}

// Per-folio 3D orientation: Right (leans left toward copy) -> Left (leans right toward ledger) -> Center (poised)
const folioTilts = [
  { rz: 3.4, ry: -9.5, rx: 2.0 },
  { rz: -3.6, ry: 10.0, rx: 1.8 },
  { rz: -1.6, ry: 0, rx: 3.0 },
]

const hero = document.querySelector('.hero')
const printSpace = document.querySelector('.print-space')
const fan = document.querySelector('.print-fan')
const strip = document.querySelector('.strip-type')

const guide = document.querySelector('.moves')
const stage = guide.querySelector('.move-stage')
const stageTop = guide.querySelector('.stage-top')
const stageFoot = guide.querySelector('.stage-foot')
const movesPhoneSlot = document.querySelector('#moves-phone-slot')
const mobilePhoneRig = movesPhoneSlot.querySelector('.phone-rig')
const movesPhoneGlass = document.querySelector('#moves-phone-glass')
const swipeScreen = document.querySelector('.swipe-screen')

const words = [...guide.querySelectorAll('.stage-word')]
const stories = [...guide.querySelectorAll('.move-story')]
const frames = [...guide.querySelectorAll('.frame')]
const moveButtons = [...guide.querySelectorAll('.move-nav button')]
const phoneIndex = document.querySelector('#phone-index')
const pileCount = document.querySelector('#pile-count')

const insideSection = document.querySelector('#inside')
const insideFoliosEl = document.querySelector('#inside-folios')
const folios = [...insideFoliosEl.querySelectorAll('.folio')]
const folioSentinels = [0, 1, 2].map((i) => insideFoliosEl.querySelector(`[data-sentinel="${i}"]`))
const folioSlots = [0, 1, 2].map((i) => insideFoliosEl.querySelector(`[data-folio-slot="${i}"]`))
const folioSpines = [...insideFoliosEl.querySelectorAll('.folio-spine')]
const noteHosts = [0, 1, 2].map((i) => document.querySelector(`[data-note-host="${i}"]`))
const noteScreens = [0, 1, 2].map((i) => document.querySelector(`[data-screen="note-${i}"]`))

const editionSection = document.querySelector('#edition')
const editionPhoneSlot = document.querySelector('#edition-phone-slot')
const editionNotesHost = document.querySelector('#edition-notes-host')
const notesScreen = document.querySelector('.screen-notes')

const deviceRig = document.querySelector('#device-rig')
const deviceGlass = document.querySelector('#device-glass')
const deviceHomeBar = deviceGlass.querySelector('.phone-home')

const allScreens = [swipeScreen, ...noteScreens, notesScreen]

let lenis
let continuous = false
let pinnedMoves = false
let currentMove = -1
let lastTravel = ''
let lastCover = -1
let coverHeight = 1

// Continuous geometry (measured in measure(), zero layout reads during scroll frames)
let baseW = 1
let baseH = 1
let peekX = 0
let peekDocY = 0
let peekScale = 0.8

let movesStart = 0
let movesRange = 1
let movesEnd = 1
let movesSlotX = 0
let movesSlotY = 0
let movesScale = 1

let insideStart = 0
let folioGeom = []
let foliosReleaseY = 1

let editionTop = 0
let editionDockY = 0
let editionSlotDocX = 0
let editionSlotDocY = 0
let editionScale = 1

// Smoothly damped physical pose state
const pose = { cx: 0, cy: 0, s: 1, rz: 0, rx: 0, ry: 0, initialized: false }
const targetPose = { cx: 0, cy: 0, s: 1, rz: 0, rx: 0, ry: 0 }
let renderY = 0
let rafId = 0
let lastFrameTime = 0

function mountContinuousScreens(enable) {
  if (enable) {
    if (swipeScreen.parentElement !== deviceGlass) {
      for (const screen of allScreens) {
        deviceGlass.insertBefore(screen, deviceHomeBar)
        screen.style.opacity = ''
        screen.style.transform = ''
        screen.style.zIndex = ''
      }
    }
  } else if (swipeScreen.parentElement === deviceGlass) {
    movesPhoneGlass.insertBefore(swipeScreen, movesPhoneGlass.querySelector('.phone-home'))
    noteScreens.forEach((screen, i) => {
      noteHosts[i].insertBefore(screen, noteHosts[i].querySelector('.phone-home'))
    })
    editionNotesHost.insertBefore(notesScreen, editionNotesHost.querySelector('.phone-home'))
    for (const screen of allScreens) {
      screen.classList.remove('is-active', 'is-visible', 'is-interactive')
      screen.style.opacity = ''
      screen.style.transform = ''
      screen.style.zIndex = ''
    }
    swipeScreen.classList.add('is-active')
  }
}

/**
 * Scroll-scrubbed overlapping screen blend:
 * outgoing screen stays solid underneath while incoming screen glides over it with zero blank gap.
 */
function blendScreens(baseName, nextName, progress) {
  if (!continuous) return
  const t = smootherstep(clamp(progress, 0, 1))
  const interactiveNotes = (baseName === 'notes' && t < 0.5) || (nextName === 'notes' && t > 0.55)
  const dominant = nextName && t >= 0.5 ? nextName : baseName

  for (const screen of allScreens) {
    const name = screen.dataset.screen
    const isBase = name === baseName
    const isNext = nextName && name === nextName && t > 0.002

    screen.classList.toggle('is-active', name === dominant)
    screen.classList.toggle('is-interactive', name === 'notes' && interactiveNotes)

    if (isNext) {
      screen.classList.add('is-visible')
      screen.style.zIndex = '2'
      screen.style.opacity = t.toFixed(3)
      screen.style.transform =
        'translate3d(0, ' +
        ((1 - t) * 24).toFixed(1) +
        'px, 0) scale(' +
        (0.972 + t * 0.028).toFixed(4) +
        ')'
    } else if (isBase && (!nextName || t < 0.998)) {
      screen.classList.add('is-visible')
      screen.style.zIndex = '1'
      screen.style.opacity = nextName ? (1 - t * 0.25).toFixed(3) : '1'
      screen.style.transform = nextName
        ? 'translate3d(0, ' + (-t * 14).toFixed(1) + 'px, 0) scale(' + (1 - t * 0.038).toFixed(4) + ')'
        : 'none'
    } else {
      screen.classList.remove('is-visible')
      screen.style.zIndex = '0'
      screen.style.opacity = '0'
      screen.style.transform = 'none'
    }
  }
}

function resetFolioVars() {
  for (const f of folios) {
    f.style.setProperty('--recede-scale', '1')
    f.style.setProperty('--recede-y', '0px')
    f.style.setProperty('--veil', '0')
    f.style.setProperty('--ghost-x', '0px')
    f.style.setProperty('--stamp-shift', '0px')
    f.style.setProperty('--settle', '1')
    f.style.setProperty('--split', '1')
    f.style.setProperty('--fan', '1')
  }
}

function updateFolios(y) {
  if (!continuous || folioGeom.length < 3) return
  const [g0, g1, g2] = folioGeom

  const p01 = clamp((y - g1.enterY) / Math.max(1, g1.stickY - g1.enterY), 0, 1)
  const p12 = clamp((y - g2.enterY) / Math.max(1, g2.stickY - g2.enterY), 0, 1)
  const e01 = smootherstep(p01)
  const e12 = smootherstep(p12)

  // Folio 01 (Monthly issues): recedes as Folio 02 & 03 stack over it
  const f0 = folios[0]
  const ghost0 = lerp(-68, 68, clamp((y - g0.enterY) / Math.max(1, g1.stickY - g0.enterY), 0, 1))
  const stamps0 = lerp(-14, 14, clamp((y - g0.enterY) / Math.max(1, g1.enterY - g0.enterY), 0, 1))
  f0.style.setProperty('--recede-scale', (1 - e01 * 0.036 - e12 * 0.028).toFixed(4))
  f0.style.setProperty('--recede-y', -(e01 * 4 + e12 * 4).toFixed(1) + 'px')
  f0.style.setProperty('--veil', (e01 * 0.1 + e12 * 0.07).toFixed(3))
  f0.style.setProperty('--ghost-x', ghost0.toFixed(1) + 'px')
  f0.style.setProperty('--stamp-shift', stamps0.toFixed(1) + 'px')

  // Folio 02 (Smart piles): ledger strips glide into crisp alignment as sheet rises; opposite ghost drift
  const f1 = folios[1]
  const ghost1 = lerp(74, -74, clamp((y - g1.enterY) / Math.max(1, g2.stickY - g1.enterY), 0, 1))
  const settle1 = smootherstep(clamp((p01 - 0.18) / 0.72, 0, 1))
  f1.style.setProperty('--recede-scale', (1 - e12 * 0.034).toFixed(4))
  f1.style.setProperty('--recede-y', -(e12 * 4).toFixed(1) + 'px')
  f1.style.setProperty('--veil', (e12 * 0.11).toFixed(3))
  f1.style.setProperty('--ghost-x', ghost1.toFixed(1) + 'px')
  f1.style.setProperty('--settle', settle1.toFixed(3))

  // Folio 03 (Toss pile): BeeVrac split headline converges around centered phone + prints fan open
  const f2 = folios[2]
  const ghost2 = lerp(-48, 48, clamp((y - g2.enterY) / Math.max(1, editionDockY - g2.enterY), 0, 1))
  const split2 = smootherstep(clamp((p12 - 0.14) / 0.78, 0, 1))
  f2.style.setProperty('--recede-scale', '1')
  f2.style.setProperty('--recede-y', '0px')
  f2.style.setProperty('--veil', '0')
  f2.style.setProperty('--ghost-x', ghost2.toFixed(1) + 'px')
  f2.style.setProperty('--split', split2.toFixed(3))
  f2.style.setProperty('--fan', (0.45 + split2 * 0.55).toFixed(3))
}

function setupCoverRoll() {
  const prints = [...fan.querySelectorAll('.print')]
  const sticker = document.querySelector('.move-sticker')
  const stickerArrow = sticker.querySelector('.icon')
  const stickerLabel = sticker.querySelector('span')
  const count = document.querySelector('#print-count')
  let active = 0

  function turn(step) {
    active = (active + step + prints.length) % prints.length
    prints.forEach((print, index) => {
      const depth = (index - active + prints.length) % prints.length
      print.dataset.slot = depth
      print.setAttribute('aria-hidden', String(depth !== 0))
    })
    const move = moves[prints[active].dataset.move]
    stickerLabel.textContent = move.label
    sticker.style.setProperty('--sticker', move.color)
    stickerArrow.style.transform = 'rotate(' + move.angle + 'deg)'
    count.textContent = folio(active + 1) + ' of ' + folio(prints.length)
    if (!reducedMotion.matches) {
      prints[active].animate(
        [
          { translate: '10px 4px', rotate: '-2deg' },
          { translate: '0 0', rotate: '0deg' },
        ],
        { duration: 260, easing: 'ease-out' },
      )
    }
  }
  document.querySelector('#print-prev').addEventListener('click', () => turn(-1))
  document.querySelector('#print-next').addEventListener('click', () => turn(1))
}

function jumpToFolio(index) {
  const targetIndex = clamp(index, 0, folios.length - 1)
  if (continuous && folioGeom[targetIndex]) {
    const targetY = folioGeom[targetIndex].stickY + 20
    if (lenis) lenis.scrollTo(targetY, { duration: 0.85 })
    else window.scrollTo({ top: targetY, behavior: reducedMotion.matches ? 'instant' : 'smooth' })
    return
  }
  if (lenis) lenis.scrollTo(folios[targetIndex], { offset: -20, duration: 0.75 })
  else folios[targetIndex].scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' })
}

function setupFolios() {
  folioSpines.forEach((button, i) => {
    button.addEventListener('click', () => jumpToFolio(i))
  })
}

function updateMoveButtons(position, cumulative = true, staticIndex = 0) {
  if (!cumulative) {
    for (let i = 0; i < moveButtons.length; i++) {
      const btn = moveButtons[i]
      const on = i === staticIndex
      btn.dataset.state = on ? 'active' : 'todo'
      btn.setAttribute('aria-pressed', String(on))
      btn.style.setProperty('--p', on ? '1' : '0')
      btn.style.setProperty('--top-clip', '0%')
      btn.style.setProperty('--right-clip', on ? '0%' : '100%')
    }
    return
  }

  const pos = clamp(position, 0, frames.length)
  const activeIdx = Math.min(Math.floor(pos), frames.length - 1)

  for (let i = 0; i < moveButtons.length; i++) {
    const btn = moveButtons[i]
    const segP = clamp(pos - i, 0, 1)
    const past = pos - (i + 1)

    if (i < activeIdx) {
      // Ink fill descends cleanly from top -> 3px solid bottom bar (always 100% opaque, zero gray muddiness!)
      const settle = smootherstep(clamp(past / 0.28, 0, 1))
      btn.dataset.state = 'done'
      btn.setAttribute('aria-pressed', 'false')
      btn.style.setProperty('--p', '1')
      btn.style.setProperty('--right-clip', '0%')
      btn.style.setProperty('--top-clip', 'calc(' + settle.toFixed(4) + ' * (100% - 3px))')
    } else if (i === activeIdx) {
      btn.dataset.state = 'active'
      btn.setAttribute('aria-pressed', 'true')
      btn.style.setProperty('--p', segP.toFixed(4))
      btn.style.setProperty('--top-clip', '0%')
      btn.style.setProperty('--right-clip', ((1 - segP) * 100).toFixed(2) + '%')
    } else {
      btn.dataset.state = 'todo'
      btn.setAttribute('aria-pressed', 'false')
      btn.style.setProperty('--p', '0')
      btn.style.setProperty('--top-clip', '0%')
      btn.style.setProperty('--right-clip', '100%')
    }
  }
}

/**
 * Scroll-scrubbed continuous swipe choreography:
 * Zero binary snaps across card exit, incoming stamp settle, backdrop word glide,
 * glow color blend, and caption crossfade (100% deterministic & reversible).
 */
function renderSwipeTimeline(position, stampGain = 1, wordGain = 0.92) {
  const pos = clamp(position, 0, frames.length)
  const index = Math.min(Math.floor(pos), frames.length - 1)
  const local = pos - index
  const hasNext = index < frames.length - 1

  const keyStamp = pos.toFixed(4) + ':' + Math.round(stampGain * 100) + ':' + Math.round(wordGain * 100)
  if (keyStamp === lastTravel) return
  lastTravel = keyStamp

  const swipe = smootherstep(clamp((local - 0.14) / 0.72, 0, 1))
  const reveal = smootherstep(clamp((local - 0.2) / 0.68, 0, 1))
  const handoff = hasNext ? smootherstep(clamp((local - 0.64) / 0.34, 0, 1)) : 0

  const activeMove = moves[frames[index].dataset.move]
  const nextMove = hasNext ? moves[frames[index + 1].dataset.move] : activeMove
  const dominantIndex = hasNext && handoff >= 0.5 ? index + 1 : index

  if (dominantIndex !== currentMove) {
    currentMove = dominantIndex
    stage.dataset.active = frames[dominantIndex].dataset.move
  }

  // HUD counter & toss pile count react naturally once the outgoing card crosses mid-handoff
  phoneIndex.textContent = '‹ ' + (dominantIndex + 1) + ' / ' + frames.length
  pileCount.textContent = 'Toss ' + (pos >= 1.65 ? '1' : '0')

  // Smooth RGB interpolation of radial backdrop spotlight glow (zero color snap!)
  const gA = activeMove.glow
  const gB = nextMove.glow
  stage.style.setProperty(
    '--glow',
    'rgba(' +
      Math.round(lerp(gA[0], gB[0], handoff)) +
      ',' +
      Math.round(lerp(gA[1], gB[1], handoff)) +
      ',' +
      Math.round(lerp(gA[2], gB[2], handoff)) +
      ',' +
      lerp(gA[3], gB[3], handoff).toFixed(3) +
      ')',
  )

  // Cards inside phone deck: active exits smoothly, underneath card rises & settles its stamp BEFORE handoff
  const activeStampFade = 1 - smootherstep(clamp((swipe - 0.38) / 0.52, 0, 1))
  for (let i = 0; i < frames.length; i++) {
    const card = frames[i]
    if (i === index) {
      const swing = activeMove.x || activeMove.y * 0.5
      card.style.visibility = 'visible'
      card.style.zIndex = '2'
      card.style.transform =
        'translate3d(' +
        (swipe * activeMove.x * 126).toFixed(2) +
        '%, ' +
        (swipe * activeMove.y * 120).toFixed(2) +
        '%, 0) rotate(' +
        (swipe * swing * 17).toFixed(2) +
        'deg)'
      card.style.setProperty('--stamp', (activeStampFade * stampGain).toFixed(3))
      card.style.setProperty('--wash', (swipe * 0.32).toFixed(3))
    } else if (hasNext && i === index + 1) {
      card.style.visibility = 'visible'
      card.style.zIndex = '1'
      card.style.transform = 'scale(' + (0.94 + reveal * 0.06).toFixed(4) + ')'
      card.style.setProperty('--stamp', (handoff * stampGain).toFixed(3))
      card.style.setProperty('--wash', '0')
    } else {
      card.style.visibility = 'hidden'
      card.style.zIndex = '0'
      card.style.transform = 'none'
      card.style.setProperty('--stamp', '0')
      card.style.setProperty('--wash', '0')
    }
  }

  // Staged exit-then-enter curves so outgoing and incoming text never garble on top of each other
  const textOut = smootherstep(clamp(handoff / 0.46, 0, 1))
  const textIn = smootherstep(clamp((handoff - 0.54) / 0.46, 0, 1))

  // Backdrop display words: outgoing glides along swipe axis & clears before incoming glides into center
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (i === index) {
      const op = wordGain * (1 - textOut)
      const dx = swipe * activeMove.x * 46
      const dy = swipe * activeMove.y * 34
      const sc = 1 - textOut * 0.055
      w.classList.toggle('is-current', op > 0.01)
      w.style.opacity = op.toFixed(3)
      w.style.transform =
        'translate3d(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px, 0) scale(' + sc.toFixed(4) + ')'
    } else if (hasNext && i === index + 1 && textIn > 0.002) {
      const op = wordGain * textIn
      const dx = -(1 - textIn) * nextMove.x * 32
      const dy = -(1 - textIn) * nextMove.y * 24
      const sc = 0.945 + textIn * 0.055
      w.classList.add('is-current')
      w.style.opacity = op.toFixed(3)
      w.style.transform =
        'translate3d(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px, 0) scale(' + sc.toFixed(4) + ')'
    } else {
      w.classList.remove('is-current')
      w.style.opacity = '0'
      w.style.transform = 'scale(0.95)'
    }
  }

  // Bottom captions: outgoing lifts & clears before incoming rises cleanly into place
  for (let i = 0; i < stories.length; i++) {
    const st = stories[i]
    if (i === index) {
      const op = 1 - textOut
      st.classList.toggle('is-current', op > 0.02)
      st.style.visibility = op > 0.01 ? 'visible' : 'hidden'
      st.style.opacity = op.toFixed(3)
      st.style.transform = 'translate3d(0, ' + (-textOut * 9).toFixed(1) + 'px, 0)'
    } else if (hasNext && i === index + 1 && textIn > 0.002) {
      st.classList.add('is-current')
      st.style.visibility = 'visible'
      st.style.opacity = textIn.toFixed(3)
      st.style.transform = 'translate3d(0, ' + ((1 - textIn) * 9).toFixed(1) + 'px, 0)'
    } else {
      st.classList.remove('is-current')
      st.style.visibility = 'hidden'
      st.style.opacity = '0'
      st.style.transform = 'translate3d(0, 9px, 0)'
    }
  }
}

function showStaticMove(index) {
  currentMove = index
  lastTravel = ''
  const key = frames[index].dataset.move
  stage.dataset.active = key
  stage.style.removeProperty('--glow')
  phoneIndex.textContent = '‹ ' + (index + 1) + ' / ' + frames.length
  pileCount.textContent = 'Toss ' + (index > 1 ? '1' : '0')
  for (let i = 0; i < frames.length; i++) {
    const selected = i === index
    stories[i].classList.toggle('is-current', selected)
    stories[i].style.visibility = ''
    stories[i].style.opacity = ''
    stories[i].style.transform = ''
    words[i].classList.toggle('is-current', selected)
    words[i].style.opacity = ''
    words[i].style.transform = ''
    frames[i].style.visibility = selected || i === index + 1 ? 'visible' : 'hidden'
    frames[i].style.zIndex = selected ? '2' : '1'
    frames[i].style.transform = selected ? 'none' : 'scale(0.95)'
    frames[i].style.setProperty('--stamp', selected ? '1' : '0')
    frames[i].style.setProperty('--wash', '0')
  }
  updateMoveButtons(index, false, index)
}

function applyDevicePose(p) {
  deviceRig.style.transform =
    'translate3d(' +
    (p.cx - baseW / 2).toFixed(1) +
    'px, ' +
    (p.cy - baseH / 2).toFixed(1) +
    'px, 0) scale(' +
    p.s.toFixed(4) +
    ') rotateX(' +
    p.rx.toFixed(2) +
    'deg) rotateY(' +
    p.ry.toFixed(2) +
    'deg) rotateZ(' +
    p.rz.toFixed(2) +
    'deg)'
}

function computeTargets(y) {
  if (!reducedMotion.matches) {
    const cover = clamp(y / coverHeight, 0, 1.6)
    if (cover !== lastCover) {
      fan.style.setProperty('--front-y', -cover * 36 + 'px')
      fan.style.setProperty('--mid-y', cover * 14 + 'px')
      fan.style.setProperty('--back-y', cover * 52 + 'px')
      strip.style.transform = 'translate3d(' + (-40 - cover * 140) + 'px,0,0)'
      lastCover = cover
    }
  }

  if (continuous && folioGeom.length === 3) {
    const [g0, g1, g2] = folioGeom
    const keepTilt = moves.keep
    const editionTilt = { rz: 3.6, ry: -8.5, rx: 2.2 }

    updateFolios(y)

    if (y < movesStart) {
      // Hero peek (Right) -> Swipe Guide (Center)
      const arrive = clamp(y / Math.max(1, movesStart), 0, 1)
      const ease = smootherstep(arrive)
      const bank = Math.sin(ease * Math.PI)
      targetPose.cx = lerp(peekX, movesSlotX, ease)
      targetPose.cy = lerp(peekDocY, movesSlotY, ease) + bank * 18
      targetPose.s = lerp(peekScale, movesScale, ease)
      targetPose.rz = lerp(-10, keepTilt.rz, ease) + bank * 2.5
      targetPose.ry = lerp(-9, keepTilt.ry, ease) + bank * 9
      targetPose.rx = lerp(4, keepTilt.rx, ease)

      blendScreens('swipe', null, 0)
      const ui = smootherstep(clamp((arrive - 0.5) / 0.5))
      const word = smootherstep(clamp((arrive - 0.3) / 0.7))
      const wordGain = 0.1 + word * 0.82
      stage.style.setProperty('--stage-ui', ui.toFixed(3))
      stage.style.setProperty('--word-scale', (0.92 + word * 0.08).toFixed(4))
      const stampGain = smootherstep(clamp((arrive - 0.7) / 0.3))
      renderSwipeTimeline(0, stampGain, wordGain)
      updateMoveButtons(0, true)
    } else if (y <= movesEnd) {
      // Swipe Guide (Center): C1-continuous bell-curve impulse returns smoothly to center at every boundary!
      const position = clamp((y - movesStart) / movesRange) * frames.length
      const index = Math.min(Math.floor(position), frames.length - 1)
      const local = position - index
      const swipe = smootherstep(clamp((local - 0.14) / 0.72, 0, 1))
      const impulse = Math.sin(swipe * Math.PI)
      const m = moves[frames[index].dataset.move]
      const nextM = moves[frames[Math.min(index + 1, frames.length - 1)].dataset.move]
      const blendNext = smootherstep(clamp((local - 0.64) / 0.36, 0, 1))

      targetPose.cx = movesSlotX + impulse * m.x * 18
      targetPose.cy = movesSlotY + impulse * m.y * 14
      targetPose.s = movesScale * (1 - impulse * 0.016)
      targetPose.rz = lerp(m.rz, nextM.rz, blendNext) + impulse * m.x * 4.2
      targetPose.ry = lerp(m.ry, nextM.ry, blendNext) + impulse * m.x * 8.5
      targetPose.rx = lerp(m.rx, nextM.rx, blendNext) - impulse * m.y * 6.5

      blendScreens('swipe', null, 0)
      stage.style.setProperty('--stage-ui', '1')
      stage.style.setProperty('--word-scale', '1')
      renderSwipeTimeline(position, 1, 0.92)
      updateMoveButtons(position, true)
    } else if (y < g0.stickY) {
      // Swipe Guide (Center) -> Folio 01 Monthly Issues (Right), clearing "Inside Hazusu." on left
      const raw = clamp((y - movesEnd) / Math.max(1, g0.stickY - movesEnd), 0, 1)
      const ease = smootherstep(raw)
      const bank = Math.sin(ease * Math.PI)
      const endTilt = moves.skip

      targetPose.cx = lerp(movesSlotX, g0.slotX, ease)
      targetPose.cy = lerp(movesSlotY, g0.slotY, ease) + bank * 36
      targetPose.s = lerp(movesScale, g0.slotScale, ease) * (1 + bank * 0.018)
      targetPose.rz = lerp(endTilt.rz, folioTilts[0].rz, ease) + bank * 5.5
      targetPose.ry = lerp(endTilt.ry, folioTilts[0].ry, ease) - bank * 10
      targetPose.rx = lerp(endTilt.rx, folioTilts[0].rx, ease) + bank * 3

      stage.style.setProperty('--stage-ui', Math.max(0.12, 1 - raw * 1.4).toFixed(3))
      renderSwipeTimeline(frames.length, 1, 0.92)
      updateMoveButtons(frames.length, true)
      blendScreens('swipe', 'note-0', clamp((raw - 0.2) / 0.6))
    } else if (y <= g1.enterY) {
      // Folio 01 Hold (Right): calm dwell on Monthly issues
      const hold = clamp((y - g0.stickY) / Math.max(1, g1.enterY - g0.stickY), 0, 1)
      const breathe = Math.sin(hold * Math.PI)
      targetPose.cx = g0.slotX
      targetPose.cy = g0.slotY
      targetPose.s = g0.slotScale
      targetPose.rz = folioTilts[0].rz - breathe * 0.6
      targetPose.ry = folioTilts[0].ry - breathe * 1.2
      targetPose.rx = folioTilts[0].rx
      blendScreens('note-0', null, 0)
    } else if (y < g1.stickY) {
      // Page Turn 01 -> 02: S-curve sweep RIGHT -> LEFT over the rising Mint sheet
      const raw = clamp((y - g1.enterY) / Math.max(1, g1.stickY - g1.enterY), 0, 1)
      const ease = smootherstep(raw)
      const arc = Math.sin(ease * Math.PI)

      targetPose.cx = lerp(g0.slotX, g1.slotX, ease)
      targetPose.cy = lerp(g0.slotY, g1.slotY, ease) - arc * 26
      targetPose.s = lerp(g0.slotScale, g1.slotScale, ease) * (1 + arc * 0.032)
      targetPose.rz = lerp(folioTilts[0].rz, folioTilts[1].rz, ease) - arc * 6.5
      targetPose.ry = lerp(folioTilts[0].ry, folioTilts[1].ry, ease) + arc * 14
      targetPose.rx = lerp(folioTilts[0].rx, folioTilts[1].rx, ease) + arc * 5
      blendScreens('note-0', 'note-1', clamp((raw - 0.16) / 0.68))
    } else if (y <= g2.enterY) {
      // Folio 02 Hold (Left): calm dwell on Smart piles
      const hold = clamp((y - g1.stickY) / Math.max(1, g2.enterY - g1.stickY), 0, 1)
      const breathe = Math.sin(hold * Math.PI)
      targetPose.cx = g1.slotX
      targetPose.cy = g1.slotY
      targetPose.s = g1.slotScale
      targetPose.rz = folioTilts[1].rz + breathe * 0.6
      targetPose.ry = folioTilts[1].ry + breathe * 1.2
      targetPose.rx = folioTilts[1].rx
      blendScreens('note-1', null, 0)
    } else if (y < g2.stickY) {
      // Page Turn 02 -> 03: S-curve arc LEFT -> CENTER onto the rising Riso Pink sheet
      const raw = clamp((y - g2.enterY) / Math.max(1, g2.stickY - g2.enterY), 0, 1)
      const ease = smootherstep(raw)
      const arc = Math.sin(ease * Math.PI)

      targetPose.cx = lerp(g1.slotX, g2.slotX, ease)
      targetPose.cy = lerp(g1.slotY, g2.slotY, ease) - arc * 22
      targetPose.s = lerp(g1.slotScale, g2.slotScale, ease) * (1 + arc * 0.028)
      targetPose.rz = lerp(folioTilts[1].rz, folioTilts[2].rz, ease) + arc * 5
      targetPose.ry = lerp(folioTilts[1].ry, folioTilts[2].ry, ease) - arc * 11
      targetPose.rx = lerp(folioTilts[1].rx, folioTilts[2].rx, ease) + arc * 4.5
      blendScreens('note-1', 'note-2', clamp((raw - 0.16) / 0.68))
    } else if (y <= foliosReleaseY) {
      // Folio 03 Hold (Center): poised between "A second" and "look."
      const hold = clamp((y - g2.stickY) / Math.max(1, foliosReleaseY - g2.stickY), 0, 1)
      const breathe = Math.sin(hold * Math.PI)
      targetPose.cx = g2.slotX
      targetPose.cy = g2.slotY
      targetPose.s = g2.slotScale
      targetPose.rz = folioTilts[2].rz + breathe * 0.6
      targetPose.ry = folioTilts[2].ry
      targetPose.rx = folioTilts[2].rx + breathe * 0.9
      blendScreens('note-2', null, 0)
    } else if (y < editionDockY) {
      // Folio 03 (Center) -> Android Edition (Right):
      // C1-continuous velocity match directly into (editionSlotDocY - y) so docking has zero abrupt stop!
      const raw = clamp((y - foliosReleaseY) / Math.max(1, editionDockY - foliosReleaseY), 0, 1)
      const ease = smootherstep(raw)
      const bank = Math.sin(ease * Math.PI)

      targetPose.cx = lerp(g2.slotX, editionSlotDocX, ease)
      targetPose.cy = lerp(g2.slotY, editionSlotDocY - y, ease)
      targetPose.s = lerp(g2.slotScale, editionScale, ease)
      targetPose.rz = lerp(folioTilts[2].rz, editionTilt.rz, ease) + bank * 5.5
      targetPose.ry = lerp(folioTilts[2].ry, editionTilt.ry, ease) - bank * 10
      targetPose.rx = lerp(folioTilts[2].rx, editionTilt.rx, ease) + bank * 3
      blendScreens('note-2', 'notes', clamp((raw - 0.16) / 0.64))
    } else {
      // Docked 1:1 in #edition right column
      targetPose.cx = editionSlotDocX
      targetPose.cy = editionSlotDocY - y
      targetPose.s = editionScale
      targetPose.rz = editionTilt.rz
      targetPose.ry = editionTilt.ry
      targetPose.rx = editionTilt.rx
      blendScreens('notes', null, 0)
    }
    return
  }

  // Narrow mobile (<= 720px): smooth Hero peek -> Swipe Guide with continuous C1 gesture impulse
  if (pinnedMoves) {
    const arrive = clamp(y / Math.max(1, movesStart), 0, 1)
    const position = clamp((y - movesStart) / movesRange) * frames.length
    const index = Math.min(Math.floor(position), frames.length - 1)
    const local = position - index
    const swipe = smootherstep(clamp((local - 0.14) / 0.72, 0, 1))
    const impulse = Math.sin(swipe * Math.PI)
    const m = moves[frames[index].dataset.move]
    const nextM = moves[frames[Math.min(index + 1, frames.length - 1)].dataset.move]
    const blendNext = smootherstep(clamp((local - 0.64) / 0.36, 0, 1))

    if (arrive >= 1) {
      const rz = lerp(m.rz, nextM.rz, blendNext) * 0.75 + impulse * m.x * 3
      const ry = lerp(m.ry, nextM.ry, blendNext) * 0.7 + impulse * m.x * 5
      const rx = lerp(m.rx, nextM.rx, blendNext) * 0.7 - impulse * m.y * 4.5
      mobilePhoneRig.style.transform =
        'translate3d(' +
        (impulse * m.x * 10).toFixed(1) +
        'px, ' +
        (impulse * m.y * 8).toFixed(1) +
        'px, 0) rotateX(' +
        rx.toFixed(2) +
        'deg) rotateY(' +
        ry.toFixed(2) +
        'deg) rotateZ(' +
        rz.toFixed(2) +
        'deg)'
      stage.style.setProperty('--stage-ui', '1')
      stage.style.setProperty('--word-scale', '1')
      renderSwipeTimeline(position, 1, 0.92)
      updateMoveButtons(position, true)
    } else {
      const ease = smootherstep(arrive)
      const dx = (peekX - movesSlotX) * (1 - ease)
      const targetViewportY = lerp(peekDocY, movesSlotY, ease)
      const slotViewportY = movesStart - y + movesSlotY
      const dy = targetViewportY - slotViewportY
      const scale = lerp(peekScale, 1, ease)
      const rot = lerp(-9, moves.keep.rz * 0.75, ease)
      mobilePhoneRig.style.transform =
        'translate3d(' +
        dx.toFixed(1) +
        'px, ' +
        dy.toFixed(1) +
        'px, 0) scale(' +
        scale.toFixed(4) +
        ') rotateZ(' +
        rot.toFixed(2) +
        'deg)'
      const ui = smootherstep(clamp((arrive - 0.52) / 0.48))
      const word = smootherstep(clamp((arrive - 0.32) / 0.68))
      const wordGain = 0.1 + word * 0.82
      stage.style.setProperty('--stage-ui', ui.toFixed(3))
      stage.style.setProperty('--word-scale', (0.92 + word * 0.08).toFixed(4))
      const stampGain = smootherstep(clamp((arrive - 0.7) / 0.3))
      renderSwipeTimeline(0, stampGain, wordGain)
      updateMoveButtons(0, true)
    }
  }
}

function tick(now) {
  rafId = 0
  const dt = lastFrameTime ? Math.min(0.05, (now - lastFrameTime) / 1000) : 1 / 60
  lastFrameTime = now

  const targetY = window.scrollY
  if (continuous) {
    const yAlpha = 1 - Math.exp(-20 * dt)
    renderY = Math.abs(targetY - renderY) < 0.2 ? targetY : lerp(renderY, targetY, yAlpha)
    computeTargets(renderY)

    const pAlpha = 1 - Math.exp(-15 * dt)
    if (!pose.initialized) {
      Object.assign(pose, targetPose)
      pose.initialized = true
    } else {
      pose.cx = lerp(pose.cx, targetPose.cx, pAlpha)
      pose.cy = lerp(pose.cy, targetPose.cy, pAlpha)
      pose.s = lerp(pose.s, targetPose.s, pAlpha)
      pose.rz = lerp(pose.rz, targetPose.rz, pAlpha)
      pose.rx = lerp(pose.rx, targetPose.rx, pAlpha)
      pose.ry = lerp(pose.ry, targetPose.ry, pAlpha)
    }
    applyDevicePose(pose)

    const settled =
      Math.abs(targetY - renderY) < 0.25 &&
      Math.abs(pose.cx - targetPose.cx) < 0.12 &&
      Math.abs(pose.cy - targetPose.cy) < 0.12 &&
      Math.abs(pose.s - targetPose.s) < 0.0008 &&
      Math.abs(pose.rz - targetPose.rz) < 0.04 &&
      Math.abs(pose.rx - targetPose.rx) < 0.04 &&
      Math.abs(pose.ry - targetPose.ry) < 0.04

    if (!settled) {
      rafId = requestAnimationFrame(tick)
    } else {
      renderY = targetY
      computeTargets(renderY)
      Object.assign(pose, targetPose)
      applyDevicePose(pose)
      lastFrameTime = 0
    }
  } else {
    renderY = targetY
    computeTargets(targetY)
    lastFrameTime = 0
  }
}

function scheduleTick() {
  if (!rafId) rafId = requestAnimationFrame(tick)
}

function snapImmediately() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  lastFrameTime = 0
  renderY = window.scrollY
  computeTargets(renderY)
  if (continuous) {
    Object.assign(pose, targetPose)
    pose.initialized = true
    applyDevicePose(pose)
  }
}

function measure() {
  const wasContinuous = continuous
  const wasPinnedMoves = pinnedMoves
  const vh = document.documentElement.clientHeight
  const vw = window.innerWidth

  const stageStyle = getComputedStyle(stage)
  const stageGap = parseFloat(stageStyle.rowGap) || 0
  const movesNeeded =
    stageTop.offsetHeight +
    movesPhoneSlot.offsetHeight +
    stageFoot.offsetHeight +
    stageGap * 2 +
    parseFloat(stageStyle.paddingTop) +
    parseFloat(stageStyle.paddingBottom)
  const canPinMoves = !reducedMotion.matches && movesNeeded <= vh

  const wantContinuous = vw > 720 && canPinMoves && vh >= 620
  continuous = wantContinuous
  pinnedMoves = canPinMoves

  document.documentElement.classList.toggle('continuous-device', continuous)
  guide.classList.toggle('is-pinned', pinnedMoves)
  insideSection.classList.toggle('is-stacked', continuous)
  mountContinuousScreens(continuous)
  resetFolioVars()

  if (continuous && !wasContinuous) {
    pose.initialized = false
  }

  coverHeight = Math.max(1, hero.offsetHeight)
  movesStart = Math.round(guide.getBoundingClientRect().top + window.scrollY)
  movesRange = Math.max(1, guide.offsetHeight - stage.offsetHeight)
  movesEnd = movesStart + movesRange

  const mSlot = movesPhoneSlot.getBoundingClientRect()
  const mStage = stage.getBoundingClientRect()
  movesSlotX = mSlot.left + mSlot.width / 2
  movesSlotY = mSlot.top - mStage.top + mSlot.height / 2

  const spaceRect = printSpace.getBoundingClientRect()
  const fanW = fan.offsetWidth
  const fanH = fan.offsetHeight
  const fanCenterX = spaceRect.left + spaceRect.width * 0.51
  const fanTopDocY = spaceRect.top + window.scrollY + spaceRect.height * 0.48 - fanH / 2
  const refPhoneH = continuous ? Math.max(1, deviceRig.offsetHeight) : Math.max(1, mSlot.height)
  baseW = Math.max(1, deviceRig.offsetWidth || mSlot.width)
  baseH = refPhoneH
  peekScale = clamp((fanH * 0.9) / refPhoneH, 0.54, 0.84)
  const peekRise = Math.min(62, fanH * 0.16)
  peekX = fanCenterX - fanW * (vw > 720 ? 0.17 : 0.14)
  peekDocY = fanTopDocY + (refPhoneH * peekScale) / 2 - peekRise

  if (continuous) {
    movesScale = mSlot.height / baseH
    insideStart = Math.round(insideSection.getBoundingClientRect().top + window.scrollY)
    const foliosBottomDocY = insideFoliosEl.getBoundingClientRect().bottom + window.scrollY

    folioGeom = folios.map((el, i) => {
      const sentinelDocY = folioSentinels[i].getBoundingClientRect().top + window.scrollY
      const stickyTop = parseFloat(getComputedStyle(el).top) || 0
      const fRect = el.getBoundingClientRect()
      const sRect = folioSlots[i].getBoundingClientRect()
      return {
        sentinelDocY,
        stickyTop,
        height: el.offsetHeight,
        enterY: sentinelDocY - vh,
        stickY: sentinelDocY - stickyTop,
        slotX: sRect.left + sRect.width / 2,
        slotY: stickyTop + (sRect.top - fRect.top) + sRect.height / 2,
        slotScale: sRect.height / baseH,
      }
    })

    // Guarantee a minimum calm hold zone before the next sheet starts sweeping even on tall displays
    for (let i = 1; i < folioGeom.length; i++) {
      const minEnter = folioGeom[i - 1].stickY + 60
      if (folioGeom[i].enterY < minEnter && minEnter < folioGeom[i].stickY - 80) {
        folioGeom[i].enterY = minEnter
      }
    }

    const last = folioGeom[folioGeom.length - 1]
    foliosReleaseY = Math.max(last.stickY + 1, foliosBottomDocY - (last.stickyTop + last.height))

    editionTop = Math.round(editionSection.getBoundingClientRect().top + window.scrollY)
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const eSlot = editionPhoneSlot.getBoundingClientRect()
    editionSlotDocX = eSlot.left + eSlot.width / 2
    editionSlotDocY = eSlot.top + window.scrollY + eSlot.height / 2
    editionScale = eSlot.height / baseH
    editionDockY = Math.min(editionTop, maxScroll)
  } else {
    folioGeom = []
  }

  if (!pinnedMoves) {
    mobilePhoneRig.style.transform = 'none'
    stage.style.setProperty('--stage-ui', '1')
    stage.style.setProperty('--word-scale', '1')
    showStaticMove(Math.max(0, currentMove))
  } else {
    if (wasPinnedMoves !== pinnedMoves || wasContinuous !== continuous) {
      mobilePhoneRig.style.transform = 'none'
    }
    snapImmediately()
  }
}

function chooseMove(index) {
  if (!pinnedMoves) {
    showStaticMove(index)
    return
  }
  const target = movesStart + (movesRange * (index + 0.1)) / frames.length
  lenis.scrollTo(target, { duration: 0.65 })
}

function syncMotionPreference() {
  lenis?.destroy()
  lenis = undefined
  if (reducedMotion.matches) {
    fan.style.removeProperty('--front-y')
    fan.style.removeProperty('--mid-y')
    fan.style.removeProperty('--back-y')
    strip.style.removeProperty('transform')
    resetFolioVars()
  } else {
    lenis = new Lenis({ autoRaf: true, lerp: 0.1, smoothWheel: true, syncTouch: false })
    lenis.on('scroll', scheduleTick)
  }
  lastCover = -1
  measure()
}

function setupNavigation() {
  notesScreen.addEventListener('focusin', () => {
    if (!continuous) return
    if (window.scrollY < editionDockY - 40) {
      if (lenis) lenis.scrollTo(editionDockY, { duration: 0.65 })
      else window.scrollTo({ top: editionDockY })
    }
  })
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]')
    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    const id = link.hash.slice(1)
    const target = document.getElementById(id)
    if (!target || !lenis) return
    event.preventDefault()
    if (location.hash !== link.hash) history.pushState(null, '', link.hash)
    target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
    if (continuous && id === 'edition') {
      lenis.scrollTo(editionDockY, { duration: 0.95 })
    } else if (continuous && id === 'inside') {
      lenis.scrollTo(insideStart, { duration: 0.95 })
    } else {
      lenis.scrollTo(target, { duration: 0.9 })
    }
  })
}

function promoteLazyImages() {
  for (const image of document.querySelectorAll('img[loading="lazy"]')) {
    image.loading = 'eager'
  }
}

document.documentElement.classList.add('enhanced')
setupCoverRoll()
setupFolios()
setupNavigation()
moveButtons.forEach((button, i) => button.addEventListener('click', () => chooseMove(i)))
syncMotionPreference()
reducedMotion.addEventListener('change', syncMotionPreference)
window.addEventListener('scroll', scheduleTick, { passive: true })
window.addEventListener('resize', measure)
if (document.readyState === 'complete') promoteLazyImages()
else window.addEventListener('load', promoteLazyImages, { once: true })
const layoutChanges = new ResizeObserver(measure)
layoutChanges.observe(stage)
layoutChanges.observe(hero)
layoutChanges.observe(insideSection)
layoutChanges.observe(editionSection)
document.fonts.ready.then(measure)
