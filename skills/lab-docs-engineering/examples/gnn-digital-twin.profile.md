# PROJECT_PROFILE 示例 — 复杂多路线、多会话并行的真实项目（AAA / WSS 数字孪生）

> 供向导填写参考，摘自一个真实仓库（2026-10，skill v3），已去掉主机绝对路径与运行细节。真实项目请生成为
> `.cursor/skills/lab-docs-engineering/PROJECT_PROFILE.md`。
> 这个项目的特点：按「块」组织（主线 / 时间建模 / 周期量 / 数据与 CFD / 部署），每块一份 README + 一份跟踪；
> 节号全局递增；常同时开多个 AI 会话；有共享 GPU 节点、跨块共用的缓存和在线部署服务。

```yaml
project_name: "GNN-Digital-Twin-WSS"
docs_root: "docs/"
norms_dir: "docs/00-规范与记录/"
success_criteria: "新人或新会话几分钟找到当前主线、最新结论和下一步；各处说法与运行产物一致；归档后仍保留 Go/No-Go 与证据路径。"

progress_logs:
  - route: "主线各块"
    path: "docs/02-推进与变更/WSS最小化_代码修改与实验推进记录.md"
    when: "各块的代码、数据、实验、部署变更；事实已写在块跟踪时写指针条目"
  - route: "历史线 / 通用"
    path: "docs/02-推进与变更/代码修改与实验推进记录.md"
    when: "非主线变更"

section_numbering: "实验跟踪节号全局递增；计数写在 docs/02-推进与变更/README.md「写到哪里」"

routes:
  - name: "01 主线与新数据"
    readme: "docs/02-推进与变更/01-X5D主线与新数据/README.md"
    status_doc: "docs/02-推进与变更/01-X5D主线与新数据/X5D主线_实验跟踪.md"
    no_cross_metrics: true
  - name: "02 时间建模"
    readme: "docs/02-推进与变更/02-时间建模/README.md"
    status_doc: "docs/02-推进与变更/02-时间建模/时间建模_实验跟踪.md"
    no_cross_metrics: true
  - name: "03 周期量"
    readme: "docs/02-推进与变更/03-周期量TAWSS_OSI/README.md"
    status_doc: "docs/02-推进与变更/03-周期量TAWSS_OSI/TAWSS_OSI_实验跟踪.md"
    no_cross_metrics: true
  - name: "04 数据处理与 CFD"
    readme: "docs/02-推进与变更/04-数据处理与CFD/README.md"
    status_doc: "docs/02-推进与变更/04-数据处理与CFD/数据处理与CFD_跟踪.md"
  - name: "05 部署工具"
    readme: "docs/02-推进与变更/05-部署工具/README.md"
    status_doc: "docs/02-推进与变更/05-部署工具/<部署框架活文档>.md"
  - name: "历史线（冻结）"
    status_doc: "docs/02-推进与变更/00-V5设计与历史跟踪/<历史卷>.md"
    no_cross_metrics: true

artifacts:
  run_glob: "training_wss_min/runs/<实验>/<臂>/"
  experiment_glob: "training_wss_min/experiments/<实验>/"
  completion_marker: "train.log 含完成行；eval/ckpt_*/metrics.json"
  queue_status: "experiments/<实验>/queue_status*.json"

ledger:
  mode: "markdown+xlsx"
  xlsx_path: "docs/03-汇报材料/<实验矩阵工作簿>.xlsx"
  xlsx_tools: ["training_wss_min/tools/update_*_xlsx.py"]

archive:
  roots: ["docs/02-推进与变更/_archive/", "docs/02-推进与变更/0?-*/_archive/", "docs/03-汇报材料/_archive/"]
  only_when_user_says_archive: true
  code_read_dirs_keep_in_place: ["docs/02-推进与变更/04-数据处理与CFD/数据回收_2026-09-20/"]

analysis_boundary:
  skill_name: "analyze-experiment"
  this_skill_backfill_only: true

style:
  language: "zh-CN"
  progress_title: "## YYYY-MM-DD｜主题 · 动作 · 状态"
style_extra:
  md_constraints: ["不用 raw HTML 注释", "不用引用式链接定义"]
  timezone_note: "登录 / GPU 节点系统时间是美西时间，文档统一写北京时间"
  delivery: "只改 Markdown，不发网页"

block_layout: "readme+tracking+latest_report"
parallel_sessions: true

live_docs:
  - "docs/README.md"
  - "docs/实验设计总纲.md（状态部分）"
  - "docs/02-推进与变更/README.md"
  - "docs/02-推进与变更/0?-*/README.md"
  - "各块跟踪的最新节与状态头"
  - "docs/04-论文创新与框架/消融实验待办汇总_<日期>.md（「当前状态」块）"
  - "docs/01-任务/任务A/README.md"
  - "docs/00-规范与记录/集群node04使用要点.md"
snapshot_patterns:
  - "docs/**/_archive/**"
  - "docs/03-汇报材料/**"
  - "docs/02-推进与变更/00-V5设计与历史跟踪/**"
  - "带日期的报告、导师汇报提纲、路线图"
  - "跟踪里已结束的历史小节、用户裁定原文、推进记录旧条目"

fact_registry:
  - fact: "唯一数据版本"
    canonical: "04 块跟踪 §1"
    mirrors: ["docs/README.md", "总纲 §1.1/§4.1", "02 总览", "01/03/04 块 README", "消融待办「当前状态」"]
    verify: "数据根目录与 assembly 计划文件；04 跟踪变更记录"
  - fact: "训练底座（配方 + 读数）"
    canonical: "01 块跟踪最新的底座裁定节"
    mirrors: ["docs/README.md", "总纲 §1.1/§5/§6", "02 总览", "01 README", "论文 README", "消融待办「当前状态」"]
    verify: "底座实验的 readout 文件"
  - fact: "部署在用的发布包与服务版本"
    canonical: "05 块 README 当前状态"
    mirrors: ["docs/README.md", "总纲 §1.1", "02 总览", "01/03 README", "论文 README", "消融待办「部署发布包」"]
    verify: "服务健康接口返回的版本；git log；发布目录与下线目录"
  - fact: "运行中 / 刚结束的作业"
    canonical: "所属块跟踪的执行节"
    mirrors: ["所属块 README 当前状态", "推进记录"]
    verify: "调度器 squeue / sacct；Slurm 之外的节点看队列状态文件"

shared_resources:
  - name: "专用 GPU 节点（Slurm 之外）"
    owner: "指定给某一条线；其他线用前须用户同意"
    notice_at: "该线 README + 节点使用要点"
  - name: "跨块共用的派生缓存"
    owner: "时间建模线"
    dependents: "主线的体场数据根链接了其中的文件"
    notice_at: "时间建模 README"
  - name: "在线部署服务"
    owner: "部署块"
    notice_at: "05 块 README"
```
