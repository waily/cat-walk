import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import type { CatFrame } from '../types'

const EYES = {
  normal: '(=^.^=)',
  o_o: '(=o.o=)',
  dollar: '(=$.$=)',
  dizzy: '(=@.@=)',
  sleep: '(=-.-=)',
  happy: '(=^o^=)',
  shy: '(=#.#=)',
  back: '(     )', // seen from behind
}
const EARS = {
  normal: '/\\_/\\',
  l1: '[\\_/\\',
  l2: '|\\_/\\',
  r1: '/\\_/]',
  r2: '/\\_/|',
  b1: '[\\_/]',
  b2: '|\\_/|',
  lb1: '[\\_/|',
  rb1: '|\\_/]',
}
const Z_ANIM = ['z z z', ' z z', 'z z z', '  z']

const TICK_MS = 150
const FACE_W = 9
const Z_W = 6
const RESERVED_W = 16 // button
const MIN_COLUMNS = 40 // narrower than this, only the button is drawn
const HAPPY_S = 2 // seconds the cat smiles after a reply
const SHY_S = 2 // seconds the cat blushes when you start typing, then turns its back

const enabled = atom({ plugin: 'cat-walk', key: 'enabled' } as const, true)
const visible = atom({ plugin: 'cat-walk', key: 'visible' } as const, false)
const frame = atom(
  { plugin: 'cat-walk', key: 'frame' } as const,
  { x: 0, ears: EARS.normal, eyes: EYES.normal, z: '' } as CatFrame,
)

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]!

let idleLimit = 0 // 0 = off
let SLOWEST = 3 // ticks per column (1 tick = TICK_MS)
let FASTEST = 1
let isBeepOn = true
let beepNotes: Array<[number, number]> = [] // [Hz, ms]; Hz 0 is a silent gap
let beepWay = -1 // index of the player that worked; -1 untried, -2 none
let isOneLine = false

const ticksOf = (ms: unknown, fallback: number) => {
  const n = Number(ms)
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.round(n / TICK_MS)) : fallback
}

// "880:120,0:60,1100:200" -> [[880,120],[0,60],[1100,200]]; bounded, ints only.
const parseSequence = (text: unknown): Array<[number, number]> => {
  const notes: Array<[number, number]> = []
  for (const part of String(text ?? '').split(',').slice(0, 12)) {
    const [f, d] = part.split(':').map(v => Math.round(Number(v)))
    if (f === undefined || d === undefined || !Number.isFinite(f) || !Number.isFinite(d)) continue
    if (f !== 0 && (f < 37 || f > 32767)) continue
    notes.push([f, Math.min(Math.max(d, 10), 1000)])
  }
  return notes
}

// Players are tried in order; the first that works is remembered. Every number
// handed to a command is a bounded integer parsed above, never raw text.
const beepCommands = (notes: Array<[number, number]>): string[][] => {
  const ps = notes
    .map(([f, d]) => (f === 0 ? `Start-Sleep -Milliseconds ${d}` : `[console]::Beep(${f},${d})`))
    .join(';')
  const count = Math.max(1, notes.filter(([f]) => f !== 0).length)
  return [
    ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', ps],
    ['osascript', '-e', `beep ${count}`],
    ['paplay', '/usr/share/sounds/freedesktop/stereo/complete.oga'],
  ]
}

const beep = async ($: Engine) => {
  // /cat off silences this mod's beep too; nothing outside the mod is touched.
  if (!isEnabled || !isBeepOn || beepNotes.length === 0 || beepWay === -2) return
  const ways = beepCommands(beepNotes)
  const order = beepWay >= 0 ? [beepWay] : ways.map((_, i) => i)
  const timeoutMs = beepNotes.reduce((n, [, d]) => n + d, 0) + 8000
  for (const i of order) {
    try {
      const r = await $.process.run(ways[i]!, { timeoutMs })
      if (r.exitCode === 0) {
        beepWay = i
        return
      }
    } catch {}
  }
  if (beepWay < 0) beepWay = -2
  void $.ui.notify('Done')
}


// Mirrors of the atoms: timers read these, never `$`, so an idle session
// costs one trivial callback per second.
let isEnabled = true
let isVisible = false
let isWorking = false
let isActive = false // false in a -p run or the SDK: the mod does nothing
let happyTimer = 0
let shyTimer = 0 // > 0: blushing, standing still
let isBack = false // back turned, standing still until idle time or the AI starts
let sinceInput = 0 // seconds since the user last typed or sent a prompt (idle trigger)

let width = 80
let x = 0
let target = 0
let eyes = EYES.normal
let ears = EARS.normal
let eyeTimer = rnd(2, 4)
let earTimer = rnd(1, 3)
let twitch = 0
let sleeping = false
let sleepTimer = 0
let walkTimer = rnd(8, 14)
let zIdx = 0
let zTick = 0
let moveTick = 0
let moveEvery = SLOWEST
let segmentLeft = 0 // columns left before the speed is drawn again
let pauseTimer = 0

let fast: { cancel: () => void } | null = null
let slowStarted = false

const maxX = () => Math.max(0, width - RESERVED_W - FACE_W - Z_W)

const step = (): CatFrame => {
  const dt = TICK_MS / 1000
  if (shyTimer > 0) {
    shyTimer -= dt
    if (shyTimer <= 0) isBack = true
    return { x, ears: EARS.normal, eyes: EYES.shy, z: '' }
  }
  if (isBack) return { x, ears: EARS.normal, eyes: EYES.back, z: '~' }
  if (happyTimer > 0) {
    happyTimer -= dt
    sleeping = false // a reply wakes the cat
    return { x, ears: EARS.normal, eyes: EYES.happy, z: '' }
  }
  if (sleeping) {
    sleepTimer -= dt
    zTick += 1
    if (zTick % 3 === 0) zIdx += 1
    if (sleepTimer <= 0) {
      sleeping = false
      eyes = EYES.normal
      ears = EARS.normal
      walkTimer = rnd(8, 14)
      return { x, ears, eyes, z: '' }
    }
    return { x, ears: EARS.normal, eyes: EYES.sleep, z: Z_ANIM[zIdx % Z_ANIM.length]! }
  }

  walkTimer -= dt
  if (walkTimer <= 0) {
    if (Math.random() < 0.25) {
      sleeping = true
      sleepTimer = rnd(3.5, 6)
      zIdx = 0
      zTick = 0
    } else {
      walkTimer = rnd(8, 14)
    }
  }

  eyeTimer -= dt
  if (eyeTimer <= 0) {
    eyes = Math.random() < 0.65 ? EYES.normal : pick([EYES.o_o, EYES.dollar, EYES.dizzy])
    eyeTimer = rnd(2, 4.5)
  }

  if (twitch > 0) {
    twitch -= dt
    if (twitch <= 0) {
      ears = EARS.normal
      earTimer = rnd(1.2, 3.2)
    }
  } else {
    earTimer -= dt
    if (earTimer <= 0) {
      ears =
        Math.random() < 0.6
          ? pick([EARS.l1, EARS.l2, EARS.r1, EARS.r2])
          : pick([EARS.b1, EARS.b2, EARS.lb1, EARS.rb1])
      twitch = 0.22
    }
  }

  const limit = maxX()
  if (target > limit) target = limit
  if (eyes === EYES.dizzy) {
    // Dizzy: reels left and right at random, ignoring the target.
    x += Math.floor(rnd(-2, 3))
  } else if (pauseTimer > 0) {
    pauseTimer -= dt // standing still; eyes and ears keep moving
  } else {
    moveTick += 1
    if (moveTick % moveEvery === 0) {
      if (x < target) x += 1
      else if (x > target) x -= 1
      // Speed holds for a random stretch, then is drawn again.
      segmentLeft -= 1
      if (segmentLeft <= 0) {
        moveEvery = FASTEST + Math.floor(Math.random() * (SLOWEST - FASTEST + 1))
        segmentLeft = Math.floor(rnd(8, 26))
      }
      if (Math.abs(x - target) < 2) {
        target = Math.floor(rnd(0, limit + 1))
        pauseTimer = rnd(1.5, 4) // arrived: rest a moment
      } else if (Math.random() < 0.04) {
        pauseTimer = rnd(1, 3) // stops now and then on the way
      }
    }
  }
  x = Math.max(0, Math.min(x, limit))

  return { x, ears, eyes, z: '' }
}

// Walking animation: runs only while the cat is on screen.
const syncFast = ($: Engine) => {
  if (isVisible && !fast) {
    fast = $.clock.every(TICK_MS, () => {
      const f = step()
      void update($, frame, () => f)
    })
  } else if (!isVisible && fast) {
    fast.cancel()
    fast = null
  }
}

const setVisible = async ($: Engine, v: boolean) => {
  isVisible = v
  shyTimer = 0
  isBack = false
  syncFast($)
  await update($, visible, () => v)
}
const setEnabled = async ($: Engine, v: boolean) => {
  isEnabled = v
  await update($, enabled, () => v)
}

// One press / one /cat: hidden-by-typing or off -> cat out; else cat off.
const toggle = async ($: Engine) => {
  if (isEnabled && !isVisible) {
    await setVisible($, true)
  } else if (isEnabled) {
    await setEnabled($, false)
    await setVisible($, false)
  } else {
    await setEnabled($, true)
    await setVisible($, true)
  }
}

// Text the mod shows. The manifest is English; config.describe relabels the
// /config rows (the menu keeps the manifest's descriptions in its pop-ups).
type Lang = 'en' | 'zh-TW'
const TEXT = {
  en: {
    titles: {
      idleSeconds: 'Idle seconds before the cat comes out',
      style: 'Cat style',
      speedFastest: 'Fastest speed (ms per column)',
      speedSlowest: 'Slowest speed (ms per column)',
      beep: 'Beep when a reply is done',
      beepSequence: 'Beep sequence',
      language: 'Language',
    } as Record<string, string>,
    command: 'Toggle the walking text cat above the prompt',
    on: 'On',
    off: 'Off',
    hidden: 'hidden',
  },
  'zh-TW': {
    titles: {
      idleSeconds: '閒置幾秒後貓出來',
      style: '貓的樣式',
      speedFastest: '最快速度（毫秒/格）',
      speedSlowest: '最慢速度（毫秒/格）',
      beep: '回覆完成時嗶聲',
      beepSequence: '嗶聲序列',
      language: '語言',
    } as Record<string, string>,
    command: '開關提示框上方散步的文字貓',
    on: '開啟',
    off: '關閉',
    hidden: '暫時隱藏',
  },
}
let langOption = 'auto'
let lang: Lang = 'en'
const t = () => TEXT[lang]

const ZH_TW = /繁|正體|traditional|zh[-_]?(tw|hk|mo|hant)|台灣|臺灣|香港/i

// auto: Claude Code's own Language setting, then the locale variables.
const resolveLang = async ($: Engine): Promise<Lang> => {
  if (langOption === 'en' || langOption === 'zh-TW') return langOption
  try {
    const language = (await $.settings.read()).language
    if (typeof language === 'string' && language.trim() !== '') {
      return ZH_TW.test(language) ? 'zh-TW' : 'en'
    }
  } catch {}
  for (const v of [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')]) {
    if (v) return ZH_TW.test(v) ? 'zh-TW' : 'en'
  }
  return 'en'
}

export const register: Register = (on, options) => {
  langOption = String(options?.language ?? 'auto')
  if (langOption === 'en' || langOption === 'zh-TW') lang = langOption
  idleLimit = Number(options?.idleSeconds) || 0
  isOneLine = options?.style === 'one-line'
  SLOWEST = ticksOf(options?.speedSlowest, 3)
  FASTEST = ticksOf(options?.speedFastest, 1)
  if (FASTEST > SLOWEST) [FASTEST, SLOWEST] = [SLOWEST, FASTEST]
  isBeepOn = options?.beep !== 'off'
  beepNotes = parseSequence(options?.beepSequence ?? '880:100,1320:150')

  on('session.start', async ($, e, next) => {
    // No person at the prompt (-p, SDK): no cat, no timers, no beep.
    isActive = e.isInteractive
    if (!isActive) return next(e)
    lang = await resolveLang($)
    $.ui.invalidate('config.describe')
    await $.command.register({
      name: 'cat',
      description: t().command,
    })
    if (!slowStarted) {
      slowStarted = true
      // 1 Hz: idle detection.
      $.clock.every(1000, async () => {
        sinceInput += 1
        if (idleLimit > 0 && sinceInput >= idleLimit) {
          if (isEnabled && !isVisible) await setVisible($, true)
          else if (isBack) isBack = false // idle long enough: turns round and walks again
        }
      })
    }
    return next(e)
  })

  // The prompt went out: the cat comes out while you wait for the AI.
  on('prompt.submit', async ($, e, next) => {
    // Never let the cat get in the way of sending a prompt.
    if (!isActive) return next(e)
    try {
      sinceInput = 0
      isWorking = true
      // The AI starts working: the cat turns round and walks again.
      shyTimer = 0
      isBack = false
      if (isEnabled && !isVisible) await setVisible($, true)
    } catch {}
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    // A subagent's turn ends mid-way through the main one: not the reply.
    if (!isActive || e.agentId) return next(e)
    const wasWorking = isWorking
    isWorking = false
    // Only a reply that ended normally: not Esc, an error or a refusal.
    if (wasWorking && e.reason === 'answer' && !e.isAborted) {
      if (isVisible) happyTimer = HAPPY_S
      void beep($) // fire and forget: never delays the turn
    }
    return next(e)
  })

  on('command.run', { command: 'cat' }, async $ => {
    await toggle($)
    return { text: isEnabled ? (isVisible ? t().on : t().hidden) : t().off }
  })

  // Our own /config rows, in the resolved language.
  on('config.describe', async ($, e, next) => {
    const r = await next(e)
    if (!e.key.startsWith('cat-walk')) return r
    const title = t().titles[e.key.slice(e.key.lastIndexOf('.') + 1)]
    return title ? { ...r, label: title } : r
  })

  // Typing hides the cat; it returns on the button, /cat, a submit or when idle.
  on('prompt.edit', async ($, e, next) => {
    const draft = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    const isSlash = draft.startsWith('/')
    if (!isSlash && (e.inputText !== '' || e.end > e.start)) {
      sinceInput = 0
      // Typing starts: the cat blushes (=#.#=) for a moment, then turns its
      // back and stands still. More typing does not restart it.
      if (isVisible && shyTimer <= 0 && !isBack) {
        shyTimer = SHY_S
        sleeping = false
        await update($, frame, () => ({ x, ears: EARS.normal, eyes: EYES.shy, z: '' }))
      }
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // Not drawn while a subagent's transcript is in view.
    if (!isActive || e.props.hasSurvey || e.props.view?.agentId) return next(e)
    width = e.props.bodyColumns
    if (!e.props.isWorking) isWorking = false

    const isOn = await read($, enabled)
    // Too narrow for the cat and the button side by side: the button alone.
    const isShown = isOn && (await read($, visible)) && width >= MIN_COLUMNS
    const f = await read($, frame)
    const { Box, Button, Text } = $.ui.resolve(e)

    const pad = ' '.repeat(Math.min(f.x, maxX()))
    // one-line: the ears become the face's brackets, so the band keeps one row.
    const left = f.ears[0] === '/' ? '(' : f.ears[0]
    const right = f.ears[4] === '\\' ? ')' : f.ears[4]
    const inner = f.eyes.slice(1, -1)
    const tail = f.z ? ' ' + f.z : ''
    const line1 = `${pad}  ${f.ears}`
    const line2 = isOneLine
      ? `${pad}${left}${inner}${right}${tail}`
      : `${pad} ${f.eyes}${tail}`

    return (
      <Box flexDirection="row" alignItems="flex-start" width={e.props.bodyColumns}>
        <Box flexDirection="column" flexGrow={1}>
          {isShown && !isOneLine ? <Text color="yellow">{line1}</Text> : null}
          {isShown ? <Text color="yellow">{line2}</Text> : null}
        </Box>
        <Box flexDirection="column" alignItems="flex-end">
          <Button
            key="toggle"
            plain
            label={`[Cat-walk:${isOn ? t().on : t().off}]`}
            onPress={() => toggle($)}
          />
        </Box>
      </Box>
    )
  })
}
