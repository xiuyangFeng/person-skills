import { atom, read, update } from 'claude-code'
import type {
  EngineInterface,
  PluginOptions,
  Register,
  SessionContextUsage,
  SessionCost,
  SessionRateLimit,
  Timer,
  TurnUsage,
} from 'claude-code'

import type { AgentActivity, Alerts, Breakdown, Burn, History, Limit, Meter, Snapshot, ToolEvent, Totals } from '../types'

const meter = atom({ plugin: 'context-meter', key: 'meter' } as const, null)
const totals = atom({ plugin: 'context-meter', key: 'totals' } as const, null)
const last = atom({ plugin: 'context-meter', key: 'last' } as const, null)
const run = atom({ plugin: 'context-meter', key: 'run' } as const, null)
const anim = atom({ plugin: 'context-meter', key: 'anim' } as const, null)
const history = atom({ plugin: 'context-meter', key: 'history' } as const, null)
const burn = atom({ plugin: 'context-meter', key: 'burn' } as const, null)
const lastCompact = atom({ plugin: 'context-meter', key: 'lastCompact' } as const, null)
const agents = atom({ plugin: 'context-meter', key: 'agents' } as const, null)
const fleet = atom({ plugin: 'context-meter', key: 'fleet' } as const, null)
const toolLog = atom({ plugin: 'context-meter', key: 'toolLog' } as const, null)
const toolCounts = atom({ plugin: 'context-meter', key: 'toolCounts' } as const, null)
const panel = atom({ plugin: 'context-meter', key: 'panel' } as const, null)
const alerts = atom({ plugin: 'context-meter', key: 'alerts' } as const, null)
const minute = atom({ plugin: 'context-meter', key: 'minute' } as const, 0)
const isExpanded = atom({ plugin: 'context-meter', key: 'isExpanded' } as const, false)
const breakdown = atom({ plugin: 'context-meter', key: 'breakdown' } as const, null)
const compact = atom({ plugin: 'context-meter', key: 'compact' } as const, null)
const isLight = atom({ plugin: 'context-meter', key: 'isLight' } as const, false)
const isReducedMotion = atom({ plugin: 'context-meter', key: 'isReducedMotion' } as const, false)

// ── 配色：深色主题用中等明度，浅色主题整体压深一档 ───────────────────
type Rgb = [number, number, number]
type Palette = {
  accent: string
  slate: string
  cost: string
  /** 占用梯度色标：位置(0–100) → 颜色，绿 → 黄 → 橙 → 红 */
  stops: [number, Rgb][]
  /** 流光高亮往哪个颜色混 */
  glint: Rgb
  /** 缓存命中用的冷色渐变：低 → 高 */
  cool: [Rgb, Rgb]
  /** 命中率偏低时文字用的提醒色 */
  warn: string
  /** 子代理配色，按出现顺序轮换 */
  hues: Rgb[]
  /** 波浪低处混入的底色 */
  waveBase: Rgb
}

const DARK: Palette = {
  accent: '#d97757',
  slate: '#94a3b8',
  cost: '#2dd4bf',
  stops: [
    [0, [74, 222, 128]],
    [50, [250, 204, 21]],
    [75, [251, 146, 60]],
    [100, [244, 63, 94]],
  ],
  glint: [255, 255, 255],
  cool: [
    [34, 211, 238],
    [74, 222, 128],
  ],
  warn: '#f59e0b',
  hues: [
    [56, 189, 248],
    [167, 139, 250],
    [244, 114, 182],
    [52, 211, 153],
    [251, 191, 36],
    [251, 113, 133],
  ],
  waveBase: [55, 65, 81],
}

const LIGHT: Palette = {
  accent: '#c15f3c',
  slate: '#64748b',
  cost: '#0d9488',
  stops: [
    [0, [22, 163, 74]],
    [50, [202, 138, 4]],
    [75, [234, 88, 12]],
    [100, [220, 38, 38]],
  ],
  glint: [0, 0, 0],
  cool: [
    [8, 145, 178],
    [22, 163, 74],
  ],
  warn: '#d97706',
  hues: [
    [2, 132, 199],
    [124, 58, 237],
    [219, 39, 119],
    [5, 150, 105],
    [217, 119, 6],
    [225, 29, 72],
  ],
  waveBase: [203, 213, 225],
}

const LIMIT_LABEL: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: '额度' }
// /context 的分类名 → 中文；不认识的原样显示
const CATEGORY_LABEL: Record<string, string> = {
  'System prompt': '系统提示词',
  'System tools': '系统工具',
  'MCP tools': 'MCP 工具',
  'MCP server instructions': 'MCP 服务说明',
  'Custom agents': '自定义代理',
  'Memory files': '记忆文件',
  Skills: '技能',
  'Slash commands': '斜杠命令',
  Messages: '对话消息',
}

// Claude Code 自己的转圈字形，来回呼吸
const SPIN = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢']
const PIE = ['○', '◔', '◑', '◕', '●']
const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
const FRAME_MS = 120
const SLOW_FRAME_MS = 1000
const HISTORY_MAX = 24
const LABEL_WIDTH = 11
const NUM_WIDTH = 25
const RIGHT_WIDTH = 20
const CTX_LEVELS = [70, 85]
const LIMIT_LEVELS = [90, 95]
const STORE_INDEX = 'index'
const STORE_KEEP = 40
const PANEL_ID = 'context-meter-agents'
const PANEL_TITLE = '⚙ 子代理'
const DONE_KEEP = 6
const TOOL_LOG_MAX = 40
const AUTO_CLOSE_MS = 60_000

// ── 选项（/config 里的 userConfig） ─────────────────────────────
type Settings = {
  layout: 'auto' | 'full' | 'compact'
  animation: boolean
  trend: number
  alerts: boolean
  agentPanel: 'auto' | 'sticky' | 'manual'
}

const readSettings = (o: PluginOptions): Settings => ({
  layout: o.layout === 'full' || o.layout === 'compact' ? o.layout : 'auto',
  animation: o.animation !== false,
  trend: o.trend === 'off' ? 0 : o.trend === '12' ? 12 : 24,
  alerts: o.alerts !== false,
  agentPanel: o.agentPanel === 'sticky' || o.agentPanel === 'manual' ? o.agentPanel : 'auto',
})

// 模块级运行时：热重载时整个模块重新求值，这些随之归零
const rt = {
  settings: readSettings({}),
  isDemo: false,
  isReduced: false,
  needsFrame: false,
  isStepping: false,
  needsEstimate: false,
  frameNo: 0,
  agentsRunning: 0,
  toolSeq: 0,
  closePending: false,
  ticker: null as Timer | null,
  slow: null as Timer | null,
}

const isAnimated = (): boolean => rt.settings.animation && !rt.isReduced

// ── 小工具 ────────────────────────────────────────────────────
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

const hex = (n: number): string => Math.round(n).toString(16).padStart(2, '0')
const css = ([r, g, b]: Rgb): string => `#${hex(r)}${hex(g)}${hex(b)}`
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

const rgbAt = (pal: Palette, pct: number): Rgb => {
  const p = clamp(pct, 0, 100)
  for (let i = 1; i < pal.stops.length; i++) {
    const [p1, c1] = pal.stops[i]!
    const [p0, c0] = pal.stops[i - 1]!
    if (p <= p1) return mix(c0, c1, (p - p0) / (p1 - p0))
  }
  return pal.stops[pal.stops.length - 1]![1]
}

const fmt = (n: number): string => {
  if (n < 1000) return String(Math.round(n))
  if (n < 1e5) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`
  if (n < 1e6) return `${Math.round(n / 1e3)}k`
  return `${(n / 1e6).toFixed(2)}M`
}

const mmss = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** 距某个 ISO 时刻还有多久，紧凑写法：2d14h / 3h / 35m；未知为 null。 */
const until = (iso: string | null, now: number): string | null => {
  if (!iso) return null
  const ms = Date.parse(iso) - now
  if (!Number.isFinite(ms)) return null
  const m = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d >= 1) return `${d}d${h % 24}h`
  if (h >= 1) return `${h}h`
  return `${Math.max(1, m)}m`
}

/** 多久以前：刚刚 / 12m / 3h / 2d。 */
const ago = (at: number, now: number): string => {
  const m = Math.max(0, Math.floor((now - at) / 60000))
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}m 前`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h 前` : `${Math.floor(h / 24)}d 前`
}

const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u2699]|\p{Emoji_Presentation}/u
const cellWidth = (s: string): number => {
  let w = 0
  for (const ch of s) w += WIDE.test(ch) ? 2 : 1
  return w
}

const shortModel = (model: string): string => model.replace(/^claude-/, '')

const pie = (pct: number): string => PIE[clamp(Math.round(pct / 25), 0, 4)]!

const limitLabel = (kind: string): string => LIMIT_LABEL[kind] ?? kind

/** 缓存命中率：缓存读 / 全部输入（未缓存 + 缓存写 + 缓存读）。 */
const hitRate = (cacheRead: number, cacheWrite: number, input: number): number | null => {
  const all = cacheRead + cacheWrite + input
  return all > 0 ? (cacheRead / all) * 100 : null
}

const totalsHit = (t: Totals | null): number | null =>
  t ? hitRate(t.cacheRead, t.cacheWrite, t.input) : null

const emptyHistory = (): History => ({ ctx: [], hit: [], marks: [] })

const pushCtx = (h: History | null, v: number): History => {
  const base = h ?? emptyHistory()
  const ctx = [...base.ctx, v]
  const drop = Math.max(0, ctx.length - HISTORY_MAX)
  return {
    ctx: ctx.slice(drop),
    hit: base.hit,
    marks: (base.marks ?? []).map(i => i - drop).filter(i => i >= 0),
  }
}

const pushHit = (h: History | null, v: number): History => {
  const base = h ?? emptyHistory()
  return { ctx: base.ctx, hit: [...base.hit, v].slice(-HISTORY_MAX), marks: base.marks ?? [] }
}

type Cell = { ch: string; color?: string; isDim?: boolean; isBold?: boolean }

/** 相邻同样式格子合并成一段，少画几个 Text。 */
const runs = (cells: Cell[]): Cell[] => {
  const out: Cell[] = []
  for (const c of cells) {
    const prev = out[out.length - 1]
    if (prev && prev.color === c.color && prev.isDim === c.isDim && prev.isBold === c.isBold) prev.ch += c.ch
    else out.push({ ...c })
  }
  return out
}

/**
 * 梯度进度条：整格 ━、半格 ╸，未用部分暗色细线；marker 处画阈值竖线；
 * glint ≥ 0 时在已用段上画一道向右扫过的流光。
 */
const barCells = (
  pal: Palette,
  colorAt: (pct: number) => Rgb,
  pct: number,
  width: number,
  marker: number | null,
  glint: number,
): Cell[] => {
  const exact = (clamp(pct, 0, 100) / 100) * width
  const full = Math.floor(exact)
  const isHalf = exact - full >= 0.5
  const cells: Cell[] = []
  for (let i = 0; i < width; i++) {
    const at = ((i + 0.5) / width) * 100
    const shine = glint >= 0 ? Math.max(0, 1 - Math.abs(i - glint) / 2.5) * 0.65 : 0
    const color = css(mix(colorAt(at), pal.glint, shine))
    if (marker !== null && i === marker && i >= full) cells.push({ ch: '┃', color: pal.slate })
    else if (i < full) cells.push({ ch: '━', color })
    else if (i === full && isHalf) cells.push({ ch: '╸', color })
    else cells.push({ ch: '─', isDim: true })
  }
  return cells
}

/**
 * 迷你走势：每轮一格 ▁…█，最新一格加粗；不足的位置留暗点。
 * 高度按 scaleMax 归一，颜色按绝对值；marks 里的点（压缩后第一轮）用强调色。
 */
const sparkCells = (
  values: number[],
  width: number,
  colorOf: (v: number) => string,
  scaleMax: number,
  marks: number[],
  markColor: string,
): Cell[] => {
  const shown = values.slice(-width)
  const offset = values.length - shown.length
  const pad = Math.max(0, width - shown.length)
  return [
    ...Array.from({ length: pad }, () => ({ ch: '·', isDim: true })),
    ...shown.map((v, i) => {
      const isMark = marks.includes(i + offset)
      return {
        ch: SPARK[clamp(Math.round((v / scaleMax) * 7), 0, 7)]!,
        color: isMark ? markColor : colorOf(v),
        isBold: isMark || i === shown.length - 1,
      }
    }),
  ]
}

/**
 * 流动波浪：两段不同频率的正弦叠加、匀速向右滑；活跃度 energy 决定振幅，
 * 越活跃波越高、还叠一层细碎涟漪。速度固定（只调振幅），避免变速时相位跳。
 */
const waveCells = (pal: Palette, hue: Rgb, width: number, t: number, energy: number, seed: number): Cell[] => {
  const base = mix(pal.waveBase, hue, 0.25)
  const cells: Cell[] = []
  for (let x = 0; x < width; x++) {
    const v =
      0.55 * Math.sin(x * 0.42 - t + seed) +
      0.3 * Math.sin(x * 0.16 - t * 0.55 + seed * 2.1) +
      0.15 * energy * Math.sin(x * 1.1 - t * 2.2 + seed * 0.7)
    const height = clamp(((v + 1) / 2) * energy, 0, 1)
    // 颜色分四档，减少要画的段数
    const tone = Math.round(height * 3) / 3
    cells.push({ ch: SPARK[Math.round(height * 7)]!, color: css(mix(base, hue, 0.3 + 0.7 * tone)) })
  }
  return cells
}

const EIGHTHS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

/** 多行高的波浪（自上而下返回各行）：同一列的高度跨行连续填满，起伏更明显。 */
const waveRows = (
  pal: Palette,
  hue: Rgb,
  width: number,
  t: number,
  energy: number,
  seed: number,
  rows: number,
): Cell[][] => {
  const base = mix(pal.waveBase, hue, 0.25)
  const out: Cell[][] = Array.from({ length: rows }, () => [])
  for (let x = 0; x < width; x++) {
    const v =
      0.55 * Math.sin(x * 0.42 - t + seed) +
      0.3 * Math.sin(x * 0.16 - t * 0.55 + seed * 2.1) +
      0.15 * energy * Math.sin(x * 1.1 - t * 2.2 + seed * 0.7)
    const height = clamp(((v + 1) / 2) * energy, 0, 1)
    const eighths = Math.max(1, Math.round(height * rows * 8))
    const tone = Math.round(height * 3) / 3
    const color = css(mix(base, hue, 0.3 + 0.7 * tone))
    for (let r = 0; r < rows; r++) {
      const fill = clamp(eighths - r * 8, 0, 8)
      out[rows - 1 - r]!.push({ ch: EIGHTHS[fill]!, color })
    }
  }
  return out
}

/** 活跃度：刚有动静为 1，约 9 秒衰减一半多，最低 0.22；工具在跑时至少 0.85。 */
const energyOf = (a: AgentActivity, now: number): number => {
  const e = 0.22 + 0.78 * Math.exp(-Math.max(0, now - a.lastActivity) / 9000)
  return a.currentTool !== null ? Math.max(e, 0.85) : e
}

/** 时长：0.3s / 12s / 1:42。 */
const span = (ms: number): string => {
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  return mmss(ms)
}

const touchAgent = (
  f: AgentActivity[] | null,
  id: string,
  change: (a: AgentActivity) => AgentActivity,
): AgentActivity[] => (f ?? []).map(a => (a.id === id ? change(a) : a))

const isToolSpawningAgent = (tool: string): boolean => tool === 'Agent' || tool === 'Task'

// ── 数据 ──────────────────────────────────────────────────────
const toLimit = (r: SessionRateLimit): Limit => ({
  kind: r.kind,
  percentUsed: r.percentUsed,
  resetsAt: r.resetsAt ?? null,
})

const toMeter = (u: {
  context: SessionContextUsage
  rateLimits: SessionRateLimit[]
  cost?: SessionCost
}): Meter => ({
  tokens: u.context.tokens ?? null,
  window: u.context.window,
  percent: u.context.percent ?? null,
  isEstimate: false,
  costUsd: u.cost?.usd ?? null,
  limits: u.rateLimits.map(toLimit),
})

/** 新读数没有上下文占用时（如刚压缩完、新会话）保留旧的，其余以新读数为准。 */
const mergeMeter = (old: Meter | null, fresh: Meter): Meter =>
  fresh.tokens === null && old && old.tokens !== null
    ? { ...fresh, tokens: old.tokens, percent: old.percent, isEstimate: old.isEstimate }
    : fresh

const emptyTotals = (since: number): Totals => ({
  since,
  turns: 0,
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  subagent: 0,
})

const isLightTheme = (value: unknown): boolean => typeof value === 'string' && value.startsWith('light')

const refreshBreakdown = async ($: EngineInterface, keepCompact: boolean): Promise<void> => {
  const bd = (await $.session.usage({ breakdown: 'summary' })).context.breakdown
  const next: Breakdown | null = bd
    ? {
        max: bd.rawMaxTokens,
        total: bd.totalTokens,
        rows: bd.categories
          .filter(c => c.kind !== 'deferred' && c.tokens > 0)
          .sort((a, b) => (a.kind === 'used' ? 0 : 1) - (b.kind === 'used' ? 0 : 1) || b.tokens - a.tokens)
          .map(c => ({ name: c.name, tokens: c.tokens, color: c.color, kind: c.kind })),
        autoCompactAt: bd.isAutoCompactEnabled ? (bd.autoCompactThreshold ?? null) : null,
      }
    : null
  await update($, breakdown, () => next)
  if (next && !keepCompact) await update($, compact, () => ({ at: next.autoCompactAt }))
}

/**
 * 还没有响应时（新会话、刚 --resume）用 /context 的本地估算先给出上下文占用，
 * 顺带记下自动压缩阈值；不发请求。
 */
const learnEstimate = async ($: EngineInterface): Promise<void> => {
  const bd = (await $.session.usage({ breakdown: 'summary' })).context.breakdown
  if (!bd) return
  await update($, compact, () => ({ at: bd.isAutoCompactEnabled ? (bd.autoCompactThreshold ?? null) : null }))
  await update($, meter, m => {
    if (!m || m.tokens !== null || m.window <= 0) return m
    const tokens = bd.totalTokens
    return { ...m, tokens, percent: Math.round((tokens / m.window) * 100), isEstimate: true }
  })
}

/** 越过阈值档时提醒；回落 10 个点以上重新武装。 */
const crossed = (pct: number, levels: number[], fired: number): { level: number; isNew: boolean } => {
  const top = levels.filter(l => pct >= l).reduce((a, b) => Math.max(a, b), 0)
  if (top > fired) return { level: top, isNew: true }
  if (pct < fired - 10) return { level: top, isNew: false }
  return { level: fired, isNew: false }
}

const checkAlerts = async ($: EngineInterface): Promise<void> => {
  const m = await read($, meter)
  if (!m) return
  const cp = await read($, compact)
  const fired = (await read($, alerts)) ?? {}
  const now = await $.clock.now()
  const next: Alerts = { ...fired }
  const messages: string[] = []
  if (m.percent !== null && !m.isEstimate) {
    const c = crossed(m.percent, CTX_LEVELS, fired.ctx ?? 0)
    next.ctx = c.level
    if (c.isNew) {
      const left = cp && cp.at !== null && m.tokens !== null ? ` · 距自动压缩 ${fmt(Math.max(0, cp.at - m.tokens))}` : ''
      messages.push(`⛁ 上下文 ${m.percent}%${left}`)
    }
  }
  for (const lim of m.limits) {
    const c = crossed(lim.percentUsed, LIMIT_LEVELS, fired[lim.kind] ?? 0)
    next[lim.kind] = c.level
    if (c.isNew) {
      const r = until(lim.resetsAt, now)
      messages.push(`${pie(lim.percentUsed)} ${limitLabel(lim.kind)} 额度 ${lim.percentUsed}%${r ? ` · ↻${r}` : ''}`)
    }
  }
  await update($, alerts, () => next)
  for (const text of messages) $.ui.toast(text)
}

/**
 * 一次模型请求完成（turn.step）：累计 token、上下文占用、费用与限额即时刷新，
 * 不等整轮对话结束。主对话的请求更新上下文占用；子代理的请求只计入子代理累计。
 */
const applyStep = async ($: EngineInterface, u: TurnUsage, agentId: string | undefined): Promise<void> => {
  const isSubagent = agentId !== undefined
  const su = await $.session.usage()
  const sum = u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
  // /clear 会把 startedAt 重置，此时累计清零
  await update($, totals, t => {
    const base = t && t.since === su.startedAt ? t : emptyTotals(su.startedAt)
    return isSubagent
      ? { ...base, subagent: base.subagent + sum }
      : {
          ...base,
          input: base.input + u.input_tokens,
          output: base.output + u.output_tokens,
          cacheRead: base.cacheRead + u.cache_read_input_tokens,
          cacheWrite: base.cacheWrite + u.cache_creation_input_tokens,
        }
  })
  await update($, meter, m => {
    const fresh = toMeter(su)
    if (isSubagent) return mergeMeter(m, { ...fresh, tokens: null })
    // 本次请求的输入侧 = 此刻上下文里有多少 token（与状态栏同一口径）
    const tokens = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
    const percent = fresh.window > 0 ? Math.round((tokens / fresh.window) * 100) : fresh.percent
    return { ...fresh, tokens, percent, isEstimate: false }
  })
  if (agentId !== undefined) {
    const now = await $.clock.now()
    await update($, fleet, f => touchAgent(f, agentId, a => ({ ...a, tokens: a.tokens + sum, lastActivity: now })))
  }
}

/** 压缩完成：占用立刻换成压缩后的大小，走势打标记，记下前后大小。 */
const applyCompaction = async (
  $: EngineInterface,
  before: number | null,
  after: number | null,
  trigger: string,
): Promise<{ before: number; after: number } | null> => {
  const m = await read($, meter)
  const b = before ?? m?.tokens ?? null
  if (b === null || after === null) return null
  const now = await $.clock.now()
  await update($, lastCompact, () => ({ before: b, after, at: now, trigger }))
  await update($, meter, cur =>
    cur && cur.window > 0
      ? { ...cur, tokens: after, percent: Math.round((after / cur.window) * 100), isEstimate: false }
      : cur,
  )
  await update($, history, h => {
    const base = h ?? emptyHistory()
    return { ...base, marks: [...(base.marks ?? []), base.ctx.length] }
  })
  return { before: b, after }
}

/** 每轮结束：用轮前轮后的额度差更新"每轮消耗"（指数平滑，窗口重置的那轮跳过）。 */
const applyBurn = async (
  $: EngineInterface,
  atStart: { kind: string; percentUsed: number }[],
  now: SessionRateLimit[],
): Promise<void> => {
  await update($, burn, b => {
    const out: Burn = { ...(b ?? {}) }
    for (const lim of now) {
      const start = atStart.find(x => x.kind === lim.kind)
      if (!start) continue
      const d = lim.percentUsed - start.percentUsed
      if (d < 0) continue
      const prev = out[lim.kind]
      out[lim.kind] = prev === undefined ? d : prev * 0.7 + d * 0.3
    }
    return out
  })
}

/**
 * 用引擎的子代理列表刷新侧栏：新出现的记下起始时刻和配色，结束的记下结束时刻，
 * 已结束的只留最近几个。返回运行中的个数和新出现的运行中 id。
 */
const refreshFleet = async ($: EngineInterface): Promise<{ running: number; fresh: string[] }> => {
  const list = await $.agent.list()
  const now = await $.clock.now()
  let running = 0
  let fresh: string[] = []
  const updated = await update($, fleet, f => {
    const cur = f ?? []
    const byId = new Map(cur.map(a => [a.id, a] as const))
    let hue = cur.reduce((m, a) => Math.max(m, a.hue + 1), 0)
    const out: AgentActivity[] = []
    fresh = []
    for (const info of list) {
      const isRunning = info.status === 'running'
      const label = info.name ?? info.description
      const prev = byId.get(info.id)
      if (prev) {
        byId.delete(info.id)
        out.push({
          ...prev,
          label: label || prev.label,
          type: info.type,
          status: info.status,
          parentId: info.parentId ?? null,
          endedAt: isRunning ? null : (prev.endedAt ?? now),
          currentTool: isRunning ? prev.currentTool : null,
        })
      } else {
        if (isRunning) fresh.push(info.id)
        out.push({
          id: info.id,
          label,
          type: info.type,
          status: info.status,
          parentId: info.parentId ?? null,
          hue: hue++,
          startedAt: now,
          endedAt: isRunning ? null : now,
          tools: 0,
          tokens: 0,
          currentTool: null,
          lastActivity: now,
        })
      }
    }
    // 引擎不再列出的：当作已结束保留
    for (const gone of byId.values()) {
      out.push(gone.endedAt === null ? { ...gone, status: 'completed', endedAt: now, currentTool: null } : gone)
    }
    const live = out.filter(a => a.endedAt === null)
    const done = out
      .filter(a => a.endedAt !== null)
      .sort((x, y) => (y.endedAt ?? 0) - (x.endedAt ?? 0))
      .slice(0, DONE_KEEP)
    running = live.length
    return [...live, ...done]
  })
  const live = (updated ?? []).filter(a => a.endedAt === null)
  await update($, agents, () => ({
    running: live.length,
    items: live.slice(0, 5).map(a => ({ id: a.id, label: a.label, type: a.type })),
  }))
  return { running, fresh }
}

const openPanel = async ($: EngineInterface): Promise<void> => {
  await update($, panel, p => ({ isOpen: true, dismissed: p?.dismissed ?? [], allDoneAt: null }))
  await $.ui.open({ id: PANEL_ID, title: PANEL_TITLE })
}

/** 收起侧栏；此刻已有的子代理记为"已收起"，它们之后不会再把侧栏弹出来。 */
const closePanel = async ($: EngineInterface): Promise<void> => {
  const ids = ((await read($, fleet)) ?? []).map(a => a.id)
  await update($, panel, p => ({
    isOpen: false,
    dismissed: [...new Set([...(p?.dismissed ?? []), ...ids])].slice(-200),
    allDoneAt: null,
  }))
  await $.ui.close({ id: PANEL_ID })
}

/** 列表刷新后：记下运行数；有新子代理且没被收起过时按设置自动弹出侧栏。 */
const onFleetChange = async ($: EngineInterface, r: { running: number; fresh: string[] }): Promise<void> => {
  rt.agentsRunning = r.running
  if (r.running > 0) rt.needsFrame = true
  if (rt.settings.agentPanel === 'manual' || r.fresh.length === 0) return
  const p = await read($, panel)
  if (p?.isOpen) return
  if (r.fresh.some(id => !(p?.dismissed ?? []).includes(id))) await openPanel($)
}

/** auto 模式：全部完成满 1 分钟自动收起。返回是否还在等。 */
const autoClose = async ($: EngineInterface): Promise<boolean> => {
  if (rt.settings.agentPanel !== 'auto' || rt.isDemo) return false
  const p = await read($, panel)
  if (!p?.isOpen) return false
  if (rt.agentsRunning > 0) {
    if (p.allDoneAt !== null) await update($, panel, cur => (cur ? { ...cur, allDoneAt: null } : cur))
    return false
  }
  const now = await $.clock.now()
  if (p.allDoneAt === null) {
    await update($, panel, cur => (cur ? { ...cur, allDoneAt: now } : cur))
    return true
  }
  if (now - p.allDoneAt >= AUTO_CLOSE_MS) {
    await closePanel($)
    return false
  }
  return true
}

// ── 跨重启：按会话 id 存快照，--resume 时读回 ────────────────────
const persist = async ($: EngineInterface): Promise<void> => {
  const sid = await $.session.id()
  const snap: Snapshot = {
    totals: await read($, totals),
    last: await read($, last),
    history: await read($, history),
    burn: await read($, burn),
    lastCompact: await read($, lastCompact),
  }
  await $.store.set(`session:${sid}`, snap)
  const index = ((await $.store.get(STORE_INDEX)) as string[] | undefined) ?? []
  const next = [...index.filter(x => x !== sid), sid]
  for (const old of next.slice(0, Math.max(0, next.length - STORE_KEEP))) await $.store.delete(`session:${old}`)
  await $.store.set(STORE_INDEX, next.slice(-STORE_KEEP))
}

const restore = async ($: EngineInterface, startedAt: number): Promise<void> => {
  // 热重载：进程内的状态还在，不用读
  if ((await read($, totals)) !== null) return
  const sid = await $.session.id()
  const snap = (await $.store.get(`session:${sid}`)) as Snapshot | undefined
  if (!snap || typeof snap !== 'object') return
  const t = snap.totals
  if (t) await update($, totals, () => ({ ...t, since: startedAt }))
  if (snap.last) await update($, last, () => snap.last)
  if (snap.history) await update($, history, () => ({ ...emptyHistory(), ...snap.history }))
  if (snap.burn) await update($, burn, () => snap.burn)
  if (snap.lastCompact) await update($, lastCompact, () => snap.lastCompact)
}

/** 推进一帧：帧号 +1，显示值向目标缓动（关动画时直接到位）；返回是否已静止。 */
const step = async ($: EngineInterface, isSmooth: boolean): Promise<boolean> => {
  const m = await read($, meter)
  const t = await read($, totals)
  const r = await read($, run)
  const targetCtx = m?.percent ?? 0
  const targetHit = totalsHit(t) ?? 0
  let isSettled = false
  await update($, anim, a => {
    const cur = a ?? { frame: 0, ctx: 0, hit: 0 }
    const ease = (from: number, to: number) =>
      !isSmooth || Math.abs(to - from) < 0.3 ? to : from + (to - from) * 0.28
    const ctx = ease(cur.ctx, targetCtx)
    const hit = ease(cur.hit, targetHit)
    isSettled = ctx === targetCtx && hit === targetHit
    return { frame: cur.frame + 1, ctx, hit }
  })
  return isSettled && r === null
}

const tickFrame = async ($: EngineInterface): Promise<void> => {
  if (!rt.needsFrame || rt.isStepping) return
  rt.isStepping = true
  try {
    rt.frameNo += 1
    if (rt.needsEstimate) {
      rt.needsEstimate = false
      await learnEstimate($)
    }
    const isIdle = await step($, isAnimated())
    // 子代理列表约每秒查一次；要停帧前再确认一次
    const every = isAnimated() ? 8 : 1
    if (!rt.isDemo && (isIdle || rt.frameNo % every === 0)) await onFleetChange($, await refreshFleet($))
    rt.closePending = await autoClose($)
    if (isIdle && rt.agentsRunning === 0 && !rt.closePending) rt.needsFrame = false
  } finally {
    rt.isStepping = false
  }
}

/** 只有有界面在看时才起计时器；claude -p 之类无界面运行不耗这份开销。 */
const startTimers = ($: EngineInterface): void => {
  if (rt.ticker) return
  rt.ticker = $.clock.every(isAnimated() ? FRAME_MS : SLOW_FRAME_MS, () => void tickFrame($))
  rt.slow = $.clock.every(60_000, () => void update($, minute, n => n + 1))
}

const seedDemo = async ($: EngineInterface, startedAt: number, isWorking: boolean, withAgents: boolean): Promise<void> => {
  const now = await $.clock.now()
  const iso = (ms: number) => new Date(now + ms).toISOString()
  await update($, meter, () => ({
    tokens: 92100,
    window: 200000,
    percent: 46,
    isEstimate: false,
    costUsd: 3.21,
    limits: [
      { kind: 'five_hour', percentUsed: 23, resetsAt: iso(3 * 3600e3 + 12 * 60e3) },
      { kind: 'seven_day', percentUsed: 84, resetsAt: iso(2 * 86400e3 + 14 * 3600e3) },
    ],
  }))
  await update($, compact, () => ({ at: 167000 }))
  await update($, totals, () => ({
    since: startedAt,
    turns: 18,
    input: 12300,
    output: 25000,
    cacheRead: 1104000,
    cacheWrite: 80000,
    subagent: 300000,
  }))
  await update($, last, () => ({ seconds: 42, tools: 7, model: 'claude-opus-5-5', hit: 95 }))
  await update($, history, () => ({
    ctx: [3, 5, 8, 10, 12, 14, 17, 19, 22, 24, 9, 11, 13, 16, 19, 22, 26, 29, 31, 35, 38, 41, 43, 46],
    hit: [0, 64, 81, 88, 90, 93, 86, 94, 95, 91, 31, 78, 89, 92, 96, 93, 95, 97, 91, 96, 94, 92, 96, 95],
    marks: [10],
  }))
  await update($, burn, () => ({ five_hour: 0.6, seven_day: 0.3 }))
  await update($, lastCompact, () => ({ before: 181000, after: 18500, at: now - 47 * 60e3, trigger: 'auto' }))
  await update($, agents, () => ({
    running: 2,
    items: [
      { id: 'a1', label: '核对训练日志', type: 'Explore' },
      { id: 'a2', label: '回填工作簿', type: 'general-purpose' },
    ],
  }))
  rt.agentsRunning = 0
  if (isWorking) await update($, run, () => ({ startedAt: now - 12000, tools: 3, limitsAtStart: [] }))
  if (!withAgents) return
  const agent = (
    id: string,
    type: string,
    label: string,
    hue: number,
    ago: number,
    rest: Partial<{ endedAt: number | null; status: string; tools: number; tokens: number; currentTool: string | null; idle: number }>,
  ) => ({
    id,
    label,
    type,
    status: rest.status ?? 'running',
    parentId: null,
    hue,
    startedAt: now - ago,
    endedAt: rest.endedAt ?? null,
    tools: rest.tools ?? 0,
    tokens: rest.tokens ?? 0,
    currentTool: rest.currentTool ?? null,
    lastActivity: now - (rest.idle ?? 0),
  })
  await update($, fleet, () => [
    agent('a1', 'Explore', '核对训练日志', 0, 102_000, { tools: 14, tokens: 31_000, currentTool: 'Grep', idle: 800 }),
    agent('a2', 'general-purpose', '回填工作簿', 1, 58_000, { tools: 9, tokens: 18_000, idle: 14_000 }),
    agent('a0', 'Explore', '搜索配置文件', 2, 300_000, { status: 'completed', endedAt: now - 269_000, tools: 6, tokens: 9_000 }),
  ])
  const ev = (seq: number, tool: string, owner: string | null, ago: number, took: number | null, isError = false) => ({
    seq,
    tool,
    owner,
    startedAt: now - ago,
    endedAt: took === null ? null : now - ago + took,
    isError,
  })
  await update($, toolLog, () => [
    ev(1, 'Agent', null, 105_000, null),
    ev(2, 'Read', 'a1', 60_000, 120),
    ev(3, 'Edit', null, 40_000, 300, true),
    ev(4, 'Bash', 'a2', 30_000, 2_400),
    ev(5, 'Read', 'a2', 15_000, 90),
    ev(6, 'Grep', 'a1', 800, null),
  ])
  await update($, toolCounts, () => ({ Read: 34, Bash: 12, Grep: 9, Edit: 7, Agent: 3, Write: 2 }))
  await update($, agents, () => ({
    running: 2,
    items: [
      { id: 'a1', label: '核对训练日志', type: 'Explore' },
      { id: 'a2', label: '回填工作簿', type: 'general-purpose' },
    ],
  }))
  rt.agentsRunning = 2
  await openPanel($)
}

export const register: Register = (on, options) => {
  rt.settings = readSettings(options)

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    rt.ticker?.cancel()
    rt.slow?.cancel()
    rt.ticker = null
    rt.slow = null
    const u = await $.session.usage()
    const rows = await $.config.list()
    const theme = rows.find(row => row.key === 'theme')
    const reduced = rows.find(row => /reducedmotion/i.test(row.key))
    rt.isReduced = reduced?.value === true
    await update($, isLight, () => isLightTheme(theme?.value))
    await update($, isReducedMotion, () => rt.isReduced)
    await update($, meter, m => mergeMeter(m, toMeter(u)))
    // 重载后不残留"生成中"
    await update($, run, () => null)
    // 仅供截图调样式：CONTEXT_METER_DEMO=1（静止）或 working（生成中）填示例数据，不发请求
    const demo = await $.env.get('CONTEXT_METER_DEMO')
    rt.isDemo = demo === '1' || demo === 'working' || demo === 'agents'
    if (rt.isDemo) await seedDemo($, u.startedAt, demo === 'working', demo === 'agents')
    else await restore($, u.startedAt)
    await $.command.register({ name: 'agent-panel', description: '打开 / 收起子代理侧栏' })
    // 开场动画：条和数字从 0 长到当前值
    await update($, anim, () => ({ frame: 0, ctx: 0, hit: 0 }))
    if (e.isInteractive || (await $.session.surfaces()).length > 0) {
      startTimers($)
      rt.needsEstimate = !rt.isDemo
      rt.needsFrame = true
    }
    return started
  })

  // 无界面启动、之后才有界面接上（桌面端等）：那时再起计时器
  on('session.attach', async ($, e, next) => {
    const done = await next(e)
    if (!rt.ticker) {
      startTimers($)
      rt.needsEstimate = !rt.isDemo
      rt.needsFrame = true
    }
    return done
  })

  on('session.end', async ($, e, next) => {
    rt.ticker?.cancel()
    rt.slow?.cancel()
    rt.ticker = null
    rt.slow = null
    return next(e)
  })

  on('command.run', { command: 'agent-panel' }, async $ => {
    if ((await read($, panel))?.isOpen) {
      await closePanel($)
      return { text: '已收起子代理侧栏' }
    }
    await openPanel($)
    return { text: '已打开子代理侧栏' }
  })

  // 有人用关闭键 / 关闭标记关掉侧栏：等同点"收起"
  on('ui.close', async ($, e, next) => {
    const done = await next(e)
    if (e.id === PANEL_ID && e.origin.kind === 'person') {
      const ids = ((await read($, fleet)) ?? []).map(a => a.id)
      await update($, panel, p => ({
        isOpen: false,
        dismissed: [...new Set([...(p?.dismissed ?? []), ...ids])].slice(-200),
        allDoneAt: null,
      }))
    }
    return done
  })

  on('config.set', async ($, e, next) => {
    const done = await next(e)
    if (e.key === 'theme') await update($, isLight, () => isLightTheme(e.value))
    if (/reducedmotion/i.test(e.key)) {
      rt.isReduced = e.value === true
      await update($, isReducedMotion, () => rt.isReduced)
    }
    return done
  })

  // 每轮主对话结束、限额跳动时由引擎推送
  on('session.measure', async ($, e, next) => {
    if (!rt.isDemo) {
      await update($, meter, m => mergeMeter(m, toMeter(e)))
      const pct = e.context.percent
      if (e.changed.includes('context') && pct !== undefined) {
        await update($, history, h => pushCtx(h, pct))
      }
      if (rt.settings.alerts) await checkAlerts($)
    }
    if (await read($, isExpanded)) await refreshBreakdown($, rt.isDemo)
    rt.needsFrame = true
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    const m = await read($, meter)
    const limitsAtStart = (m?.limits ?? []).map(l => ({ kind: l.kind, percentUsed: l.percentUsed }))
    await update($, run, () => ({ startedAt: now, tools: 0, limitsAtStart }))
    rt.needsFrame = true
    return next(e)
  })

  // 每次工具调用：只记工具名、属于谁、起止与成败（不记参数）；主对话调 Agent 时弹出侧栏
  on('tool.call', async ($, e, next) => {
    const owner = e.agentId ?? null
    const tool = String(e.tool)
    if (owner === null) await update($, run, r => (r ? { ...r, tools: r.tools + 1 } : r))
    if (rt.isDemo) return next(e)
    const seq = ++rt.toolSeq
    const now = await $.clock.now()
    await update($, toolLog, log =>
      [...(log ?? []), { seq, tool, owner, startedAt: now, endedAt: null, isError: false }].slice(-TOOL_LOG_MAX),
    )
    await update($, toolCounts, c => ({ ...(c ?? {}), [tool]: (c?.[tool] ?? 0) + 1 }))
    if (owner !== null) {
      if (!((await read($, fleet)) ?? []).some(a => a.id === owner)) await onFleetChange($, await refreshFleet($))
      await update($, fleet, f => touchAgent(f, owner, a => ({ ...a, tools: a.tools + 1, currentTool: tool, lastActivity: now })))
    } else if (isToolSpawningAgent(tool) && rt.settings.agentPanel !== 'manual' && !(await read($, panel))?.isOpen) {
      await openPanel($)
    }
    rt.needsFrame = true
    const res = await next(e)
    const end = await $.clock.now()
    const isError = res.deny !== undefined || res.isError === true
    await update($, toolLog, log => (log ?? []).map(x => (x.seq === seq ? { ...x, endedAt: end, isError } : x)))
    if (owner !== null) {
      await update($, fleet, f => touchAgent(f, owner, a => ({ ...a, currentTool: null, lastActivity: end })))
    } else if (isToolSpawningAgent(tool)) {
      await onFleetChange($, await refreshFleet($))
    }
    return res
  })

  // 每次模型请求一结束就刷新，一轮里调多次工具时数字会跟着走
  on('turn.step', async function* ($, e, next) {
    const res = yield* next(e)
    if (res.usage && !rt.isDemo) {
      await applyStep($, res.usage, e.agentId)
      if (rt.settings.alerts && e.agentId === undefined) await checkAlerts($)
      rt.needsFrame = true
    }
    return res
  })

  on('session.compact', async ($, e, next) => {
    const res = await next(e)
    const done = res as { skip?: string; tokensBefore?: number; tokensAfter?: number }
    if (e.agentId === undefined && e.trigger !== 'precompute' && done.skip === undefined && !rt.isDemo) {
      const c = await applyCompaction($, done.tokensBefore ?? null, done.tokensAfter ?? null, e.trigger)
      if (c && rt.settings.alerts) {
        $.ui.toast(`⛁ 已压缩 ${fmt(c.before)} → ${fmt(c.after)}`)
        await checkAlerts($)
      }
      await persist($)
      rt.needsFrame = true
    }
    return res
  })

  on('turn.complete', async ($, e, next) => {
    const isSubagent = e.agentId !== undefined
    if (isSubagent && !rt.isDemo) await onFleetChange($, await refreshFleet($))
    const r = isSubagent ? null : await read($, run)
    if (!isSubagent) await update($, run, () => null)
    const u = e.usage
    if (!isSubagent && !rt.isDemo) {
      // token 已在每次请求（turn.step）时累计，这里只记轮数、上一轮摘要与每轮额度消耗
      const su = await $.session.usage()
      await update($, totals, t => {
        const base = t && t.since === su.startedAt ? t : emptyTotals(su.startedAt)
        return { ...base, turns: base.turns + 1 }
      })
      if (r) await applyBurn($, r.limitsAtStart, su.rateLimits)
      await update($, meter, m => mergeMeter(m, toMeter(su)))
      if (u) {
        const hit = hitRate(u.cache_read_input_tokens, u.cache_creation_input_tokens, u.input_tokens)
        await update($, last, () => ({
          seconds: Math.round(e.durationMs / 1000),
          tools: r?.tools ?? 0,
          model: u.model,
          hit,
        }))
        if (hit !== null) await update($, history, h => pushHit(h, hit))
      }
      await persist($)
    }
    rt.needsFrame = true
    return next(e)
  })

  // ── 子代理侧栏：每个运行中的子代理一条流动波浪，下面是工具时间线（不含参数）
  on('ui.render', { component: 'Pane', requestId: PANEL_ID }, async ($, e) => {
    const fl = (await read($, fleet)) ?? []
    const log = (await read($, toolLog)) ?? []
    const counts = (await read($, toolCounts)) ?? {}
    const a = await read($, anim)
    const pal = (await read($, isLight)) ? LIGHT : DARK
    const isSmooth = rt.settings.animation && !(await read($, isReducedMotion))
    await read($, minute)
    const now = await $.clock.now()
    const { Box, Text, Button } = $.ui.resolve(e)
    const W = Math.max(20, e.props.bodyColumns)
    const isInline = e.props.placement === 'inline'
    const frame = a?.frame ?? 0
    const t = isSmooth ? frame * 0.32 : 0

    const hueOf = (i: number): Rgb => pal.hues[i % pal.hues.length]!
    const paint = (cells: Cell[]) =>
      runs(cells).map(c => (
        <Text color={c.color} dimColor={c.isDim} bold={c.isBold}>
          {c.ch}
        </Text>
      ))
    const byId = new Map(fl.map(x => [x.id, x] as const))
    const ownerOf = (id: string | null) => (id === null ? null : byId.get(id) ?? null)
    const statusIcon = (x: AgentActivity, i: number) =>
      x.endedAt === null
        ? isSmooth
          ? SPIN[(frame + i * 3) % SPIN.length]!
          : '✻'
        : x.status === 'failed'
          ? '✗'
          : x.status === 'killed'
            ? '■'
            : '✓'

    // 父子关系：子代理的子代理缩进挂在父下面
    const live = fl.filter(x => x.endedAt === null)
    const done = fl.filter(x => x.endedAt !== null)
    const depthOf = (x: AgentActivity): number => {
      let d = 0
      let cur = x.parentId ? byId.get(x.parentId) : undefined
      while (cur && d < 3) {
        d++
        cur = cur.parentId ? byId.get(cur.parentId) : undefined
      }
      return d
    }

    // 右上角留两格给引擎自己的关闭标记 ×，读起来是「收起 ×」
    const collapse = (
      <Box marginRight={2}>
        <Button key="collapse" plain dimColor label="收起" onPress={() => closePanel($)} />
      </Box>
    )

    // 一行一个子代理的紧凑版：面板没法停靠在旁边（不是全屏界面）时用
    if (isInline) {
      const waveW = clamp(W - 34, 8, 24)
      return (
        <Box flexDirection="column" width={W}>
          <Box flexDirection="row" justifyContent="space-between">
            <Text dimColor>{`${live.length} 运行 · ${done.length} 完成`}</Text>
            {collapse}
          </Box>
          {live.map((x, i) => {
            const hue = css(hueOf(x.hue))
            return (
              <Box flexDirection="row">
                <Text color={hue}>{`${statusIcon(x, i)} `}</Text>
                <Box width={16}>
                  <Text wrap="truncate" bold>
                    {x.type}
                  </Text>
                </Box>
                <Text>{paint(waveCells(pal, hueOf(x.hue), waveW, t, energyOf(x, now), x.hue * 1.7))}</Text>
                <Text dimColor>{`  ${mmss(now - x.startedAt)}  🔧 ${x.tools}`}</Text>
              </Box>
            )
          })}
        </Box>
      )
    }

    const waveW = W - 4
    const rows = e.viewport?.rows ?? 40
    // 先给子代理，剩下的行给工具时间线
    const agentRows = live.length * 6 + Math.min(done.length, 4) * 1 + 3
    const toolRows = clamp(rows - agentRows - 6, 3, 10)
    const shownLog = log.slice(-toolRows).reverse()
    const top = Object.entries(counts)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 6)

    return (
      <Box flexDirection="column" width={W}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text>
            {live.length > 0 ? <Text color={pal.accent} bold>{`${live.length} 运行`}</Text> : <Text dimColor>无运行中</Text>}
            <Text dimColor>{` · ${done.length} 完成`}</Text>
          </Text>
          {collapse}
        </Box>
        <Text dimColor>{'─'.repeat(W)}</Text>

        {live.length === 0 && done.length === 0 ? <Text dimColor>还没有调用子代理</Text> : null}

        {live.map((x, i) => {
          const hue = css(hueOf(x.hue))
          const pad = '  '.repeat(depthOf(x))
          const energy = energyOf(x, now)
          return (
            <Box key={`live-${x.id}`} flexDirection="column" marginBottom={1}>
              <Box flexDirection="row" justifyContent="space-between">
                <Text wrap="truncate">
                  {pad}
                  <Text color={hue} bold>{`${statusIcon(x, i)} `}</Text>
                  <Text bold>{x.type}</Text>
                </Text>
                <Text color={hue}>{mmss(now - x.startedAt)}</Text>
              </Box>
              <Text dimColor wrap="truncate">{`${pad}  ${x.label}`}</Text>
              {waveRows(pal, hueOf(x.hue), Math.max(8, waveW - pad.length), t, energy, x.hue * 1.7, 2).map(row => (
                <Text>
                  {`${pad}  `}
                  {paint(row)}
                </Text>
              ))}
              <Text wrap="truncate">
                <Text dimColor>{`${pad}  🔧 ${x.tools} · ${fmt(x.tokens)} · `}</Text>
                {x.currentTool !== null ? (
                  <Text color={hue}>{`▸ ${x.currentTool}`}</Text>
                ) : (
                  <Text dimColor>{now - x.lastActivity > 20_000 ? `静默 ${span(now - x.lastActivity)}` : '思考中'}</Text>
                )}
              </Text>
            </Box>
          )
        })}

        {done.slice(0, 4).map((x, i) => (
          <Box key={`done-${x.id}`} flexDirection="row" justifyContent="space-between">
            <Text wrap="truncate">
              <Text color={x.status === 'failed' ? pal.warn : css(hueOf(x.hue))}>{`${statusIcon(x, i)} `}</Text>
              <Text dimColor>{`${x.type} · ${x.label}`}</Text>
            </Text>
            <Text dimColor>{` ${mmss((x.endedAt ?? now) - x.startedAt)} · 🔧${x.tools}`}</Text>
          </Box>
        ))}

        {shownLog.length > 0 ? (
          <Text dimColor>{`── 工具 ${'─'.repeat(Math.max(2, W - 8))}`}</Text>
        ) : null}
        {shownLog.map(ev => {
          const owner = ownerOf(ev.owner)
          const isRunning = ev.endedAt === null
          const icon = isRunning ? (isSmooth ? SPIN[(frame + ev.seq) % SPIN.length]! : '✻') : ev.isError ? '✗' : '✓'
          const iconColor = isRunning ? pal.accent : ev.isError ? pal.warn : undefined
          return (
            <Box key={`tool-${ev.seq}`} flexDirection="row" justifyContent="space-between">
              <Text wrap="truncate">
                <Text color={iconColor} dimColor={!isRunning && !ev.isError}>{`${icon} `}</Text>
                <Text bold={isRunning}>{ev.tool.padEnd(9)}</Text>
                <Text color={owner ? css(hueOf(owner.hue)) : undefined} dimColor={!owner}>
                  {owner ? owner.type : ev.owner === null ? '主对话' : '子代理'}
                </Text>
              </Text>
              <Text dimColor={!isRunning} color={ev.isError ? pal.warn : undefined}>
                {` ${isRunning ? span(now - ev.startedAt) : ev.isError ? '失败' : span((ev.endedAt ?? now) - ev.startedAt)}`}
              </Text>
            </Box>
          )
        })}
        {top.length > 0 ? (
          <Text dimColor wrap="truncate">{top.map(([k, v]) => `${k} ${v}`).join(' · ')}</Text>
        ) : null}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const m = await read($, meter)
    const t = await read($, totals)
    const l = await read($, last)
    const r = await read($, run)
    const a = await read($, anim)
    const hist = await read($, history)
    const cp = await read($, compact)
    const bn = await read($, burn)
    const lc = await read($, lastCompact)
    const ag = await read($, agents)
    const isOpen = await read($, isExpanded)
    const bd = isOpen ? await read($, breakdown) : null
    const pal = (await read($, isLight)) ? LIGHT : DARK
    const isSmooth = rt.settings.animation && !(await read($, isReducedMotion))
    await read($, minute)
    const now = await $.clock.now()

    const heat = (pct: number) => css(rgbAt(pal, pct))
    // 命中率：冷色渐变（青 → 绿）；偏低的数字用提醒色
    const coolAt = (pct: number): Rgb => mix(pal.cool[0], pal.cool[1], clamp(pct, 0, 100) / 100)
    const good = (pct: number) => (pct < 50 ? pal.warn : css(coolAt(pct)))

    const { Box, Text, Button } = $.ui.resolve(e)
    const W = e.props.bodyColumns
    const isWorking = r !== null || e.props.isWorking
    const isCompactView =
      rt.settings.layout === 'compact' || (rt.settings.layout === 'auto' && !isWorking && !isOpen)
    const frame = a?.frame ?? 0
    const trendW = rt.settings.trend === 0 ? 0 : W >= 140 ? rt.settings.trend : Math.min(rt.settings.trend, W >= 110 ? 12 : 8)

    const paint = (cells: Cell[]) =>
      runs(cells).map(c => (
        <Text color={c.color} dimColor={c.isDim} bold={c.isBold}>
          {c.ch}
        </Text>
      ))

    // ── 共用读数
    const pct = m?.percent ?? null
    const tokens = m?.tokens ?? null
    const shownCtx = a?.ctx ?? pct ?? 0
    const approx = m?.isEstimate ? '≈' : ''
    const compactAt = cp?.at ?? null
    const hit = totalsHit(t)
    const shownHit = a?.hit ?? hit ?? 0
    const cum = t ? t.input + t.output + t.cacheRead + t.cacheWrite : 0
    const limits = m?.limits ?? []
    const spin = isSmooth ? SPIN[frame % SPIN.length] : '✻'

    // ── 标题 / 紧凑行左侧：状态 + 工具 + 后台
    const statusText = isWorking ? `${spin} 生成中 ${r ? mmss(now - r.startedAt) : ''}` : l ? `✓ ${l.seconds}s` : '◇ 就绪'
    const toolsNow = isWorking ? (r?.tools ?? 0) : (l?.tools ?? 0)
    const toolsText = toolsNow > 0 ? `  🔧 ${toolsNow}` : ''
    const fl = await read($, fleet)
    const runningN = (fl ?? []).filter(x => x.endedAt === null).length || (ag?.running ?? 0)
    const hasAgents = (fl?.length ?? 0) > 0 || runningN > 0
    const agentsLabel = `⚙ ${runningN}`
    // 按钮本身 + 后面一个空格
    const agentsW = hasAgents ? cellWidth(agentsLabel) + 1 : 0
    const agentsBtn = hasAgents ? (
      <Button
        key="agents"
        plain
        dimColor={runningN === 0}
        label={agentsLabel}
        onPress={async () => {
          if ((await read($, panel))?.isOpen) await closePanel($)
          else await openPanel($)
        }}
      />
    ) : null
    const left = ` ${statusText}${toolsText}${hasAgents ? ' ' : ''} `
    const leftColor = isWorking ? pal.accent : undefined

    const toggle = (
      <Button
        key="toggle"
        dimColor
        plain
        label={isOpen ? '▴' : '▾'}
        onPress={async () => {
          const isNowOpen = await update($, isExpanded, v => !v)
          if (isNowOpen) await refreshBreakdown($, rt.isDemo)
        }}
      />
    )

    // ── 明细（▾ 展开）：额度消耗、上次压缩、后台任务、/context 分类
    const detail = isOpen ? (
      <Box key="detail" flexDirection="column">
        {limits.map(lim => {
          const per = bn?.[lim.kind]
          const turnsLeft = per !== undefined && per >= 0.05 ? Math.floor((100 - lim.percentUsed) / per) : null
          const reset = until(lim.resetsAt, now)
          return (
            <Text wrap="truncate">
              {'  '}
              <Text color={heat(lim.percentUsed)}>{pie(lim.percentUsed)}</Text>
              <Text dimColor>{` ${limitLabel(lim.kind).padEnd(3)}`}</Text>
              <Text color={heat(lim.percentUsed)} bold>{`${lim.percentUsed}%`.padStart(4)}</Text>
              <Text dimColor>
                {per !== undefined ? ` · 每轮 +${per.toFixed(1)}%` : ''}
                {turnsLeft !== null ? ` · 约 ${turnsLeft} 轮用完` : ''}
                {reset ? ` · ${reset} 后重置` : ''}
              </Text>
            </Text>
          )
        })}
        {lc ? (
          <Text wrap="truncate">
            {'  '}
            <Text color={pal.accent}>↓</Text>
            <Text dimColor>{` 上次压缩 `}</Text>
            {`${fmt(lc.before)} → ${fmt(lc.after)}`}
            <Text dimColor>{` · ${ago(lc.at, now)} · ${lc.trigger === 'auto' ? '自动' : '手动'}`}</Text>
          </Text>
        ) : null}
        {(ag?.items ?? []).map(it => (
          <Text wrap="truncate">
            {'  '}
            <Text color={pal.accent}>⚙</Text>
            <Text dimColor>{` ${it.type} · `}</Text>
            {it.label}
          </Text>
        ))}
        <Text dimColor wrap="truncate">
          {`  ${'┄'.repeat(LABEL_WIDTH - 4)} ⛁ 分类明细`}
          {bd
            ? ` · 已用 ${fmt(bd.rows.filter(x => x.kind === 'used').reduce((s, x) => s + x.tokens, 0))} / ${fmt(bd.max)}` +
              (bd.autoCompactAt !== null ? ` · 阈值 ${fmt(bd.autoCompactAt)}` : '')
            : ''}
        </Text>
        {bd === null ? (
          <Text dimColor>{'  计算中…'}</Text>
        ) : (
          (() => {
            const usedRows = bd.rows.filter(x => x.kind === 'used')
            const used = usedRows.reduce((s, x) => s + x.tokens, 0)
            const barW = clamp(W - LABEL_WIDTH - 50, 10, 40)
            return usedRows.map(row => {
              const share = used > 0 ? (row.tokens / used) * 100 : 0
              const cells = clamp(Math.round((share / 100) * barW), 1, barW)
              return (
                <Box flexDirection="row">
                  <Box width={LABEL_WIDTH} />
                  <Text>
                    <Text color={row.color}>{'━'.repeat(cells)}</Text>
                    <Text dimColor>{'─'.repeat(barW - cells)}</Text>
                  </Text>
                  <Text bold>{`  ${fmt(row.tokens).padStart(6)}`}</Text>
                  <Text dimColor>{`  ${share.toFixed(0).padStart(3)}%  `}</Text>
                  <Box width={16}>
                    <Text wrap="truncate">{CATEGORY_LABEL[row.name] ?? row.name}</Text>
                  </Box>
                </Box>
              )
            })
          })()
        )}
      </Box>
    ) : null

    // ── 紧凑：一行
    if (isCompactView) {
      type Seg = { t: string; color?: string; isDim?: boolean; isBold?: boolean }
      const barW = 16
      const build = (level: number): Seg[] => {
        const segs: Seg[] = []
        segs.push({ t: ` ${approx}${pct === null ? '—' : `${Math.round(shownCtx)}%`}`, color: pct === null ? undefined : heat(shownCtx), isBold: true })
        if (hit !== null) {
          segs.push({ t: ' · ', isDim: true }, { t: '⚡' }, { t: ` ${Math.round(shownHit)}%`, color: good(shownHit), isBold: true })
        }
        if (level < 3) {
          for (const lim of limits) {
            const reset = level < 2 ? until(lim.resetsAt, now) : null
            segs.push(
              { t: ' · ', isDim: true },
              { t: pie(lim.percentUsed), color: heat(lim.percentUsed) },
              { t: ` ${limitLabel(lim.kind)} `, isDim: true },
              { t: `${lim.percentUsed}%`, color: heat(lim.percentUsed) },
            )
            if (reset) segs.push({ t: ` ↻${reset}`, isDim: true })
          }
        }
        if (level < 1 && t) segs.push({ t: ' · ', isDim: true }, { t: `Σ ${fmt(cum)}`, isDim: true })
        return segs
      }
      const widthOf = (segs: Seg[]) => segs.reduce((s, x) => s + cellWidth(x.t), 0)
      // 放得下就全给，放不下依次去掉：Σ → 重置倒计时 → 额度
      let segs = build(0)
      for (let level = 1; level <= 3 && W - 1 - cellWidth(left) - agentsW - (3 + barW + widthOf(segs)) - 8 < 3; level++) {
        segs = build(level)
      }
      const rule = Math.max(1, W - 1 - cellWidth(left) - agentsW - (3 + barW + widthOf(segs)) - 8)
      const marker =
        m && compactAt !== null && m.window > 0 ? clamp(Math.floor((compactAt / m.window) * barW), 0, barW - 1) : null
      const glint = isWorking && isSmooth ? (frame % (barW + 6)) - 3 : -1
      return (
        <Box flexDirection="column" width={W}>
          <Box flexDirection="row">
            <Text>
              <Text dimColor>─</Text>
              <Text color={leftColor} dimColor={!isWorking} bold={isWorking}>
                {left}
              </Text>
            </Text>
            {agentsBtn}
            <Text wrap="truncate">
              <Text dimColor>{(agentsBtn ? ' ' : '') + '─'.repeat(rule)}</Text>
              <Text dimColor>{' ⛁ '}</Text>
              {paint(barCells(pal, p => rgbAt(pal, p), shownCtx, barW, marker, glint))}
              {segs.map(s => (
                <Text color={s.color} dimColor={s.isDim} bold={s.isBold}>
                  {s.t}
                </Text>
              ))}
              {' '}
            </Text>
            {toggle}
            <Text dimColor>{' ────'}</Text>
          </Box>
          {detail}
        </Box>
      )
    }

    // ── 完整：标题线 + 三行
    const barW = clamp(W - LABEL_WIDTH - NUM_WIDTH - (trendW > 0 ? trendW + 3 : 0) - RIGHT_WIDTH - 2, 10, 56)
    const label = (icon: string, text: string) => (
      <Box width={LABEL_WIDTH}>
        <Text>
          {'  '}
          {icon}
          <Text dimColor>{` ${text}`}</Text>
        </Text>
      </Box>
    )
    const limitView = (lim: Limit | undefined) => {
      if (!lim) return null
      const reset = until(lim.resetsAt, now)
      return (
        <Text>
          <Text color={heat(lim.percentUsed)}>{pie(lim.percentUsed)}</Text>
          <Text dimColor>{` ${limitLabel(lim.kind).padEnd(3)}`}</Text>
          <Text color={heat(lim.percentUsed)}>{`${lim.percentUsed}%`.padStart(4)}</Text>
          <Text dimColor>{reset ? ` ↻${reset}` : ''}</Text>
        </Text>
      )
    }
    const metaParts = [
      t ? `Σ ${fmt(cum)}` : null,
      t ? `${t.turns} 轮` : null,
      m && m.costUsd !== null && m.costUsd > 0 ? `$${m.costUsd.toFixed(2)}` : null,
      l ? shortModel(l.model) : null,
    ].filter((x): x is string => x !== null)
    const meta = metaParts.length > 0 ? ` ${metaParts.join(' · ')} ` : ' '
    const rule = Math.max(2, W - 1 - cellWidth(left) - agentsW - cellWidth(meta) - 4)
    const marker =
      m && compactAt !== null && m.window > 0 ? clamp(Math.floor((compactAt / m.window) * barW), 0, barW - 1) : null
    const glint = isWorking && isSmooth ? (frame % (barW + 6)) - 3 : -1
    const ctxSeries = (hist?.ctx ?? []).slice(-Math.max(1, trendW))
    const ctxOffset = (hist?.ctx.length ?? 0) - ctxSeries.length
    const ctxMarks = (hist?.marks ?? []).map(i => i - ctxOffset).filter(i => i >= 0)

    return (
      <Box flexDirection="column" width={W}>
        <Box flexDirection="row">
          <Text>
            <Text dimColor>─</Text>
            <Text color={leftColor} dimColor={!isWorking} bold={isWorking}>
              {left}
            </Text>
          </Text>
          {agentsBtn}
          <Text wrap="truncate">
            <Text dimColor>{(agentsBtn ? ' ' : '') + '─'.repeat(rule)}</Text>
            <Text dimColor>{meta}</Text>
            <Text dimColor>{'────'}</Text>
          </Text>
        </Box>

        <Box key="fill" flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row">
            {label('⛁', '上下文')}
            <Text>{paint(barCells(pal, p => rgbAt(pal, p), shownCtx, barW, marker, glint))}</Text>
            <Box width={NUM_WIDTH}>
              {pct === null || tokens === null || !m ? (
                <Text dimColor>{'  等待首个响应'}</Text>
              ) : (
                <Text wrap="truncate">
                  {'  '}
                  <Text color={heat(shownCtx)} bold>
                    {`${approx}${Math.round(shownCtx)}%`.padStart(4)}
                  </Text>
                  <Text dimColor>{`  ${approx}${fmt(tokens)}/${fmt(m.window)}`}</Text>
                </Text>
              )}
            </Box>
            {trendW > 0 ? (
              <Text>
                {paint(
                  sparkCells(ctxSeries, trendW, heat, Math.max(25, ...ctxSeries), ctxMarks, pal.accent),
                )}
                <Text dimColor> ↗</Text>
              </Text>
            ) : null}
          </Box>
          <Box width={RIGHT_WIDTH} justifyContent="flex-end">
            {limitView(limits[0])}
          </Box>
        </Box>

        <Box key="cache" flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row">
            {label('⚡', '缓存')}
            <Text>{paint(barCells(pal, coolAt, shownHit, barW, null, -1))}</Text>
            <Box width={NUM_WIDTH}>
              {hit === null ? (
                <Text dimColor>{'  —'}</Text>
              ) : (
                <Text wrap="truncate">
                  {'  '}
                  <Text color={good(shownHit)} bold>
                    {`${Math.round(shownHit)}%`.padStart(4)}
                  </Text>
                  <Text dimColor>{'  命中'}</Text>
                  {l && l.hit !== null && l.hit !== undefined ? (
                    <Text dimColor>{` · 上轮 ${Math.round(l.hit)}%`}</Text>
                  ) : null}
                </Text>
              )}
            </Box>
            {trendW > 0 ? (
              <Text>
                {paint(sparkCells(hist?.hit ?? [], trendW, good, 100, [], pal.accent))}
                <Text dimColor> ↗</Text>
              </Text>
            ) : null}
          </Box>
          <Box width={RIGHT_WIDTH} justifyContent="flex-end" columnGap={1}>
            {limitView(limits[1])}
            {toggle}
          </Box>
        </Box>
        {detail}
      </Box>
    )
  })
}
