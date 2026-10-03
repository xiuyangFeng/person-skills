/** 一个额度窗口：five_hour / seven_day / spend_limit。 */
export type Limit = {
  kind: string
  percentUsed: number
  /** 重置时刻（ISO 8601）；不知道时为 null */
  resetsAt: string | null
}

/** 上下文窗口与账户状态的快照（来自 session.measure / $.session.usage / 每次请求）。 */
export type Meter = {
  /** 最近一次响应的输入侧 token（未缓存 + 缓存写 + 缓存读）；首个响应前为 null */
  tokens: number | null
  /** 当前模型的上下文窗口 */
  window: number
  /** tokens / window，整数百分比 */
  percent: number | null
  /** true：还没有响应，tokens/percent 是 /context 口径的本地估算 */
  isEstimate: boolean
  costUsd: number | null
  limits: Limit[]
}

/** 本会话累计 token（主对话 + 子代理分开记）。 */
export type Totals = {
  /** 会话起点（$.session.usage().startedAt）；/clear 后变化则清零 */
  since: number
  turns: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  /** 子代理各次请求的四项之和 */
  subagent: number
}

/** 上一轮主对话。 */
export type LastTurn = {
  seconds: number
  tools: number
  model: string
  /** 本轮缓存命中率 0–100；本轮没有输入时为 null */
  hit: number | null
}

/** 正在进行的主对话轮次：起始时刻、已调用工具数、开始时各额度的用量（算每轮消耗）。 */
export type Run = {
  startedAt: number
  tools: number
  limitsAtStart: { kind: string; percentUsed: number }[]
}

/** 动画帧：帧号驱动转圈与流光，ctx/hit 是向目标值缓动中的显示值。 */
export type Anim = { frame: number; ctx: number; hit: number }

/**
 * 每轮结束时的上下文占用与缓存命中率，最近若干轮，画迷你走势。
 * marks 是 ctx 里"压缩后第一个点"的下标。
 */
export type History = { ctx: number[]; hit: number[]; marks: number[] }

/** 每个额度窗口每轮平均消耗多少个百分点（指数平滑）。 */
export type Burn = Record<string, number>

/** 最近一次上下文压缩。 */
export type LastCompact = { before: number; after: number; at: number; trigger: string }

/** 正在运行的子代理 / 后台任务。 */
export type Agents = {
  running: number
  items: { id: string; label: string; type: string }[]
}

/** 侧栏里的一个子代理：引擎的列表信息 + 本插件从钩子里记下的活动。 */
export type AgentActivity = {
  id: string
  label: string
  type: string
  /** running / completed / failed / killed … */
  status: string
  parentId: string | null
  /** 颜色序号（波浪与标签用） */
  hue: number
  startedAt: number
  endedAt: number | null
  tools: number
  tokens: number
  /** 正在跑的工具名（不记参数）；没有为 null */
  currentTool: string | null
  lastActivity: number
}

/** 工具时间线上的一次调用：只记工具名、属于谁、起止与成败，不记参数。 */
export type ToolEvent = {
  seq: number
  tool: string
  /** 子代理 id；主对话为 null */
  owner: string | null
  startedAt: number
  endedAt: number | null
  isError: boolean
}

/** 侧栏开合：dismissed 是收起时已有的子代理，它们不会再把侧栏弹出来。 */
export type Panel = { isOpen: boolean; dismissed: string[]; allDoneAt: number | null }

/** 已提醒过的阈值：key（ctx 或额度种类）→ 已越过的最高档。 */
export type Alerts = Record<string, number>

export type CategoryRow = {
  name: string
  tokens: number
  /** /context 给这一类用的主题色键 */
  color: string
  /** used / free / buffer（deferred 不计入，已滤掉） */
  kind: string
}

/** 自动压缩阈值：null = 还没查过；at = null 表示自动压缩关闭。 */
export type Compact = { at: number | null }

/** 按 /context 口径的分类明细（summary 估算）。 */
export type Breakdown = {
  max: number
  total: number
  rows: CategoryRow[]
  autoCompactAt: number | null
}

/** 存进 $.store 的会话快照，重启 / --resume 时读回。 */
export type Snapshot = {
  totals: Totals | null
  last: LastTurn | null
  history: History | null
  burn: Burn | null
  lastCompact: LastCompact | null
}

declare module 'claude-code' {
  interface PluginState {
    'context-meter': {
      meter: Meter | null
      totals: Totals | null
      last: LastTurn | null
      run: Run | null
      anim: Anim | null
      history: History | null
      burn: Burn | null
      lastCompact: LastCompact | null
      agents: Agents | null
      fleet: AgentActivity[] | null
      toolLog: ToolEvent[] | null
      toolCounts: Record<string, number> | null
      panel: Panel | null
      alerts: Alerts | null
      /** 每分钟 +1，驱动重置倒计时重绘 */
      minute: number
      isExpanded: boolean
      breakdown: Breakdown | null
      compact: Compact | null
      /** /config 的 theme 是浅色系（light*）时为 true，换一套更深的配色 */
      isLight: boolean
      /** /config 里开了减少动画 */
      isReducedMotion: boolean
    }
  }
}
