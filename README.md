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

## 如何安装技能到 Antigravity 中

您可以通过以下两种方式将本仓库中的某个技能安装到您的 Antigravity 环境中：

### 方式一：通过 Git 手动安装

1. **Clone 仓库**：将本仓库克隆到您的本地：
   ```bash
   git clone https://github.com/xiuyangFeng/person-skills.git
   ```
2. **部署技能**：
   - **全局安装**：将克隆下来的特定技能文件夹（例如 `skills/template-skill`）复制到您的全局自定义技能根目录下（通常为 `~/.gemini/config/skills/`）。
   - **项目级安装**：将特定的技能文件夹复制到您当前项目工作区目录下的 `.agents/skills/` 目录中。
   - **非标准路径引用**：如果您不想复制文件夹，可以在您的自定义根目录中创建或更新 `skills.json` 文件，直接引入该仓库的 `skills` 路径：
     ```json
     {
       "entries": [
         { "path": "/path/to/cloned/person-skills/skills" }
       ]
     }
     ```

### 方式二：通过智能体自动下载安装

您可以直接通过对话指令，让 Antigravity 智能体帮您自动下载并安装本仓库中的特定技能。例如：

> **提示词示例**：
> “帮我从 `https://github.com/xiuyangFeng/person-skills` 仓库下载 `template-skill` 技能，并将其安装到当前工作区的自定义技能目录中。”

智能体会自动克隆/下载仓库文件，并将对应的技能文件夹提取至合适的位置（如当前工作区的 `.agents/skills/template-skill`），实现一键安装。

