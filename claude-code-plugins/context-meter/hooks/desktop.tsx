// 桌面端（以及 VS Code / 手机）的绘制。
//
// 这些界面用比例字体画 Text，终端那套按字符格子拼出来的横线、━ 进度条、补空格对齐都会走样：
// 线条忽长忽短、列对不齐、一行挤成两行。所以这里一个填充字符都不画——
// 间距交给 flex（Box 的宽度与间隔仍按格子算，桌面端会按代码字体换成像素），
// 进度条、走势、构成条与子代理波浪都用 Svg 画。
//
// 也不跟终端那样每 120ms 重画一帧：桌面端每次重画都会重排文字、换图片，看起来就是频闪。
// 这里画的东西只在数据真变了时才变；Svg 一律给定像素宽高、装进定宽的格子，换图时版面不跳；
// 要动的只有子代理波浪，交给 Svg 自己的 SMIL 动画，不靠重画。
import type { Elements, RenderElement, ThemeKey } from 'claude-code'

import { cellWidth, clamp } from './util'

type Els = Elements['desktop'] | Elements['vscode'] | Elements['mobile']

/** 一格约多少 CSS 像素：桌面端用代码字体的字宽折算 bodyColumns，13px 等宽字约 7.8。 */
const CELL_PX = 7.8
const px = (cells: number): number => Math.max(8, Math.round(cells * CELL_PX))
const n1 = (v: number): string => String(Math.round(v * 10) / 10)

// Svg 画成图片，跟不了界面的深浅主题，所以只用中间明度、两种底色上都看得清的颜色；
// 文字一律用主题色键，平时不上色，只在需要注意时用 warning / error
const TRACK = 'rgba(128,128,128,0.22)'
const TICK = 'rgba(128,128,128,0.85)'
export const TINT = {
  ctx: '#6e9fe0',
  hit: '#3fb8a8',
  limit: '#9a8fd8',
  warn: '#e3a33b',
  danger: '#e5604f',
  accent: '#d97757',
}

const CATEGORY_TINT: Record<string, string> = {
  'System prompt': '#8b95a7',
  'System tools': '#9a8fd8',
  'MCP tools': '#6e9fe0',
  'MCP server instructions': '#5fb6c9',
  'Custom agents': '#d78bb8',
  'Memory files': '#e08a5c',
  Skills: '#e3b341',
  'Slash commands': '#8cc06a',
  Messages: '#d97757',
}
const SPARE_TINTS = ['#6e9fe0', '#3fb8a8', '#e3b341', '#d78bb8', '#8cc06a', '#e08a5c']
export const categoryTint = (name: string, i: number): string => CATEGORY_TINT[name] ?? SPARE_TINTS[i % SPARE_TINTS.length]!

const AGENT_TINTS = ['#4ea3e0', '#9b87e8', '#e07bb0', '#3fb88f', '#e0a83a', '#e2677f']
export const agentTint = (hue: number): string => AGENT_TINTS[hue % AGENT_TINTS.length]!

/** 需要注意的程度：null 平常，warn 偏高，danger 很高。 */
export type Tone = 'warn' | 'danger' | null
const toneText = (t: Tone): ThemeKey | undefined => (t === 'danger' ? 'error' : t === 'warn' ? 'warning' : undefined)
const toneFill = (t: Tone, tint: string): string => (t === 'danger' ? TINT.danger : t === 'warn' ? TINT.warn : tint)

// ── Svg ───────────────────────────────────────────────────────
const svg = (w: number, ht: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${ht}" viewBox="0 0 ${w} ${ht}" preserveAspectRatio="none">${body}</svg>`

const BAR_H = 10

/** 圆头细条：底轨 + 填充，marker（0–100）处画一道竖线。 */
export const svgBar = (o: { w: number; fill: number; color: string; marker: number | null }): string => {
  const w = Math.max(16, Math.round(o.w))
  const y = 2
  const bh = 6
  // 按整百分比取宽：数值的小数变化不换图
  const pct = Math.round(clamp(o.fill, 0, 100))
  const fw = pct <= 0 ? 0 : Math.max(bh, (pct / 100) * w)
  const parts = [`<rect x="0" y="${y}" width="${w}" height="${bh}" rx="3" fill="${TRACK}"/>`]
  if (fw > 0) parts.push(`<rect x="0" y="${y}" width="${n1(fw)}" height="${bh}" rx="3" fill="${o.color}"/>`)
  if (o.marker !== null) {
    const x = clamp((o.marker / 100) * w, 1, w - 1)
    parts.push(`<rect x="${n1(x - 0.75)}" y="0" width="1.5" height="${BAR_H}" rx="0.75" fill="${TICK}"/>`)
  }
  return svg(w, BAR_H, parts.join(''))
}

const SPARK_W = 64
const SPARK_H = 14

/**
 * 迷你走势：最近 slots 轮按固定间距从右往左排（轮数少时只占右边一段），
 * 浅色面积 + 折线，最新一点加圆点；marks（压缩后第一轮）用强调色圆点。
 */
export const svgSpark = (o: { values: number[]; slots: number; max: number; marks: number[]; color: string }): string => {
  const w = SPARK_W
  const ht = SPARK_H
  const shown = o.values.slice(-o.slots)
  const offset = o.values.length - shown.length
  const step = (w - 4) / Math.max(1, o.slots - 1)
  const x0 = w - 2 - step * (shown.length - 1)
  const pts = shown.map((v, i) => [x0 + i * step, ht - 2 - clamp(v / o.max, 0, 1) * (ht - 4)] as const)
  const line = pts.map(([x, y]) => `${n1(x)},${n1(y)}`).join(' ')
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  const marks = o.marks
    .map(i => pts[i - offset])
    .filter((p): p is readonly [number, number] => p !== undefined)
    .map(([x, y]) => `<circle cx="${n1(x)}" cy="${n1(y)}" r="2" fill="${TINT.accent}"/>`)
    .join('')
  return svg(
    w,
    ht,
    `<path d="M${n1(first[0])},${ht} L${line.replace(/ /g, ' L')} L${n1(last[0])},${ht} Z" fill="${o.color}" fill-opacity="0.16"/>` +
      `<polyline points="${line}" fill="none" stroke="${o.color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>` +
      marks +
      `<circle cx="${n1(last[0])}" cy="${n1(last[1])}" r="2.2" fill="${o.color}"/>`,
  )
}

/** 构成条：各段按占比首尾相接，段间留 1px 缝，两头圆角。 */
export const svgStack = (o: { w: number; parts: { share: number; color: string }[] }): string => {
  const w = Math.max(16, Math.round(o.w))
  const ht = 8
  let x = 0
  const segs = o.parts.map(p => {
    const sw = (p.share / 100) * w
    const r = `<rect x="${n1(x)}" y="0" width="${n1(Math.max(0, sw - 1))}" height="${ht}" fill="${p.color}"/>`
    x += sw
    return r
  })
  return svg(
    w,
    ht,
    `<defs><clipPath id="r"><rect x="0" y="0" width="${w}" height="${ht}" rx="4"/></clipPath></defs>` +
      `<rect x="0" y="0" width="${w}" height="${ht}" rx="4" fill="${TRACK}"/><g clip-path="url(#r)">${segs.join('')}</g>`,
  )
}

// 子代理波浪：三段正弦叠加，频率都是基本周期的整数倍，所以平移一个周期后与原图重合，
// 用 SMIL 无缝循环平移；活跃度只改振幅。图形只在活跃度跨档、宽度或颜色变化时才重画，
// 重画时按墙钟时间接上相位，不会每次从头开始。
const WAVE_PERIOD = 160
const WAVE_DUR = 4
const waveCache = new Map<string, { sig: string; src: string }>()

export const waveSource = (o: {
  id: string
  w: number
  h: number
  color: string
  energy: number
  seed: number
  isAnimated: boolean
  nowMs: number
}): string => {
  const level = Math.round(clamp(o.energy, 0, 1) * 10) / 10
  const w = Math.max(16, Math.round(o.w))
  const sig = `${w}|${o.h}|${o.color}|${level}|${o.isAnimated}`
  const hit = waveCache.get(o.id)
  if (hit && hit.sig === sig) return hit.src
  const span = o.isAnimated ? w + WAVE_PERIOD : w
  const pts: string[] = []
  for (let x = 0; x <= span; x += 3) {
    const a = (2 * Math.PI * x) / WAVE_PERIOD
    const v = 0.55 * Math.sin(3 * a + o.seed) + 0.3 * Math.sin(a + o.seed * 2.1) + 0.15 * level * Math.sin(7 * a + o.seed * 0.7)
    const y = o.h - clamp(((v + 1) / 2) * level, 0.06, 1) * (o.h - 2)
    pts.push(`${x},${n1(y)}`)
  }
  const line = `M${pts.join(' L')}`
  const begin = -((o.nowMs / 1000) % WAVE_DUR)
  const motion = o.isAnimated
    ? `<animateTransform attributeName="transform" type="translate" from="0 0" to="${-WAVE_PERIOD} 0" dur="${WAVE_DUR}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite"/>`
    : ''
  const src = svg(
    w,
    o.h,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.color}" stop-opacity="0.5"/>` +
      `<stop offset="1" stop-color="${o.color}" stop-opacity="0.05"/></linearGradient></defs>` +
      `<g>${motion}<path d="${line} L${span},${o.h} L0,${o.h} Z" fill="url(#g)"/>` +
      `<path d="${line}" fill="none" stroke="${o.color}" stroke-width="1.5" stroke-linejoin="round"/></g>`,
  )
  // 只留最近的几十个，免得长会话里越积越多
  if (waveCache.size > 64) waveCache.delete(waveCache.keys().next().value!)
  waveCache.set(o.id, { sig, src })
  return src
}

// ── 提示框上方的仪表 ───────────────────────────────────────────
export type Tile = {
  key: string
  /** 卡片标题：上下文 / 缓存命中 / 5h 额度 */
  label: string
  /** 紧凑一行里的短名：上下文 / 缓存 / 5h */
  short: string
  value: string
  tone: Tone
  /** 条的填充 0–100（缓动中的显示值） */
  fill: number
  tint: string
  /** 阈值竖线 0–100 */
  marker: number | null
  /** 卡片第三行：92.1k / 200k、上轮 95%、3h 后重置 */
  caption: string
  /** 紧凑一行里跟在数值后的附注（↻3h），放不下时先去掉 */
  note: string | null
  trend: { values: number[]; slots: number; max: number; marks: number[] } | null
}

export type DetailView = {
  /** null：还在算 */
  breakdown: { summary: string; rows: { label: string; amount: string; share: number; tint: string }[] } | null
  burn: { label: string; per: string; left: string | null }[]
  lastCompact: string | null
  tasks: string[]
}

export type BandView = {
  width: number
  isWorking: boolean
  isCompact: boolean
  isOpen: boolean
  /** 状态字形（转圈）与文字分开：字形放进定宽格子，转动时后面的字不跟着晃 */
  status: { icon: string; text: string }
  tools: number
  /** 子代理按钮上的运行数；没有子代理时为 null，不画按钮 */
  agents: number | null
  /** 标题右侧：Σ、轮数、费用、模型 */
  meta: string[]
  /** 紧凑一行末尾的 Σ */
  total: string | null
  tiles: Tile[]
  detail: DetailView | null
}

export type BandActions = { toggle: () => unknown; agents: () => unknown }

const TILE_MIN = 20
const TILE_GAP = 3
const LABEL_W = 10

export const desktopBand = (el: Els, v: BandView, act: BandActions): RenderElement => {
  const { Box, Text, Button, Svg } = el
  const W = Math.max(24, v.width)

  const status = (
    <Box flexDirection="row" alignItems="center" columnGap={2} flexShrink={0}>
      <Box flexDirection="row">
        <Box width={2}>
          <Text color={v.isWorking ? 'claude' : undefined} dimColor={!v.isWorking}>
            {v.status.icon}
          </Text>
        </Box>
        <Text color={v.isWorking ? 'claude' : undefined} dimColor={!v.isWorking} bold={v.isWorking}>
          {v.status.text}
        </Text>
      </Box>
      {v.tools > 0 ? <Text dimColor>{`🔧 ${v.tools}`}</Text> : null}
      {v.agents !== null ? (
        <Button key="agents" plain dimColor={v.agents === 0} label={`⚙ ${v.agents}`} onPress={act.agents} />
      ) : null}
    </Box>
  )
  const toggle = <Button key="toggle" plain dimColor label={v.isOpen ? '收起 ▴' : '明细 ▾'} onPress={act.toggle} />

  // ── 紧凑：一行
  if (v.isCompact) {
    const [ctx, ...rest] = v.tiles
    if (!ctx) return <Box width={W}>{status}</Box>
    const leftW = cellWidth(v.status.text) + 4 + (v.tools > 0 ? 7 : 0) + (v.agents !== null ? 6 : 0)
    const budget = W - leftW - 8 - 9
    // 放不下就依次去掉：Σ → 重置倒计时 → 额度
    const pick = (level: number) => {
      const out: { key: string; label: string; value: string; tone: Tone; note: string | null }[] = []
      for (const t of rest) {
        if (level >= 3 && t.key.startsWith('limit')) continue
        out.push({ key: t.key, label: t.short, value: t.value, tone: t.tone, note: level >= 2 ? null : t.note })
      }
      if (level < 1 && v.total !== null) out.push({ key: 'total', label: 'Σ', value: v.total, tone: null, note: null })
      return out
    }
    const widthOf = (xs: ReturnType<typeof pick>) =>
      xs.reduce((s, x) => s + cellWidth(`${x.label} ${x.value}${x.note ? ` ${x.note}` : ''}`) + 2, cellWidth(ctx.value) + 2)
    let level = 0
    while (level < 3 && widthOf(pick(level)) > budget) level++
    const items = pick(level)
    return (
      <Box flexDirection="column" width={W}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" columnGap={2}>
          {status}
          <Box flexDirection="row" alignItems="center" columnGap={2} flexShrink={1}>
            <Box flexDirection="row" alignItems="center" columnGap={1}>
              <Svg
                source={svgBar({ w: 56, fill: ctx.fill, color: toneFill(ctx.tone, ctx.tint), marker: ctx.marker })}
                alt={`上下文 ${ctx.value}`}
                width={56}
                height={BAR_H}
              />
              <Text bold color={toneText(ctx.tone)}>
                {ctx.value}
              </Text>
            </Box>
            {items.map(x => (
              <Text wrap="truncate">
                <Text dimColor>{`${x.label} `}</Text>
                <Text bold={x.key !== 'total'} dimColor={x.key === 'total'} color={toneText(x.tone)}>
                  {x.value}
                </Text>
                {x.note ? <Text dimColor>{` ${x.note}`}</Text> : null}
              </Text>
            ))}
            {toggle}
          </Box>
        </Box>
        {v.detail ? detailView(el, v.detail, W) : null}
      </Box>
    )
  }

  // ── 完整：标题行 + 一排卡片（窄了折成两排）
  const n = v.tiles.length
  let perRow = clamp(Math.floor((W + TILE_GAP) / (TILE_MIN + TILE_GAP)), 1, Math.max(1, n))
  perRow = Math.ceil(n / Math.ceil(n / perRow))
  const tileW = Math.floor((W - TILE_GAP * (perRow - 1)) / perRow)
  const rows: Tile[][] = []
  for (let i = 0; i < n; i += perRow) rows.push(v.tiles.slice(i, i + perRow))

  const tile = (t: Tile) => {
    const hasSpark = t.trend !== null && t.trend.values.length >= 2 && tileW - cellWidth(t.caption) >= 11
    return (
      <Box key={`tile-${t.key}`} flexDirection="column" width={tileW} flexShrink={0}>
        <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
          <Text dimColor wrap="truncate">
            {t.label}
          </Text>
          <Text bold color={toneText(t.tone)}>
            {t.value}
          </Text>
        </Box>
        <Box width={tileW} overflow="hidden">
          <Svg
            source={svgBar({ w: px(tileW), fill: t.fill, color: toneFill(t.tone, t.tint), marker: t.marker })}
            alt={`${t.label} ${t.value}`}
            width={px(tileW)}
            height={BAR_H}
          />
        </Box>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" columnGap={1}>
          <Text dimColor wrap="truncate">
            {t.caption || ' '}
          </Text>
          {hasSpark && t.trend ? (
            <Svg
              source={svgSpark({ ...t.trend, color: toneFill(t.tone, t.tint) })}
              alt={`${t.label}走势`}
              width={SPARK_W}
              height={SPARK_H}
            />
          ) : null}
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" width={W}>
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" columnGap={2} marginBottom={1}>
        {status}
        <Box flexDirection="row" alignItems="center" columnGap={2} flexShrink={1}>
          {v.meta.length > 0 ? (
            <Text dimColor wrap="truncate">
              {v.meta.join(' · ')}
            </Text>
          ) : null}
          {toggle}
        </Box>
      </Box>
      {rows.map((row, i) => (
        <Box key={`row-${i}`} flexDirection="row" columnGap={TILE_GAP} marginTop={i === 0 ? 0 : 1}>
          {row.map(tile)}
        </Box>
      ))}
      {v.detail ? detailView(el, v.detail, W) : null}
    </Box>
  )
}

/** ▾ 展开的明细：上下文构成（一根构成条 + 图例）、额度消耗、上次压缩、后台任务。 */
const detailView = (el: Els, d: DetailView, W: number): RenderElement => {
  const { Box, Text, Svg } = el
  const line = (key: string, label: string, body: RenderElement) => (
    <Box key={key} flexDirection="row" columnGap={1}>
      <Box width={LABEL_W} flexShrink={0}>
        <Text dimColor>{label}</Text>
      </Box>
      {body}
    </Box>
  )

  // 图例按宽度分行，不靠自动换行
  const legend: NonNullable<DetailView['breakdown']>['rows'][] = []
  if (d.breakdown) {
    let cur: NonNullable<DetailView['breakdown']>['rows'] = []
    let used = 0
    for (const r of d.breakdown.rows) {
      const w = cellWidth(`● ${r.label} ${r.amount} ${Math.round(r.share)}%`) + 3
      if (cur.length > 0 && used + w > W) {
        legend.push(cur)
        cur = []
        used = 0
      }
      cur.push(r)
      used += w
    }
    if (cur.length > 0) legend.push(cur)
  }

  return (
    <Box key="detail" flexDirection="column" width={W} marginTop={1}>
      <Box flexDirection="row" justifyContent="space-between" columnGap={2}>
        <Text dimColor>上下文构成</Text>
        <Text dimColor wrap="truncate">
          {d.breakdown ? d.breakdown.summary : '计算中…'}
        </Text>
      </Box>
      {d.breakdown ? (
        <Box width={W} overflow="hidden">
          <Svg
            source={svgStack({ w: px(W), parts: d.breakdown.rows.map(r => ({ share: r.share, color: r.tint })) })}
            alt={d.breakdown.rows.map(r => `${r.label} ${Math.round(r.share)}%`).join('，')}
            width={px(W)}
            height={8}
          />
        </Box>
      ) : null}
      {legend.map((row, i) => (
        <Box key={`legend-${i}`} flexDirection="row" columnGap={3}>
          {row.map(r => (
            <Text>
              <Text color={r.tint}>●</Text>
              {` ${r.label} `}
              <Text bold>{r.amount}</Text>
              <Text dimColor>{` ${Math.round(r.share)}%`}</Text>
            </Text>
          ))}
        </Box>
      ))}
      {d.burn.length > 0 || d.lastCompact || d.tasks.length > 0 ? <Box height={1} /> : null}
      {d.burn.length > 0
        ? line(
            'burn',
            '额度消耗',
            <Box flexDirection="row" columnGap={3} flexShrink={1}>
              {d.burn.map(b => (
                <Text wrap="truncate">
                  {`${b.label} `}
                  <Text dimColor>每轮 </Text>
                  {b.per}
                  {b.left ? <Text dimColor>{` · ${b.left}`}</Text> : null}
                </Text>
              ))}
            </Box>,
          )
        : null}
      {d.lastCompact
        ? line(
            'compact',
            '上次压缩',
            <Text wrap="truncate">{d.lastCompact}</Text>,
          )
        : null}
      {d.tasks.length > 0
        ? line(
            'tasks',
            '后台',
            <Text wrap="truncate">{d.tasks.join(' · ')}</Text>,
          )
        : null}
    </Box>
  )
}

// ── 子代理侧栏 ─────────────────────────────────────────────────
export type PaneAgent = {
  id: string
  type: string
  label: string
  icon: string
  tint: string
  elapsed: string
  depth: number
  energy: number
  seed: number
  /** 🔧 14 · 31k */
  stats: string
  /** ▸ Grep（工具在跑）/ 思考中 / 静默 32s */
  activity: string
  isToolRunning: boolean
  tools: number
}

export type PaneFinished = { id: string; icon: string; tint: string; isFailed: boolean; text: string; tail: string }

export type PaneTool = {
  seq: number
  icon: string
  isRunning: boolean
  isError: boolean
  tool: string
  owner: string
  ownerTint: string | null
  time: string
}

export type PaneView = {
  width: number
  isInline: boolean
  isAnimated: boolean
  now: number
  running: number
  done: number
  agents: PaneAgent[]
  finished: PaneFinished[]
  tools: PaneTool[]
  counts: string | null
}

export const desktopPane = (el: Els, v: PaneView, act: { collapse: () => unknown }): RenderElement => {
  const { Box, Text, Button, Svg } = el
  const W = Math.max(20, v.width)
  const head = (
    <Box flexDirection="row" justifyContent="space-between" alignItems="center">
      <Text>
        {v.running > 0 ? (
          <Text color="claude" bold>{`${v.running} 运行`}</Text>
        ) : (
          <Text dimColor>无运行中</Text>
        )}
        <Text dimColor>{` · ${v.done} 完成`}</Text>
      </Text>
      <Button key="collapse" plain dimColor label="收起" onPress={act.collapse} />
    </Box>
  )
  // 波浪的源码只在活跃度跨档时才换（waveSource 有缓存），alt 也跟着档位走，不每次都变
  const wave = (a: PaneAgent, cells: number, height: number) => (
    <Box width={cells} overflow="hidden" flexShrink={0}>
      <Svg
        source={waveSource({ id: a.id, w: px(cells), h: height, color: a.tint, energy: a.energy, seed: a.seed, isAnimated: v.isAnimated, nowMs: v.now })}
        alt={`${a.type} 活跃度 ${Math.round(a.energy * 10) * 10}%`}
        width={px(cells)}
        height={height}
      />
    </Box>
  )

  // 不停靠时（面板落在提示框上方）一行一个子代理
  if (v.isInline) {
    const waveCells = clamp(W - 34, 8, 24)
    return (
      <Box flexDirection="column" width={W}>
        {head}
        {v.agents.map(a => (
          <Box key={`live-${a.id}`} flexDirection="row" alignItems="center" columnGap={1}>
            <Box width={2}>
              <Text color={a.tint}>{a.icon}</Text>
            </Box>
            <Box width={16}>
              <Text wrap="truncate" bold>
                {a.type}
              </Text>
            </Box>
            {wave(a, waveCells, 14)}
            <Text dimColor>{`${a.elapsed} · 🔧 ${a.tools}`}</Text>
          </Box>
        ))}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" width={W}>
      {head}
      {v.agents.length === 0 && v.finished.length === 0 ? (
        <Box marginTop={1}>
          <Text dimColor>还没有调用子代理</Text>
        </Box>
      ) : null}

      {v.agents.map(a => (
        <Box key={`live-${a.id}`} flexDirection="column" marginTop={1} marginLeft={a.depth * 2}>
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Box flexDirection="row" flexShrink={1}>
              <Box width={2} flexShrink={0}>
                <Text color={a.tint} bold>
                  {a.icon}
                </Text>
              </Box>
              <Text bold wrap="truncate">
                {a.type}
              </Text>
            </Box>
            <Text color={a.tint}>{a.elapsed}</Text>
          </Box>
          <Text dimColor wrap="truncate">
            {a.label}
          </Text>
          {wave(a, W - a.depth * 2, 26)}
          <Text wrap="truncate">
            <Text dimColor>{`${a.stats} · `}</Text>
            {a.isToolRunning ? <Text color={a.tint}>{a.activity}</Text> : <Text dimColor>{a.activity}</Text>}
          </Text>
        </Box>
      ))}

      {v.finished.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          {v.finished.map(x => (
            <Box key={`done-${x.id}`} flexDirection="row" justifyContent="space-between" columnGap={1}>
              <Box flexDirection="row" flexShrink={1}>
                <Box width={2} flexShrink={0}>
                  <Text color={x.isFailed ? 'warning' : x.tint}>{x.icon}</Text>
                </Box>
                <Text dimColor wrap="truncate">
                  {x.text}
                </Text>
              </Box>
              <Text dimColor>{x.tail}</Text>
            </Box>
          ))}
        </Box>
      ) : null}

      {v.tools.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor bold>
            工具
          </Text>
          {v.tools.map(t => (
            <Box key={`tool-${t.seq}`} flexDirection="row" justifyContent="space-between" columnGap={1}>
              <Box flexDirection="row" flexShrink={1}>
                <Box width={2} flexShrink={0}>
                  <Text color={t.isRunning ? 'claude' : t.isError ? 'warning' : undefined} dimColor={!t.isRunning && !t.isError}>
                    {t.icon}
                  </Text>
                </Box>
                <Box width={10} flexShrink={0}>
                  <Text bold={t.isRunning} wrap="truncate">
                    {t.tool}
                  </Text>
                </Box>
                <Text color={t.ownerTint ?? undefined} dimColor={t.ownerTint === null} wrap="truncate">
                  {t.owner}
                </Text>
              </Box>
              <Text dimColor={!t.isRunning} color={t.isError ? 'warning' : undefined}>
                {t.time}
              </Text>
            </Box>
          ))}
          {v.counts ? (
            <Text dimColor wrap="truncate">
              {v.counts}
            </Text>
          ) : null}
        </Box>
      ) : null}
    </Box>
  )
}
