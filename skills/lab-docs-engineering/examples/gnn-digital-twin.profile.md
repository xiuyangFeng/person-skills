# PROJECT_PROFILE 示例 — GNN Digital Twin（AAA/WSS）

> 示例供向导填写参考。真实项目请生成为：
> `.cursor/skills/lab-docs-engineering/PROJECT_PROFILE.md`

```yaml
project_name: "GNN-Digital-Twin-WSS"
docs_root: "docs/"
norms_dir: "docs/00-规范与记录/"
success_criteria: "新人能从 docs/README 与路线 README 找到当前主线；结案归档后现行文档仍保留 Go/No-Go 与证据路径。"

progress_logs:
  - route: "V3P/V3D/训练主线/通用"
    path: "docs/02-推进与变更/代码修改与实验推进记录.md"
    when: "非 pipeline_wss_min 专属变更"
  - route: "WSS-min"
    path: "docs/02-推进与变更/WSS最小化_代码修改与实验推进记录.md"
    when: "涉及 pipeline_wss_min/ 或 WSS-only 最小化路线"

routes:
  - name: "V3P"
    status_doc: "docs/01-任务/任务A/03-V3路线/README.md"
    no_cross_metrics: true
    note: "对照 AsymW-a；禁止与 V3D 混表"
  - name: "V3D"
    status_doc: "docs/01-任务/任务A/03-V3路线/README.md"
    no_cross_metrics: true
  - name: "WSS-min"
    status_doc: "docs/02-推进与变更/WSS最小化_训练实验跟踪.md"
    no_cross_metrics: true
  - name: "external-baseline"
    status_doc: "docs/paper_reproduction/"
    no_cross_metrics: true

experiment_id_rule: "V3P-* | V3D-* | WSS-min 配置名 | 外部 baseline 自有 ID"
artifacts:
  index: "outputs/field/experiment_index.csv"
  run_glob: "outputs/field/**/"
  summary_files: ["summary.json", "history.csv", "config.snapshot.json"]

ledger:
  mode: "markdown+xlsx"
  xlsx_path: "docs/00-规范与记录/实验记录表.xlsx"
  csv_index: "outputs/field/experiment_index.csv"
  fill_spec: "实验记录填写规范.md"

archive:
  roots:
    - "docs/02-推进与变更/_archive/"
    - "docs/01-任务/任务A/03-V3路线/_archive/"
  only_when_user_says_archive: true

analysis_boundary:
  skill_name: "analyze-experiment"
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
    paths:
      - "docs/02-推进与变更/代码修改与实验推进记录.md"
      - "docs/02-推进与变更/WSS最小化_代码修改与实验推进记录.md"
  - layer: "路线状态"
    paths: ["docs/01-任务/任务A/03-V3路线/", "docs/02-推进与变更/WSS最小化_*.md"]
  - layer: "知识库整理规范"
    paths: ["docs/00-规范与记录/项目知识库整理规范.md"]
```
