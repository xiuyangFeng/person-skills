# PROJECT_PROFILE 示例 — 通用 ML 项目（最小/少路线）

> 给「结构简单、领域无关」的项目做参考。真实项目请由向导生成为：
> `.cursor/skills/lab-docs-engineering/PROJECT_PROFILE.md`
> 复杂多路线项目见 `gnn-digital-twin.profile.md`。

```yaml
project_name: "my-ml-project"
docs_root: "docs/"
norms_dir: "docs/00-规范与记录/"
success_criteria: "新人 10 分钟找到当前主线与最新结论；结案归档后现行文档仍保留 Go/No-Go 与证据路径。"

# 单条主线即可；实验分叉后再用「重新配置」加路由
progress_logs:
  - route: "default"
    path: "docs/02-推进与变更/代码修改与实验推进记录.md"
    when: "默认；所有代码/实验变更"

routes:
  - name: "main"
    status_doc: "docs/README.md"
    no_cross_metrics: true

experiment_id_rule: "exp-YYYYMMDD-<slug> 或自定义前缀"
artifacts:
  index: "outputs/experiments.csv"      # 有就填，无则留空
  run_glob: "outputs/**/"
  summary_files: ["summary.json", "metrics.json", "history.csv"]

ledger:
  mode: "markdown"          # 无表格时；有 csv/xlsx 改 markdown+csv / markdown+xlsx
  xlsx_path: ""
  csv_index: "outputs/experiments.csv"
  fill_spec: ""

archive:
  roots: ["docs/**/_archive/"]
  only_when_user_says_archive: true

analysis_boundary:
  skill_name: ""            # 项目内若有分析类 skill 填其名
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
    - 关键指标
    - Go-NoGo
    - 下一步

doc_layers:
  - layer: "入口"
    paths: ["README.md", "docs/README.md"]
  - layer: "规范"
    paths: ["docs/00-规范与记录/"]
  - layer: "推进记录"
    paths: ["docs/02-推进与变更/代码修改与实验推进记录.md"]
  - layer: "路线状态"
    paths: ["docs/README.md"]
```
