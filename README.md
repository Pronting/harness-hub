# Harness Hub

🌐 **English version**: [README.en.md](./README.en.md)

一个收录开源 Harness 框架相关资源的仓库,涵盖 **Skill / Plugin / Workflow / Template** 四类。

> README 由 GitHub Actions 自动维护。开 [Issue](../../issues/new/choose) 即可提交一个开源资源,机器人会自动开 PR,审核合入后自动收录。

## 收录列表

<!-- harness-hub:index:start -->
| 项目 | 描述 | 类型 | Stars |
|---|---|---|---|
| [affaan-m/ECC](https://github.com/affaan-m/ECC) | 是一个经过实战检验的 Claude Code 工具增强套件, 形态上已经比较接近 harness 框架，内置 136 skills, 36个agent, 68个命令，若干hooks | Plugin | ⭐ 208.7k ![stars](https://img.shields.io/github/stars/affaan-m/ECC?style=social) |
<!-- harness-hub:index:end -->

## 分类

- **Skill** — Agent / LLM 场景下的技能资源
- **Plugin** — 可独立加载的扩展、插件
- **Workflow** — CI/CD、Actions、自动化脚本
- **Template** — 脚手架、Prompt 模板、配置样例

## 如何提交

1. 点击 [新建 Issue](../../issues/new/choose)
2. 选择「提交开源 Harness 资源」
3. 填写:
   - 仓库 URL(必填,必须是 GitHub 公共仓库)
   - 资源类型(多选,至少一项)
   - 简短描述(中文,1-3 句)
   - 标签 / 关键词(可选)
4. 提交后,Action 会自动解析、拉取元数据并开一个 PR
5. 维护者审核通过、合入 PR 后,本 README 的"收录列表"区会自动更新

## 收录结构

每个资源以一个子目录存储,结构如下:

```
<类型>/<owner>-<repo>/
├── README.md       # 卡片式展示
└── metadata.json   # 结构化元数据
```

例如 `anthropics/skills` 被收录为 Skill:

```
Skill/anthropics-skills/
├── README.md
└── metadata.json
```

## 许可

本仓库以 [MIT](./LICENSE) 协议发布。收录的第三方项目遵循其各自的项目许可。
