# lab-docs-engineering · 科研文档工程化 Skill

一个可移植的 Cursor Skill：把「实验记录 / 决策留痕 / 知识库整理 / 收尾归档」变成 AI 助手每次自动、按统一规范完成的动作。装一次，跨你所有科研仓库复用。

## 为什么用它（第一性原理）

科研进度的瓶颈常常不是算力，而是**连续性与交接**——重复踩坑、baseline 混表、找不到当前主线、结案后证据丢失。这个 Skill 用四条铁律固化这件事：

1. **决策+依据被固化**：结论写清 Go/No-Go 与判据来源，不重复 litigate。
2. **不跨路线混表**：不同实验线的指标不裸比，报数必带 baseline/split/seed。
3. **可发现性**：新人从入口 README 几分钟定位「当前主线 + 最新结论 + 下一步」。
4. **归档不丢证据**：收尾后现行文档仍保留 Go/No-Go 与证据路径。

助手每次动作后都对照这四条自检，所以整个组的实验记录会**自动收敛到同一套高质量规范**，而不是各写各的。

## 架构：通用本体 + 每仓 profile

- **通用本体**（本目录，项目无关）：装到你个人 `~/.cursor/skills/`，跨所有仓库共享。
- **项目 profile**（`<repo>/.cursor/skills/lab-docs-engineering/PROJECT_PROFILE.md`）：每个仓库一份，声明本仓的文档路径、路线分册、入账方式、归档目录。首次使用时**向导自动扫描仓库生成**，随仓库进 git。

一处升级本体，所有仓库同时受益；各仓库的差异全部收在自己的 profile 里。

## 安装

```bash
# 个人级：跨你所有仓库可用（推荐）
mkdir -p ~/.cursor/skills
cp -r lab-docs-engineering ~/.cursor/skills/

# 或 项目级：随某个仓库分发给协作者
cp -r lab-docs-engineering <your-repo>/.cursor/skills/
```

（从 `xiuyangFeng/person-skills` 下载后，把 `lab-docs-engineering/` 整个目录放到上述任一位置即可。）

## 30 秒上手

1. 在目标仓库打开 Cursor 对话，说 **「初始化实验记录」**。
   - 助手扫描仓库 → 草拟填好的 `PROJECT_PROFILE.md` → 你一键确认/微调。
   - 空仓库？它会先建一套最小 `docs/` 骨架再生成 profile。
2. 之后正常干活。改完代码或分析完实验说 **「记一下」**，助手按规范在对应推进记录**文首**追加一条。
3. 阶段收尾说 **「归档」**，助手按清单搬历史文档、保留结论与证据路径。

常用触发词：`记一下` / `写推进记录` / `同步文档` / `正式入账` / `整理知识库` / `收尾交接` / `归档` / `初始化实验记录` / `重新配置`。

## 适用范围

任何**做实验、需要留痕与交接**的科研仓库——GNN / CFD / 医学影像 / NLP / 通用 ML 皆可。领域差异全在 profile 里表达，本体不含任何领域假设。参考示例：

- [`examples/generic-ml.profile.md`](examples/generic-ml.profile.md) — 通用最小项目（单/少路线）
- [`examples/gnn-digital-twin.profile.md`](examples/gnn-digital-twin.profile.md) — 复杂多路线真实项目

## 文件地图

| 文件 | 作用 |
| --- | --- |
| `SKILL.md` | 技能主体：北极星四条、能力地图、各工作流、自检 |
| `wizard.md` | 三模式配置向导（自动推断 / 从零 scaffold / 完整问卷） |
| `templates.md` | 推进记录、正式入账、起步骨架模板 |
| `boundaries.md` | 硬边界、与分析/同步类 Skill 的职责划分 |
| `archive-checklist.md` | 归档执行清单 |
| `examples/` | profile 参考样例 |

## 给推广者的提示

- 本体保持**项目无关**：任何 AAA/WSS/具体路线名只应出现在 profile 或 examples 里，不进 `SKILL.md` 等本体文件。
- 想给一个仓库定制默认行为，改它的 `PROJECT_PROFILE.md`，不要改本体。
- 升级本体后，各仓库无需改动即可获得新流程；只有当字段/口径变了才需回各仓 `重新配置`。
