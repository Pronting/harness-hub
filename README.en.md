# Harness Hub

A curated collection of open-source **Harness** resources, across four categories: **Skill / Plugin / Workflow / Template**.

> The README index is auto-maintained by GitHub Actions. Open an [Issue](../../issues/new/choose) to submit an open-source resource — the bot will open a PR, and after review & merge the entry will appear in the index automatically.

## Index

<!-- harness-hub:index:start -->
| Project | Description | Type | Stars |
|---|---|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | An agentic skills framework & software development methodology that works. | Skill | ⭐ 219.7k ![stars](https://img.shields.io/github/stars/obra/superpowers?style=social) |
| [affaan-m/ECC](https://github.com/affaan-m/ECC) | The agent harness performance optimization system. Skills, instincts, memory, security, and research-first development for Claude Code, Codex, Opencode, Cursor and beyond. | Plugin | ⭐ 208.7k ![stars](https://img.shields.io/github/stars/affaan-m/ECC?style=social) |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | Taste-Skill - gives your AI good taste. stops the AI from generating boring, generic slop  | Skill | ⭐ 34.5k ![stars](https://img.shields.io/github/stars/Leonxlnx/taste-skill?style=social) |
<!-- harness-hub:index:end -->

## Categories

- **Skill** — Skills for agents / LLM scenarios
- **Plugin** — Standalone loadable extensions and plugins
- **Workflow** — CI/CD, GitHub Actions, automation scripts
- **Template** — Scaffolds, prompt templates, configuration samples

## How to Submit

1. Click [New Issue](../../issues/new/choose)
2. Pick "Submit a Harness resource"
3. Fill in:
   - Repository URL (required, must be a public GitHub repo)
   - Resource type (multi-select, at least one)
   - Short description (1-3 sentences)
   - Tags / keywords (optional)
4. After submission, the bot will parse the issue, fetch repo metadata and open a PR automatically
5. Once a maintainer approves and merges the PR, the index below is regenerated

## Storage Layout

Each resource is stored as a sub-directory:

```
<type>/<owner>-<repo>/
├── README.md       # Card-style page
└── metadata.json   # Structured metadata
```

For example, if `anthropics/skills` is submitted as a Skill:

```
Skill/anthropics-skills/
├── README.md
└── metadata.json
```

## License

This repository is released under the [MIT](./LICENSE) license. Third-party resources keep their own licenses.
