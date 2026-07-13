# person-skills

这个公开仓库用于汇总、共享和管理我常用的 AI Agent 自定义技能 (Skills)。

通过在这个仓库中整理 Skills，我可以在不同的 Antigravity 工作区中快速复用和共享这些自定义技能。

## 目录结构

本仓库遵循 Antigravity 默认的 Customizations (技能自定义) 格式进行组织：

```
person-skills/
├── README.md                  # 本说明文件
└── skills/                    # 自定义技能目录
    └── template-skill/        # 示例/模版技能
        ├── SKILL.md           # 必须：技能说明与指令文件
        ├── scripts/           # 可选：辅助脚本与工具
        ├── examples/          # 可选：参考实现与用法示例
        ├── resources/         # 可选：技能所需的静态资源
        └── references/        # 可选：参考资料或长文本
```

## 如何添加新的 Skill

1. 在 `skills/` 目录下创建一个与技能名称相同的子文件夹，例如 `skills/my-awesome-skill/`。
2. 在该文件夹下创建 `SKILL.md` 文件。
3. `SKILL.md` 必须符合以下基本格式：
   - 必须包含 `name` 和 `description` 的 YAML Frontmatter。
   - 编写具体的 Markdown 格式指令。

### SKILL.md 模版示例

```markdown
---
name: my-awesome-skill
description: 用于描述该技能做什么以及什么时候触发的简短描述
---

# 技能指令标题

这里是当技能被触发时，Agent 需要遵循的具体指令和工作流。
```

## 导入到 Antigravity 中

您可以将本仓库 clone 到本地，或将其路径配置到您的 Antigravity 自定义 roots 中，具体可以参考 [Antigravity Customizations 文档](file:///Users/xiuyang/.gemini/antigravity/builtin/skills/antigravity_guide/SKILL.md) 了解更多细节。
