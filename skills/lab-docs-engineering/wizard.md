# 配置向导（安装 / 首次使用 / 重新配置）

目标：在**目标仓库**生成 `.cursor/skills/lab-docs-engineering/PROJECT_PROFILE.md`。

## 何时运行

- 工作区无 `PROJECT_PROFILE.md`（任何业务动作前自动进入）
- 用户说：「初始化实验记录」「配置本仓库文档规范」「重新配置」

## 选模式（默认 A）

```
仓库已有 docs / 文档结构？
├─ 有，且有推进记录/规范目录  → A 自动推断（默认，最省事）
├─ 没有，或几乎空仓库          → B 从零 scaffold（先建最小骨架，再生成 profile）
└─ 用户要逐项手填 / 结构很特殊 → C 完整问卷（Q1–Q10）
```

三种模式最终都产出同一份 profile（YAML 结构见文末）。**关键原则**：能从仓库探测到的就别问用户；只把探测不到、或有歧义的项抛给用户确认。

---

## 模式 A · 自动推断（默认）

**第 1 步：扫描仓库**，用下面的探测规则填草稿（探测到就填，多个候选就都列出让用户选主）：

| profile 键 | 探测方式（示例，按仓库调整） |
| --- | --- |
| `docs_root` | 存在 `docs/` 即取之；否则取放 md 最多的顶层目录 |
| `norms_dir` | 找名字含「规范/norm/convention/spec」的目录；或 `docs/00-*`、`docs/规范*` |
| `progress_logs` | 找文件名含「推进记录 / 变更 / changelog / progress / 实验日志 / dev-log」的 md；每个候选记为一条 route |
| `routes` | 从 `progress_logs` 与目录名（任务/route/线/task/exp）归纳；探测不到则单条 `main` |
| `artifacts.index` | 找 `**/experiment_index.csv`、`**/runs.csv`、`outputs/**` 汇总表 |
| `artifacts.run_glob` | `outputs/**`、`runs/**`、`experiments/**`、`logs/**` 中存在者 |
| `artifacts.summary_files` | 在某个 run 目录里实际出现的 `summary.json`/`history.csv`/`metrics.json`/`config*.json` |
| `ledger` | 有 `*.xlsx` → `markdown+xlsx`；有 index csv → `markdown+csv`；否则 `markdown` |
| `archive.roots` | 找已存在的 `**/_archive/`、`**/archive/`、`**/历史/` |
| `analysis_boundary.skill_name` | 扫 `.cursor/skills/` 是否有分析/复盘类 skill；有则填其名 |
| `style.language` | 看现有 md 主语言 |

探测手段：`find`/`glob` 目录树 + `grep` 文件名关键词；**不要**通读大文件，命中文件名/路径即可。

**第 2 步：把草稿摘要给用户**，只请确认这几处高歧义项（其余默认沿用探测值）：

1. 推进记录路由：探测到 N 个候选，「哪些是当前活跃的主日志？多路线时各写哪份？」
2. 是否**禁止跨路线混表指标**（默认是）。
3. 正式入账：无 / 仅 Markdown / 有 CSV index / 有 xlsx（探测值对不对）。
4. 成功标准一句话（探测不到，必问；给默认见 Q10）。

**第 3 步：落盘 profile**，再用 ≤5 行确认：文档根 / 日志路由数 / 入账模式 / 归档是否需口头确认 / 成功标准。之后即可继续用户原本的业务动作。

> 找不齐没关系：能填的填，填不了的键留空并在 profile 里 `# TODO` 标注，业务动作照常跑，用起来再补。

---

## 模式 B · 从零 scaffold（空仓库/无 docs）

当仓库几乎没有文档结构时，先**建最小骨架**（骨架模板见 [templates.md](templates.md) §起步骨架），再生成 profile。

**建议先问一句**：「实验如何分组？」（按课题 / 模型族 / 数据版本 / 论文章节均可）——决定路由表分几条。默认单条 `main`。

生成的最小骨架（可按用户 `docs_root` 调整路径）：

```
docs/
├── README.md                         # 入口：项目一句话 + 「现在先看什么」+ 当前主线
├── 00-规范与记录/
│   └── 项目知识库整理规范.md          # 分层规范（入口/规范/路线状态/推进记录/证据）
└── 02-推进与变更/
    └── 代码修改与实验推进记录.md       # 空日志，仅含文件说明块（最新在上）
```

骨架建好后：`docs_root=docs/`、`norms_dir=docs/00-规范与记录/`、单条推进记录路由、`ledger.mode=markdown`、`archive.roots=["docs/**/_archive/"]`，其余用默认。落盘 profile，再确认成功标准一句话。

> Scaffold 只建**最小可用**结构，不预设复杂分册；等实验真的分叉了，再用「重新配置」或规范演进（SKILL §8）长出来。

---

## 模式 C · 完整问卷（Q1–Q10）

一次抛出下列问题（可编号作答）。已有合理默认值的项给出默认并允许「沿用」。答完后**直接写入** profile；重新配置时先摘要 diff。

若用户做通用科研、尚未想好路线分册：先问「实验如何分组？」再填路由表。

**Q1. 文档根目录** 例：`docs/` → `docs_root`

**Q2. 推进记录路径**（可多个）例：`docs/02-推进与变更/代码修改与实验推进记录.md`；多路线时列「路由名 → 文件路径 → 何时用」→ `progress_logs`

**Q3. 规范目录** 例：`docs/00-规范与记录/` → `norms_dir`

**Q4. 路线/任务分册** 每条：`名称 | 状态主文档 | 是否禁止与其他路线混写指标` → `routes`

**Q5. 实验 ID 与产物** ID 规则（前缀/正则）· run 目录或 index · summary/history 文件名约定 → `experiment_id_rule`, `artifacts`

**Q6. 正式入账表** 无 / 仅 Markdown / 有 CSV index / 有 xlsx；路径与关键 sheet/列；填写规范文件名（落在 `norms_dir`）→ `ledger`

**Q7. 归档约定** 归档根目录（如 `docs/**/_archive/`）；确认「仅用户明确说归档才搬文件」（默认是）→ `archive`

**Q8. 分析类 Skill / 复盘边界** 项目内分析 skill 名与触发词（可无）；本 Skill 是否只「回填」不写长篇复盘（默认是）→ `analysis_boundary`

**Q9. 语言与标题** 文档语言（默认中文）；推进记录标题格式（默认 `## YYYY-MM-DD｜主题 · 动作 · 状态`）；必填字段勾选（工程四件套 + 科研可选）→ `style`, `required_fields`

**Q10. 成功标准（一句话）** 例：新人 10 分钟找到当前主线与最新结论；结案归档不丢 Go/No-Go。默认即此句 → `success_criteria`

---

## 写入模板（三模式共用）

将结果填入以下 YAML+Markdown 结构（可删注释；填不出的键留空并加 `# TODO`）：

````markdown
# PROJECT_PROFILE — <project-name>

> 由 lab-docs-engineering 向导生成。改分册/口径时同步更新本文件与 norms_dir。
> 通用 Skill 本体：`~/.cursor/skills/lab-docs-engineering/`。

```yaml
project_name: ""
docs_root: "docs/"
norms_dir: "docs/00-规范与记录/"
success_criteria: "新人 10 分钟找到当前主线与最新结论；结案归档后现行文档仍保留 Go/No-Go 与证据路径。"

progress_logs:
  - route: "default"
    path: "docs/02-推进与变更/代码修改与实验推进记录.md"
    when: "默认；无法路由时先询问"

routes:
  - name: "main"
    status_doc: ""
    no_cross_metrics: true

experiment_id_rule: ""
artifacts:
  index: ""
  run_glob: ""
  summary_files: ["summary.json", "history.csv"]

ledger:
  mode: "markdown"   # markdown | markdown+csv | markdown+xlsx
  xlsx_path: ""
  csv_index: ""
  fill_spec: ""      # norms_dir 内文件名

archive:
  roots: []
  only_when_user_says_archive: true

analysis_boundary:
  skill_name: ""
  this_skill_backfill_only: true

style:
  language: "zh-CN"
  progress_title: "## YYYY-MM-DD｜主题 · 动作 · 状态"

required_fields:
  engineering:
    - 本次主要修改
    - 对应代码/文档
    - 推进到实验步骤
    - 当前状态判断
  research_optional:
    - 背景假设
    - 方法变更
    - 关键指标
    - Go-NoGo
    - 下一步

doc_layers:
  - layer: "入口"
    paths: ["README.md", "docs/README.md"]
  - layer: "规范"
    paths: ["docs/00-规范与记录/"]
  - layer: "推进记录"
    paths: []
  - layer: "路线状态"
    paths: []
```
````

生成后用 5 行以内确认：文档根、日志路由数、入账模式、归档是否需口头确认、成功标准。
