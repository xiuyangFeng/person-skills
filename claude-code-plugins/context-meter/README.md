# context-meter

Claude Code 提示框上方的会话仪表（function hooks 插件，early access 接口）。

安装：

```bash
git clone https://github.com/xiuyangFeng/person-skills.git ~/person-skills
ln -s ~/person-skills/claude-code-plugins/context-meter ~/.claude/skills/context-meter   # 或 cp -r 一份
```

重开 Claude Code 即可。之后 `git pull` 更新，跑 `./selfcheck.sh --live` 自检。

## 看到什么

空闲时一行（`auto` 布局）：

```
─ ✓ 42s  🔧 7  ⚙ 2 ──────────── ⛁ ━━━━━━━╸──────┃─ 46% · ⚡ 92% · ◔ 5h 23% ↻3h · ◕ 7d 84% ↻2d14h · Σ 1.22M ▾ ────[-]
```

生成中三行：

```
─ ✻ 生成中 0:23  🔧 3 ──────────────────────────────── Σ 1.22M · 18 轮 · $3.21 · opus-5-5 ────[-]
  ⛁ 上下文 ━━━━━━━━━━━━━━━━━━━━━╸──────────┃────   46%  92.1k/200k   ▁▂▂▃▃▃▄▄▄▅▂▃▃ ↗   ◔ 5h  23% ↻3h
  ⚡ 缓存  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╸──   92%  命中 · 上轮 95%  ▁▅▇▇▇█▇██ ↗   ◕ 7d  84% ↻2d14h ▾
```

| 元素 | 含义 |
|---|---|
| ✻ 生成中 0:23 / ✓ 42s / ◇ 就绪 | 正在生成（实时计时）/ 上一轮耗时 / 还没对话 |
| 🔧 n | 本轮（或上一轮）工具调用次数 |
| ⚙ n | 正在运行的子代理 / 后台任务数，▾ 明细里列出 |
| ⛁ 条 | 上下文占用，绿→红渐变；┃ 是自动压缩阈值；生成中有流光扫过；`≈` 表示还没有响应、是本地估算 |
| ⚡ 条 | 本会话缓存命中率（缓存读 ÷ 全部输入），青→绿，低于 50% 变琥珀色 |
| 走势 | 最近 24 轮；上下文按近期最大值放大起伏，压缩后的第一轮用强调色加粗 |
| ◔ 5h 23% ↻3h | 额度窗口：饼图标 + 用量 + 距重置 |
| Σ | 本会话累计 token（主对话；子代理另计，见 ▾ 明细） |
| ▾ | 展开明细：每轮额度消耗与预计还能用几轮、上次压缩、后台任务列表、/context 分类 |

提醒（toast）：上下文越过 70% / 85%、额度越过 90% / 95%、发生压缩时各提醒一次；回落 10 个点以上重新武装。

## 配置（/config 里的 context-meter 几行）

| 选项 | 值 | 默认 |
|---|---|---|
| 仪表布局 `layout` | `auto` 空闲一行、生成中三行 · `full` 始终三行 · `compact` 始终一行 | `auto` |
| 动画 `animation` | 转圈、流光、数值缓动；/config 开了减少动画时自动关 | 开 |
| 走势长度 `trend` | `24` / `12` / `off` | `24` |
| 阈值提醒 `alerts` | 上面那些 toast | 开 |

## 数据从哪来

- 每次模型请求结束（`turn.step`）：累计 token、上下文占用（这次请求的输入侧 = 此刻上下文大小）、费用与额度。一轮里连续调工具时数字跟着走。
- 每轮结束（`turn.complete`）：轮数、上一轮耗时 / 工具数 / 命中率、每轮额度消耗（轮前轮后差的指数平滑）。
- `session.measure`：每轮一次，额度跳动时也会推；走势里的上下文点从这里来。
- `session.compact`：压缩前后大小，立即把占用换成压缩后的值。
- 后台任务：`$.agent.list()`，有任务在跑时约 2 秒查一次。
- 新会话 / 刚 `--resume` 还没有响应时：用 `/context` 口径本地估算占用（不发请求）。
- 跨重启：每轮结束按会话 id 存快照到 `$.store`（保留最近 40 个会话），`--resume` 时读回累计、走势、上一轮、每轮消耗、上次压缩。

## 文件

```
.claude-plugin/plugin.json   清单 + userConfig
hooks/hooks.json             指向 register.tsx
hooks/register.tsx           全部逻辑与绘制
types/index.d.ts             $.state 合同与快照类型
tests/meter.test.ts          claude plugin test 用例
selfcheck.sh                 自检
TESTED_WITH                  上次自检通过的 Claude Code 版本
```

## 加载、开发、停用

- 放在（或软链到）`~/.claude/skills/context-meter/`，每个会话启动时自动加载；交互会话监视这个目录，保存即重载。
- **不要**用 `~/.claude/settings.json` 的 `env.CLAUDE_CODE_PLUGIN_DIRS`：那个文件会被重写（旧会话退出时写回缓存副本、orca 装 hooks），那一行会丢。
- 改代码最好先在别处的副本里改完、测完再整体拷回来，避免改到一半被正在用的会话重载。
- 看实际效果：`CONTEXT_METER_DEMO=1 claude`（静止示例）或 `CONTEXT_METER_DEMO=working claude`（生成中示例），只填示例数据，不发请求。
- Claude Code 升级后跑 `./selfcheck.sh`（加 `--live` 会另起一个会话截屏确认）。
- 停用：把目录移出 `~/.claude/skills/`，重开会话。

## 写这类插件踩过的坑

- `$` 不能赋给变量，只能在调用处写 `$.noun.method(...)` 或传给**文件顶层**声明的函数。
- 局部变量别叫 `h`：会遮住 JSX 工厂，报 `h is not a function`。
- 渲染钩子里不能写状态；写只能在事件钩子、按钮回调、计时器里。
- 流式事件（`turn.step`）的钩子必须是 `async function*`，`yield* next(e)` 拿结果。
- 测试里 `on` 注册的是"引擎底部"：用到的事件都要给替身；op（`session.usage`、`store.get`、`clock.now`…）的替身返回 `{ value }`。
- 压缩事件的 `messages` 不能为空。

## 变更记录

- 0.3.0（2026-10-02）：空闲一行 / 生成中三行；额度重置倒计时与每轮消耗；压缩提示与走势标记；阈值提醒；子代理 / 后台任务数；重启后恢复；未响应前估算占用；/config 选项（布局、动画、走势、提醒）与减少动画；无界面运行不起计时器；README、自检脚本、git。
- 0.2（2026-10-02）：逐次请求实时刷新（`turn.step`）；全局放到 `~/.claude/skills/`。
- 0.1（2026-10-01）：动态三行版：转圈、流光、缓动、走势、缓存命中、饼图标额度、分类明细、浅色主题。
