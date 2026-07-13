---
name: template-skill
description: 这是一个用于创建新 skill 的模版。当您需要编写新的 AI Agent 自定义技能时，可以复制该文件夹并参考本文件。
---

# 模版技能 (Template Skill)

本文件是自定义技能 (Customization Skills) 的标准格式模版。当您创建自定义技能时，Antigravity 助手会自动发现并加载这些技能。

## 编写说明

1. **Frontmatter**：
   - 必须包含 `name`（技能名称，全小写，建议用连字符连接）和 `description`（简短说明，用于触发匹配）。
   - 只有 `name` 和 `description` 会被用于触发匹配。
   
2. **正文**：
   - 编写具体的 Markdown 格式指令。
   - 保持在 500 行以内。如果需要更长的参考文档，请将其放在子目录 `references/` 中，并在正文中引导 Agent 在需要时读取。

## 推荐的目录结构

如果您需要为技能提供额外的辅助资源，可以在该技能目录下创建：
- `scripts/`：存放技能调用的 Python 或 Shell 脚本。
- `examples/`：存放示例输入、输出，帮助 Agent 理解应用场景。
- `resources/`：存放技能所需的 JSON 配置、模型数据等静态资源。
- `references/`：存放详细的 API 文档、设计规范或长文本说明。
