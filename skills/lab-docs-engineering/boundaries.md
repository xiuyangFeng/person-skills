# 边界与禁止项

本文件项目无关；具体的分析类 skill 名、路线名、批量脚本名等以本仓 `PROJECT_PROFILE.md` 为准。

## 本 Skill 负责

- 推进记录、入账 Markdown、规范小步演进、知识库分层整理、**用户明确要求的**归档
- 无 profile 时的配置向导（含从零 scaffold）
- 分析结束后的**短回填**

## 不负责（交给其他 Skill / 人工）

| 事项 | 归属 |
| --- | --- |
| 读 summary/history、出对比图、写长篇复盘 | 分析类 Skill（见 profile.`analysis_boundary.skill_name`） |
| 深度「整库 neat」且项目另有专用同步 Skill | 项目 neat-freak / sync skill；本 Skill 做常规整理时可与之对齐分层表，避免各写一套入口 |
| 训练、提交作业（Slurm 等）、批量评测/对比 | 仅当用户明确要求；且非本 Skill 主路径 |
| git commit / push | 仅当用户明确要求 |

## 与分析类 Skill 衔接

1. 分析 Skill 产出 Go/No-Go 与指标后，本 Skill 写入推进记录 + 跟踪表顶块。
2. 不在本 Skill 内重做曲线对比或凭记忆报数。
3. 用户只说「记一下」且上下文已有分析结论：可直接回填，不必重跑分析。

## 与 neat-freak / 同步类 Skill 重叠时

1. 用户点名同步/neat 类 Skill 或「同步一下」：优先跟项目专用 Skill。
2. 用户点名本 Skill /「写推进记录」「初始化实验记录」：跟本 Skill。
3. 两者都可能改入口 README：先读现有入口结构，**小步改导航**，不推翻未读完的分层。

## 硬禁止（默认）

- 代跑训练 / 提交作业 / 批量对比脚本（除非用户明确要求）
- 移动或删除大数据与证据目录（`outputs/`、`data*`、模型权重等）
- 自动 git commit / push
- **跨路线混表对比指标**（profile.`routes[].no_cross_metrics`）——这是正确性红线，不是格式偏好
- 无用户「归档」指令时把文档搬进 `_archive/`
- 编造未跑实验的指标；写「今天/最近」等相对时间词
