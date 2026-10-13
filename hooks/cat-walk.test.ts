import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

const row = (key: string, label: string) =>
  ({ key, label, isHidden: false, provider: { plugin: 'cat-walk', tier: 'user' } }) as const

// Stands for the engine beneath the plugin: hands the row back as given.
const describeBottom = (on: On) =>
  on('config.describe', async (_$, e) => ({ label: e.label, description: e.description, isHidden: e.isHidden }))

test('zh-TW: /config titles and /cat output are Traditional Chinese', { options: { language: 'zh-TW' } }, async ($, on) => {
  describeBottom(on)
  on('command.run', async () => ({ text: '' }))
  const r = await $.config.describe(row('cat-walk.beep', 'Beep when a reply is done'))
  expect(r.label).toBe('回覆完成時嗶聲')
  const out = await $.command.run({ command: 'cat', args: '' } as Parameters<typeof $.command.run>[0])
  expect(['開啟', '關閉', '暫時隱藏']).toContain(out.text)
})

test('en: /config titles stay English', { options: { language: 'en' } }, async ($, on) => {
  describeBottom(on)
  const r = await $.config.describe(row('cat-walk.style', 'Cat style'))
  expect(r.label).toBe('Cat style')
})

test('other plugins rows are untouched', { options: { language: 'zh-TW' } }, async ($, on) => {
  describeBottom(on)
  const r = await $.config.describe({ ...row('other.beep', 'Beep'), provider: { plugin: 'other', tier: 'user' } })
  expect(r.label).toBe('Beep')
})

// --- beep, headless

declare const setTimeout: (fn: (...args: unknown[]) => void, ms: number) => unknown


const interactiveStart = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

// The engine beneath: a session that starts, players that succeed, turns that end.
const engineBeneath = (on: On, played: string[][], registered: string[] = []) => {
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.register', async (_$, e) => {
    registered.push(e.name)
    return { value: undefined } as never
  })
  on('clock.every', async () => ({ value: { cancel: () => {} } }) as never)
  on('settings.read', async () => ({ value: {} }) as never)
  on('env.get', async () => ({ value: undefined }) as never)
  on('prompt.submit', async (_$, e) => ({ text: e.text }) as never)
  on('turn.complete', async () => ({ text: '' }))
  on('process.run', async (_$, e) => {
    played.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
}

const endTurn = (reason: 'answer' | 'aborted' | 'error') => ({
  answer: '', durationMs: 1000, isAborted: reason === 'aborted', turnId: 't1', reason,
}) as never

for (const reason of ['answer', 'aborted', 'error'] as const) {
  test(`turn ending with ${reason} ${reason === 'answer' ? 'beeps' : 'stays silent'}`, async ($, on) => {
    const played: string[][] = []
    engineBeneath(on, played)
    await $.session.start(interactiveStart as never)
    await $.prompt.submit({ text: 'hi' } as never)
    await $.turn.complete(endTurn(reason))
    await new Promise(r => setTimeout(r, 50))
    expect(played.length > 0).toBe(reason === 'answer')
  })
}

test('headless (-p / SDK): no /cat and no beep', async ($, on) => {
  const played: string[][] = []
  const registered: string[] = []
  engineBeneath(on, played, registered)
  await $.session.start({ cwd: '/tmp', surface: null, isInteractive: false })
  await $.prompt.submit({ text: 'hi' } as never)
  await $.turn.complete(endTurn('answer'))
  await new Promise(r => setTimeout(r, 50))
  expect(registered).toEqual([])
  expect(played).toEqual([])
})

test('/cat off silences this mod\'s beep', async ($, on) => {
  const played: string[][] = []
  engineBeneath(on, played)
  on('command.run', async () => ({ text: '' }))
  await $.session.start(interactiveStart as never)
  const cat = { command: 'cat', args: '' } as Parameters<typeof $.command.run>[0]
  await $.command.run(cat) // hidden -> shown
  const off = await $.command.run(cat) // shown -> off
  expect(off.text).toBe('Off')
  await $.prompt.submit({ text: 'hi' } as never)
  await $.turn.complete(endTurn('answer'))
  await new Promise(r => setTimeout(r, 50))
  expect(played).toEqual([])
})
