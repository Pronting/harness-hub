# Harness Hub

🌐 **English version**: [README.en.md](./README.en.md)

一个收录开源 Harness 框架相关资源的仓库,涵盖 **Skill / Plugin / Workflow / Template** 四类。

> README 由 GitHub Actions 自动维护。开 [Issue](../../issues/new/choose) 即可提交一个开源资源,机器人会自动开 PR,审核合入后自动收录。

## 收录列表

<!-- harness-hub:index:start -->
| 项目 | 描述 | 类型 | Stars |
|---|---|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | 头脑风暴，tdd, sdd，安全测试，钩子这些贯穿软件开发流程的始终被抽象为skills供我们使用——一个通用vibe coding skills | Skill | ⭐ 219.7k ![stars](https://img.shields.io/github/stars/obra/superpowers?style=social) |
| [affaan-m/ECC](https://github.com/affaan-m/ECC) | 是一个经过实战检验的 Claude Code 工具增强套件, 形态上已经比较接近 harness 框架，内置 136 skills, 36个agent, 68个命令，若干hooks | Plugin | ⭐ 208.7k ![stars](https://img.shields.io/github/stars/affaan-m/ECC?style=social) |
| [garrytan/gstack](https://github.com/garrytan/gstack) | Prompt + Tool + Workflow 的组合，通过 plan、review、QA、ship 等 skill，让 AI 分别扮演 Tech Lead、Reviewer、QA、安全审计等工程角色，一个完整的AI-native 开发流程跃然纸上 | Workflow | ⭐ 107.8k ![stars](https://img.shields.io/github/stars/garrytan/gstack?style=social) |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | 一个前端审美增强 Skill，通过系统化的 UI/UX 设计规则、布局约束、动效规范与 anti-slop 提示词，控制 AI 生成更高级、更具设计感、去模板化的前端界面输出 | Skill | ⭐ 34.5k ![stars](https://img.shields.io/github/stars/Leonxlnx/taste-skill?style=social) |
| [Musenn/contrib-skill](https://github.com/Musenn/contrib-skill) | 读你本地的 Git 仓库,把你真实做过的事还原出来,然后告诉你哪些能写进简历、哪些不能。不吹牛，不瞎编，讲证据 | Skill | ⭐ 3 ![stars](https://img.shields.io/github/stars/Musenn/contrib-skill?style=social) |
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
