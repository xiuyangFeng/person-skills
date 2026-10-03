import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const T0 = Date.parse('2026-10-02T12:00:00Z')
const HOUR = 3600e3

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 150,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

const LIMITS = [
  { kind: 'five_hour', percentUsed: 23, resetsAt: new Date(T0 + 3 * HOUR + 20 * 60e3).toISOString() },
  { kind: 'seven_day', percentUsed: 84, resetsAt: new Date(T0 + 62 * HOUR).toISOString() },
]

const USAGE = {
  startedAt: 1,
  context: { window: 200000 },
  rateLimits: LIMITS,
  cost: { usd: 3.21 },
}

const BREAKDOWN = {
  categories: [
    { name: 'Messages', tokens: 60000, color: 'x', isDeferred: false, kind: 'used' },
    { name: 'System prompt', tokens: 20000, color: 'x', isDeferred: false, kind: 'used' },
    { name: 'Free space', tokens: 100000, color: 'x', isDeferred: false, kind: 'free' },
  ],
  totalTokens: 80000,
  maxTokens: 200000,
  rawMaxTokens: 200000,
  percentage: 40,
  gridRows: [],
  isAutoCompactEnabled: true,
  autoCompactThreshold: 167000,
}

// 一次模型请求的用量：输入侧 1000 + 90900 + 200 = 92100（200k 窗口的 46%）
const STEP_USAGE = {
  input_tokens: 1000,
  output_tokens: 1300,
  cache_read_input_tokens: 90900,
  cache_creation_input_tokens: 200,
  model: 'claude-opus-5-5',
}

// 引擎自身行为的替身：测试里 on 注册的钩子位于所有插件之下
const engine = (on: On, toasts: string[] = [], mem: Record<string, unknown> = {}) => {
  mock.clock(on, { now: T0 })
  on('store.get', ($, e) => ({ value: mem[e.key] }))
  on('store.set', ($, e) => {
    mem[e.key] = e.value
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    delete mem[e.key]
    return { value: undefined }
  })
  on('session.id', () => ({ value: 's1' }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('config.set', ($, e) => ({ value: e.value }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.usage', ($, e) => ({
    value: (e?.breakdown ? { ...USAGE, context: { ...USAGE.context, breakdown: BREAKDOWN } } : USAGE) as never,
  }))
  on('turn.step', async function* ($, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use', usage: STEP_USAGE } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, {}, 'engine band') as RenderElement
  })
}

const endTurn = ($: { turn: { complete: (e: never) => Promise<unknown> } }) =>
  $.turn.complete({
    answer: 'ok',
    durationMs: 42000,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: STEP_USAGE,
  } as never)

test('full layout updates after every model request, not only at turn end', { options: { layout: 'full' } }, async ($, on) => {
  engine(on)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  for await (const chunk of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 3 })) void chunk

  // 轮次还没结束：转圈 + 已按这次请求刷新上下文占用、累计与命中率
  const busy = await $.ui.mount({ plugin: 'context-meter', surface: 'terminal', ...BAND })
  expect(await busy.find({ type: 'Text', text: /生成中/ })).toBeDefined()
  expect(await busy.find({ type: 'Text', text: /^ ?46%$/ })).toBeDefined()
  expect(await busy.find({ type: 'Text', text: /92\.1k\/200k/ })).toBeDefined()
  expect(await busy.find({ type: 'Text', text: /Σ 93\.4k · 0 轮/ })).toBeDefined()
  // 命中 = 90900 / 92100 ≈ 99%
  expect(await busy.find({ type: 'Text', text: /^ ?99%$/ })).toBeDefined()
  await busy.unmount()

  await endTurn($ as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'context-meter', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /✓ 42s/ })).toBeDefined()
    // 轮次结束：累计不重复计入，只加轮数
    expect(await ui.find({ type: 'Text', text: /Σ 93\.4k · 1 轮 · \$3\.21 · opus-5-5/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /上轮 99%/ })).toBeDefined()
    // 额度：饼图标 + 紧凑的重置倒计时
    expect(await ui.find({ type: 'Text', text: /^ ↻3h$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^ ↻2d14h$/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^ ?46%$/ }))?.props.color).toBe('#eccd1e')
    await ui.unmount()
  }

  // 展开明细：/context 分类、额度消耗
  const ui = await $.ui.mount({ plugin: 'context-meter', surface: 'terminal', ...BAND })
  await ui.press({ key: 'toggle' })
  expect(await ui.find({ type: 'Text', text: /阈值 167k/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^系统提示词$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /2d14h 后重置/ })).toBeDefined()
  await ui.unmount()

  // 浅色主题：同一处换成浅色梯度
  await $.config.set({ key: 'theme', value: 'light', previous: 'dark', provider: { plugin: 'engine' } } as never)
  const light = await $.ui.mount({ plugin: 'context-meter', surface: 'terminal', ...BAND })
  expect((await light.find({ type: 'Text', text: /^ ?46%$/ }))?.props.color).toBe('#bc8c0a')
  await light.unmount()
})

test('auto layout folds to one line when idle', async ($, on) => {
  engine(on)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  for await (const chunk of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 3 })) void chunk
  // 生成中：完整三行
  const busy = await $.ui.mount({ plugin: 'context-meter', surface: 'terminal', ...BAND })
  expect(await busy.find({ type: 'Text', text: / 上下文$/ })).toBeDefined()
  await busy.unmount()

  await endTurn($ as never)
  const idle = await $.ui.mount({ plugin: 'context-meter', surface: 'terminal', ...BAND })
  expect(await idle.find({ type: 'Text', text: / 上下文$/ })).toBeUndefined()
  expect(await idle.find({ type: 'Text', text: /^ 46%$/ })).toBeDefined()
  expect(await idle.find({ type: 'Text', text: /^ 99%$/ })).toBeDefined()
  expect(await idle.find({ type: 'Text', text: /^ ↻2d14h$/ })).toBeDefined()
  expect(await idle.find({ type: 'Text', text: /^Σ 93\.4k$/ })).toBeDefined()
  await idle.unmount()

  // 窄终端：放不下就依次去掉 Σ、重置倒计时，占用和命中始终在
  const narrow = await $.ui.mount({
    plugin: 'context-meter',
    surface: 'terminal',
    ...BAND,
    props: { ...BAND.props, bodyColumns: 80 },
  })
  expect(await narrow.find({ type: 'Text', text: /^Σ/ })).toBeUndefined()
  expect(await narrow.find({ type: 'Text', text: /↻/ })).toBeUndefined()
  expect(await narrow.find({ type: 'Text', text: /^ 46%$/ })).toBeDefined()
  expect(await narrow.find({ type: 'Text', text: /^ 99%$/ })).toBeDefined()
  await narrow.unmount()
})

test('each finished turn is saved under the session id', { options: { layout: 'full' } }, async ($, on) => {
  const mem: Record<string, unknown> = {}
  engine(on, [], mem)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  for await (const chunk of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 3 })) void chunk
  await endTurn($ as never)
  const saved = mem['session:s1'] as { totals: { turns: number; cacheRead: number } } | undefined
  expect(saved?.totals.turns).toBe(1)
  expect(saved?.totals.cacheRead).toBe(90900)
  expect(mem.index).toEqual(['s1'])
})

test('restore fills an empty session from the stored snapshot', { options: { layout: 'full' } }, async ($, on) => {
  const mem: Record<string, unknown> = {}
  engine(on, [], mem)
  mem['session:s1'] = ({
    totals: { since: 0, turns: 7, input: 1000, output: 2000, cacheRead: 90000, cacheWrite: 1000, subagent: 0 },
    last: { seconds: 30, tools: 2, model: 'claude-opus-5-5', hit: 97 },
    history: { ctx: [10, 20, 30], hit: [90, 95, 97], marks: [] },
    burn: { seven_day: 0.5 },
    lastCompact: null,
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('config.list', () => ({ value: [] }))
  on('session.surfaces', () => ({ value: [] }))
  mock.env(on, {})
  await $.session.start({ cwd: '/w', surface: null, isInteractive: false })
  const ui = await $.ui.mount({ plugin: 'context-meter', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /Σ 94k · 7 轮/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /上轮 97%/ })).toBeDefined()
  await ui.unmount()
})

test('compaction updates the meter, marks the trend and toasts', { options: { layout: 'full' } }, async ($, on) => {
  const toasts: string[] = []
  engine(on, toasts)
  const summary = [{ role: 'user', text: '摘要', toolUses: [] }]
  on('session.compact', () => ({ messages: summary, tokensBefore: 180000, tokensAfter: 32000 }) as never)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  for await (const chunk of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 3 })) void chunk
  await $.session.compact({ trigger: 'auto', messages: summary } as never)
  expect(toasts).toContain('⛁ 已压缩 180k → 32k')
  const ui = await $.ui.mount({ plugin: 'context-meter', surface: 'terminal', ...BAND })
  // 32000 / 200000 = 16%
  expect(await ui.find({ type: 'Text', text: /^ ?16%$/ })).toBeDefined()
  await ui.press({ key: 'toggle' })
  expect(await ui.find({ type: 'Text', text: /上次压缩 180k → 32k · 刚刚 · 自动/ })).toBeDefined()
  await ui.unmount()
})

test('threshold alerts fire once per level', async ($, on) => {
  const toasts: string[] = []
  engine(on, toasts)
  const measure = (percent: number, seven: number) =>
    $.session.measure({
      context: { tokens: percent * 2000, window: 200000, percent },
      rateLimits: [{ ...LIMITS[1]!, percentUsed: seven }],
      changed: ['context'],
    })
  await measure(72, 84)
  await measure(74, 85)
  await measure(86, 91)
  expect(toasts.filter(x => x.startsWith('⛁ 上下文'))).toEqual(['⛁ 上下文 72%', '⛁ 上下文 86%'])
  expect(toasts.filter(x => x.includes('7d 额度'))).toEqual(['● 7d 额度 91% · ↻2d14h'])
})

test('alerts can be switched off', { options: { alerts: false } }, async ($, on) => {
  const toasts: string[] = []
  engine(on, toasts)
  await $.session.measure({ context: { tokens: 180000, window: 200000, percent: 90 }, rateLimits: [], changed: ['context'] })
  expect(toasts).toEqual([])
})

test('band yields to a survey', async ($, on) => {
  engine(on)
  const ui = await $.ui.mount({
    plugin: 'context-meter',
    surface: 'terminal',
    ...BAND,
    props: { ...BAND.props, hasSurvey: true },
  })
  expect(await ui.find({ type: 'Text', text: /engine band/ })).toBeDefined()
  await ui.unmount()
})

// ── 子代理侧栏 ─────────────────────────────────────────────────
const PANE = {
  component: 'Pane',
  requestId: 'context-meter-agents',
  props: {
    title: '⚙ 子代理',
    isFocused: false,
    bodyColumns: 44,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 39 },
    view: {},
  },
  viewport: { columns: 200, rows: 40, isFullscreen: true },
} as const

type AgentRow = { id: string; description: string; type: string; status: string }

const agentsWorld = (on: On, list: AgentRow[], opened: string[], closed: string[]) => {
  on('agent.list', () => ({ value: list as never }))
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } as never }
  })
  on('ui.close', ($, e) => {
    closed.push(e.id)
    return { value: undefined } as never
  })
  on('tool.call', () => ({ result: null, text: 'ok' }) as never)
}

test('calling a subagent opens the side panel: a wave per running agent, no tool arguments', async ($, on) => {
  engine(on)
  const opened: string[] = []
  const closed: string[] = []
  const list: AgentRow[] = [{ id: 'a1', description: '核对训练日志', type: 'Explore', status: 'running' }]
  agentsWorld(on, list, opened, closed)

  await $.tool.call({ tool: 'Agent', description: 'secret-desc', prompt: 'secret-prompt', subagent_type: 'Explore' } as never)
  expect(opened).toEqual(['context-meter-agents'])
  await $.tool.call({ tool: 'Grep', pattern: 'secret-pattern', path: '/secret/path', agentId: 'a1' } as never)

  const ui = await $.ui.mount({ plugin: 'context-meter', surface: 'terminal', ...PANE })
  expect(await ui.find({ type: 'Text', text: /^1 运行$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Explore$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /核对训练日志/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /🔧 1 · / })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^[▁▂▃▄▅▆▇█]+$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Grep\s*$/ })).toBeDefined()
  // 工具参数、命令、路径一律不出现
  expect(await ui.find({ type: 'Text', text: /secret/ })).toBeUndefined()

  // 收起：关面板；已有的子代理不会再把它弹出来
  await ui.press({ key: 'collapse' })
  expect(closed).toEqual(['context-meter-agents'])
  await ui.unmount()
  await $.tool.call({ tool: 'Read', file_path: '/x', agentId: 'a1' } as never)
  expect(opened.length).toBe(1)

  // 新的子代理出现：再弹出来
  list.push({ id: 'a2', description: '回填工作簿', type: 'general-purpose', status: 'running' })
  await $.tool.call({ tool: 'Read', file_path: '/y', agentId: 'a2' } as never)
  expect(opened.length).toBe(2)

  // a1 结束：变成一行 ✓
  list[0]!.status = 'completed'
  await $.turn.complete({ answer: '', durationMs: 1000, isAborted: false, turnId: 'x', reason: 'answer', agentId: 'a1' } as never)
  const after = await $.ui.mount({ plugin: 'context-meter', surface: 'terminal', ...PANE })
  expect(await after.find({ type: 'Text', text: /^1 运行$/ })).toBeDefined()
  expect(await after.find({ type: 'Text', text: /^ · 1 完成$/ })).toBeDefined()
  expect(await after.find({ type: 'Text', text: /^Explore · 核对训练日志$/ })).toBeDefined()
  await after.unmount()
})

test('inline placement shows one line per running agent', async ($, on) => {
  engine(on)
  agentsWorld(on, [{ id: 'a1', description: '核对训练日志', type: 'Explore', status: 'running' }], [], [])
  await $.tool.call({ tool: 'Read', file_path: '/x', agentId: 'a1' } as never)
  const ui = await $.ui.mount({
    plugin: 'context-meter',
    surface: 'terminal',
    ...PANE,
    props: { ...PANE.props, placement: 'inline', bodyColumns: 100 },
  })
  expect(await ui.find({ type: 'Text', text: /^Explore$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /🔧 1$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /核对训练日志/ })).toBeUndefined()
  await ui.unmount()
})

test('manual mode opens only from the ⚙ button in the band', { options: { agentPanel: 'manual' } }, async ($, on) => {
  engine(on)
  const opened: string[] = []
  agentsWorld(on, [{ id: 'a1', description: '核对训练日志', type: 'Explore', status: 'running' }], opened, [])
  await $.tool.call({ tool: 'Agent', description: 'd', prompt: 'p', subagent_type: 'Explore' } as never)
  expect(opened).toEqual([])
  const band = await $.ui.mount({ plugin: 'context-meter', surface: 'terminal', ...BAND })
  await band.press({ key: 'agents' })
  expect(opened).toEqual(['context-meter-agents'])
  await band.unmount()
})
