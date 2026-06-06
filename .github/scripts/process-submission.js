#!/usr/bin/env node
/**
 * Harness Hub - Issue submission processor
 *
 * 两种运行模式:
 *   1) 默认:解析 Issue body -> 拉取 GitHub 仓库元数据 -> 在 <Type>/<owner>-<repo>/ 下
 *          生成 README.md 与 metadata.json -> 重建 README 索引
 *   2) --regen-index:仅重建 README 索引(供 post-merge.yml 使用)
 *
 * 通过 stdout 写 GitHub Actions output(供后续 step 引用):
 *   repo=<owner>/<repo>
 *   types=Skill, Plugin
 *   links=...
 *   description=...
 *   duplicate_note=...
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TYPES = ['Skill', 'Plugin', 'Workflow', 'Template'];
const TYPE_LABEL_ZH = {
  Skill: 'Skill',
  Plugin: 'Plugin',
  Workflow: 'Workflow',
  Template: 'Template',
};
const TYPE_HEADING = {
  Skill: 'Skill',
  Plugin: 'Plugin',
  Workflow: 'Workflow',
  Template: 'Template',
};
const INDEX_START_MARK = '<!-- harness-hub:index:start -->';
const INDEX_END_MARK = '<!-- harness-hub:index:end -->';
const MAX_TAGS = 10;
const MAX_TAGS_DISPLAY = 5;

// ---------- Utilities ----------

function setOutput(key, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  // 用 \n 安全分隔多行字段;value 中若有 \n,需要替换为 \\n 临时
  const safe = String(value || '').replace(/\n/g, '\\n');
  fs.appendFileSync(file, `${key}=${safe}\n`);
}

function appendOutput(key, value) {
  setOutput(key, value);
}

function log(...args) {
  console.log('[harness-hub]', ...args);
}

function err(...args) {
  console.error('[harness-hub][error]', ...args);
}

function fail(message) {
  err(message);
  // 留 issue comment
  const issueNumber = process.env.ISSUE_NUMBER;
  const issueBody = process.env.ISSUE_BODY;
  const isApiIssue = issueNumber && !process.env.ISSUE_HTML_URL; // workflow_dispatch 不会带 issue body
  if (issueNumber && issueBody) {
    try {
      execFileSync('gh', [
        'issue',
        'comment',
        String(issueNumber),
        '--body',
        `:warning: Harness Hub bot 失败:\n\n> ${message}\n\n请修正后重新提交或回复本 Issue 以触发重试。`,
      ], {
        env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN },
        stdio: 'pipe',
      });
    } catch (e) {
      err('Failed to comment on issue:', e.message);
    }
  } else if (issueNumber && isApiIssue) {
    log(`workflow_dispatch run for issue #${issueNumber} failed: ${message}`);
  }
  process.exit(1);
}

// ---------- 1. Parse Issue body ----------

function parseIssueBody(rawBody) {
  if (!rawBody || typeof rawBody !== 'string') {
    throw new Error('Issue body 为空,无法解析');
  }
  const result = {
    repoUrl: '',
    types: [],
    description: '',
    tags: [],
  };

  // Issue Form 渲染后大致形如:
  //   ### 仓库 URL(必填)
  //   <URL>
  //   ### 资源类型(多选,至少一项)
  //   - [x] Skill
  //   - [ ] Plugin
  //   ...
  //   ### 简短描述(中文,必填)
  //   <text>
  //   ### 标签 / 关键词(可选,逗号分隔)
  //   <text>
  // 按 h3 段切分
  const sections = rawBody.split(/^###\s+/m).slice(1);
  for (const sec of sections) {
    const newlineIdx = sec.indexOf('\n');
    const heading = (newlineIdx === -1 ? sec : sec.slice(0, newlineIdx)).trim();
    const body = (newlineIdx === -1 ? '' : sec.slice(newlineIdx + 1)).trim();
    if (heading.startsWith('仓库 URL')) {
      result.repoUrl = body.split(/\r?\n/)[0].trim();
    } else if (heading.startsWith('资源类型')) {
      const checked = [...body.matchAll(/^-\s*\[x\]\s*(.+)$/gim)].map(m => m[1].trim());
      result.types = checked.filter(t => TYPES.includes(t));
    } else if (heading.startsWith('简短描述')) {
      result.description = body;
    } else if (heading.startsWith('标签') || heading.toLowerCase().startsWith('tags')) {
      const firstLine = body.split(/\r?\n/)[0] || '';
      result.tags = firstLine
        .split(/[,，]/)
        .map(s => s.trim())
        .filter(Boolean);
    }
  }

  if (!result.repoUrl) throw new Error('缺少"仓库 URL"字段');
  if (result.types.length === 0) throw new Error('资源类型至少勾选一项(Skill / Plugin / Workflow / Template)');
  if (!result.description) throw new Error('缺少"简短描述"字段');

  if (result.tags.length > MAX_TAGS) {
    const dropped = result.tags.slice(MAX_TAGS);
    result.tags = result.tags.slice(0, MAX_TAGS);
    result._droppedTags = dropped;
  }
  return result;
}

// ---------- 2. Validate URL ----------

function validateRepoUrl(url) {
  const m = /^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(url);
  if (!m) {
    throw new Error(`仓库 URL 格式非法,必须为 https://github.com/<owner>/<repo>: ${url}`);
  }
  const owner = m[1];
  const repo = m[2];
  if (owner.startsWith('.') || owner.endsWith('.') || owner === '..') {
    throw new Error(`owner 非法: ${owner}`);
  }
  return { owner, repo };
}

// ---------- 3. Fetch repo meta via gh api ----------

function ghApi(endpoint) {
  const args = ['api', endpoint];
  if (process.env.GH_TOKEN) {
    args.push('--header', 'X-GitHub-Api-Version: 2022-11-28');
  }
  let stdout;
  try {
    stdout = execFileSync('gh', args, {
      env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN },
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (e) {
    const msg = (e.stderr ? e.stderr.toString() : '') + ' ' + (e.message || '');
    // 403 / 404 区分
    if (/404/.test(msg) || /Not Found/i.test(msg)) {
      const err404 = new Error('仓库不存在或为私有仓库(返回 404)');
      err404.code = 'NOT_FOUND';
      throw err404;
    }
    if (/403/.test(msg) || /rate limit/i.test(msg)) {
      const err403 = new Error('触发 GitHub API 速率限制(403)');
      err403.code = 'RATE_LIMIT';
      throw err403;
    }
    throw new Error(`gh api 失败: ${msg.trim()}`);
  }
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`gh api 返回非 JSON: ${stdout.slice(0, 200)}`);
  }
}

function fetchRepoMeta(owner, repo) {
  const base = ghApi(`/repos/${owner}/${repo}`);
  let topics = [];
  try {
    const t = ghApi(`/repos/${owner}/${repo}/topics`);
    topics = t && Array.isArray(t.names) ? t.names : [];
  } catch (e) {
    log(`topics 拉取失败,忽略: ${e.message}`);
  }
  return {
    name: base.name,
    full_name: base.full_name,
    description: base.description || '',
    stars: base.stargazers_count || 0,
    forks: base.forks_count || 0,
    language: base.language || null,
    topics,
    license: base.license && base.license.spdx_id ? base.license.spdx_id : null,
    html_url: base.html_url,
    archived: !!base.archived,
    private: !!base.private,
    default_branch: base.default_branch || 'main',
  };
}

// ---------- 4. Detect duplicates ----------

function detectDuplicate({ owner, repo, types }) {
  const found = [];
  for (const t of types) {
    const dir = path.join(t, `${owner}-${repo}`);
    const metaFile = path.join(dir, 'metadata.json');
    if (fs.existsSync(metaFile)) {
      let prev = null;
      try { prev = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch { /* ignore */ }
      found.push({ type: t, dir, prev });
    }
  }
  return found;
}

// ---------- 5. Build metadata.json ----------

function buildMetadata({ owner, repo, types, description, tags, repoMeta, issueNumber, dup }) {
  const now = new Date().toISOString();
  let meta;
  if (dup && dup.length > 0 && dup[0].prev) {
    const prev = dup[0].prev;
    meta = { ...prev };
    meta.types = Array.from(new Set([...prev.types, ...types]));
    meta.description_zh = description;
    meta.description_en = repoMeta.description || meta.description_en || '';
    meta.tags = tags;
    meta.stars = repoMeta.stars;
    meta.topics = repoMeta.topics;
    meta.license = repoMeta.license;
    meta.last_updated_via_issue = issueNumber;
    meta.last_updated_at = now;
  } else {
    meta = {
      owner,
      repo,
      url: `https://github.com/${owner}/${repo}`,
      types,
      source_name: repoMeta.name,
      description_zh: description,
      description_en: repoMeta.description || '',
      tags,
      stars: repoMeta.stars,
      topics: repoMeta.topics,
      license: repoMeta.license,
      language: repoMeta.language,
      added_via_issue: issueNumber,
      added_at: now,
    };
  }
  return meta;
}

// ---------- 6. Build README.md (per resource) ----------

function buildReadme(meta) {
  const display = TYPE_HEADING;
  const typeLine = meta.types.map(t => `\`${t}\``).join(' · ');
  const tagsAll = Array.from(new Set([
    ...(meta.tags || []),
    ...(meta.topics || []),
  ])).filter(Boolean);
  const tagBadges = tagsAll.slice(0, MAX_TAGS_DISPLAY).map(t => `\`${t}\``).join(' ');
  const descZh = meta.description_zh || '';
  const descEn = meta.description_en || '';
  const license = meta.license ? `\`${meta.license}\`` : '未声明';
  const starsBadge = `[![GitHub stars](https://img.shields.io/github/stars/${meta.owner}/${meta.repo}?style=social)](https://github.com/${meta.owner}/${meta.repo})`;
  return `# ${meta.owner}/${meta.repo}

> ${descZh || descEn || '_暂无描述_'}

| 字段 | 值 |
|---|---|
| 类型 | ${typeLine} |
| 仓库 | <https://github.com/${meta.owner}/${meta.repo}> |
| Stars | ⭐ ${formatStars(meta.stars)} (${meta.stars || 0}) |
| License | ${license} |
| 收录于 | Issue #${meta.added_via_issue}${meta.last_updated_via_issue ? ` · 更新于 Issue #${meta.last_updated_via_issue}` : ''} |

${starsBadge}

${descEn ? `## English Description\n\n> ${descEn}\n\n` : ''}${tagBadges ? `## 标签\n\n${tagBadges}\n` : ''}
`;
}

// 把整数格式化为紧凑形式:1234 -> "1.2k", 208646 -> "208.6k", 1500000 -> "1.5M"
function formatStars(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}k`;
  }
  return String(num);
}

// ---------- 7. Write artifacts ----------

function writeArtifacts({ types, owner, repo, meta, readme }) {
  for (const t of types) {
    const dir = path.join(t, `${owner}-${repo}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'README.md'), readme, 'utf8');
    log(`wrote ${dir}/{README.md, metadata.json}`);
  }
}

// 为所有 4 个 type 目录创建占位 .gitkeep,确保目录被 git 跟踪
// (create-pull-request 的 add-paths 在 pathspec 不存在时会 fatal)
function ensureTypePlaceholders() {
  for (const t of TYPES) {
    const dir = t;
    fs.mkdirSync(dir, { recursive: true });
    // 目录中已有真实资源子目录时,不写入 .gitkeep(避免与真实文件并存造成混乱)
    const entries = fs.readdirSync(dir);
    const hasReal = entries.some(name => {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      return stat.isDirectory() && fs.existsSync(path.join(full, 'metadata.json'));
    });
    if (hasReal) continue;
    const keep = path.join(dir, '.gitkeep');
    if (!fs.existsSync(keep)) {
      fs.writeFileSync(keep, '# 仅为占位,保证目录被 git 跟踪\n', 'utf8');
      log(`created placeholder ${keep}`);
    }
  }
}

// ---------- 8. Regenerate README index ----------

function loadAllMeta() {
  const out = [];
  for (const t of TYPES) {
    if (!fs.existsSync(t)) continue;
    const entries = fs.readdirSync(t, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const metaFile = path.join(t, ent.name, 'metadata.json');
      if (!fs.existsSync(metaFile)) continue;
      try {
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        if (!Array.isArray(meta.types) || meta.types.length === 0) {
          meta.types = [t];
        }
        out.push(meta);
      } catch (e) {
        log(`跳过 ${metaFile}: ${e.message}`);
      }
    }
  }
  return out;
}

function renderEntryLine(meta, lang) {
  // 表格行:项目(超链接) | 描述 | 类型 | Stars(格式化 + 图标)
  const desc = (lang === 'en' ? (meta.description_en || meta.description_zh) : (meta.description_zh || meta.description_en)) || '';
  // 表格中管道符与换行要转义,避免破坏表格
  const descSafe = desc.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').slice(0, 200);
  const descCell = descSafe || (lang === 'en' ? '_(no description)_' : '_(暂无描述)_');
  const types = (meta.types && meta.types.length > 0) ? meta.types.join(', ') : '—';
  const url = `https://github.com/${meta.owner}/${meta.repo}`;
  const project = `[${meta.owner}/${meta.repo}](${url})`;
  const starsCell = `⭐ ${formatStars(meta.stars)} ![stars](https://img.shields.io/github/stars/${meta.owner}/${meta.repo}?style=social)`;
  return `| ${project} | ${descCell} | ${types} | ${starsCell} |`;
}

function buildIndexBlock(lang) {
  const all = loadAllMeta();
  // 单一表格,按 stars 降序、同星按 added_at 降序
  all.sort((a, b) => {
    const s = (b.stars || 0) - (a.stars || 0);
    if (s !== 0) return s;
    return (b.added_at || '').localeCompare(a.added_at || '');
  });
  if (all.length === 0) {
    return lang === 'en' ? '_No resources yet — submit the first one via a new issue!_' : '_(暂无,提交第一个 Issue 来收录你的资源吧!)_';
  }
  const lines = [];
  if (lang === 'en') {
    lines.push('| Project | Description | Type | Stars |');
    lines.push('|---|---|---|---|');
  } else {
    lines.push('| 项目 | 描述 | 类型 | Stars |');
    lines.push('|---|---|---|---|');
  }
  for (const meta of all) {
    lines.push(renderEntryLine(meta, lang));
  }
  return lines.join('\n');
}

function regenerateIndex({ readmePath, lang }) {
  if (!fs.existsSync(readmePath)) {
    log(`readme not found: ${readmePath}, skip`);
    return false;
  }
  const content = fs.readFileSync(readmePath, 'utf8');
  if (!content.includes(INDEX_START_MARK) || !content.includes(INDEX_END_MARK)) {
    log(`index markers not found in ${readmePath}, skip`);
    return false;
  }
  const re = new RegExp(`${escapeRegExp(INDEX_START_MARK)}[\\s\\S]*?${escapeRegExp(INDEX_END_MARK)}`);
  const newBlock = `${INDEX_START_MARK}\n${buildIndexBlock(lang).trimEnd()}\n${INDEX_END_MARK}`;
  const newContent = content.replace(re, newBlock);
  if (newContent === content) return false;
  fs.writeFileSync(readmePath, newContent, 'utf8');
  log(`regenerated index in ${readmePath}`);
  return true;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- 9. Main ----------

async function main() {
  const regenOnly = process.argv.includes('--regen-index');
  if (regenOnly) {
    const changedZh = regenerateIndex({ readmePath: 'README.md', lang: 'zh' });
    const changedEn = regenerateIndex({ readmePath: 'README.en.md', lang: 'en' });
    if (!changedZh && !changedEn) {
      log('index 未变化,无需开 PR');
    }
    return;
  }

  // 1. parse
  // 在 workflow_dispatch 模式下,env ISSUE_BODY/ISSUE_AUTHOR 为空,需通过 gh issue view 拉取
  let issueBody = process.env.ISSUE_BODY;
  let issueAuthor = process.env.ISSUE_AUTHOR;
  if ((!issueBody || !issueBody.trim()) || !issueAuthor) {
    const issueNumber = process.env.ISSUE_NUMBER;
    if (!issueNumber) {
      fail('Issue body 为空且未提供 ISSUE_NUMBER,无法继续');
      return;
    }
    try {
      const out = execFileSync('gh', [
        'issue', 'view', String(issueNumber),
        '--json', 'body,author',
        '--jq', '{body: .body, author: .author.login}',
      ], {
        env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN },
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const obj = JSON.parse(out);
      if (!issueBody || !issueBody.trim()) {
        issueBody = String(obj.body || '').trim();
        log(`通过 gh issue view 拉取了 issue #${issueNumber} 的 body (${issueBody.length} 字符)`);
      }
      if (!issueAuthor && obj.author) {
        issueAuthor = String(obj.author);
        log(`通过 gh issue view 拉取了 issue #${issueNumber} 的 author (${issueAuthor})`);
      }
    } catch (e) {
      fail(`拉取 issue #${issueNumber} 失败: ${(e.stderr && e.stderr.toString()) || e.message}`);
      return;
    }
  }
  let parsed;
  try {
    parsed = parseIssueBody(issueBody);
  } catch (e) {
    fail(e.message);
    return;
  }
  log(`parsed: ${JSON.stringify({ types: parsed.types, tags: parsed.tags, hasUrl: !!parsed.repoUrl })}`);

  // 2. validate url
  let ownerRepo;
  try {
    ownerRepo = validateRepoUrl(parsed.repoUrl);
  } catch (e) {
    fail(e.message);
    return;
  }
  const { owner, repo } = ownerRepo;
  log(`owner/repo: ${owner}/${repo}`);

  // 3. fetch repo meta
  let repoMeta;
  try {
    repoMeta = fetchRepoMeta(owner, repo);
  } catch (e) {
    if (e.code === 'NOT_FOUND') {
      fail('仓库不存在或为私有仓库(返回 404),请确认是 GitHub 公共仓库后再提交。');
    } else if (e.code === 'RATE_LIMIT') {
      fail('触发 GitHub API 速率限制,请稍后由 Maintainer 用 workflow_dispatch 手动重试,或在 1 小时后重提。');
    } else {
      fail(e.message);
    }
    return;
  }
  if (repoMeta.archived) {
    log(`warning: ${owner}/${repo} 已被归档`);
  }

  // 4. detect duplicate
  const dup = detectDuplicate({ owner, repo, types: parsed.types });
  const isUpdate = dup.length > 0;
  log(`duplicate check: ${isUpdate ? `update (${dup.map(d => d.type).join(',')})` : 'new'}`);

  // 5. build meta
  const issueNumber = process.env.ISSUE_NUMBER;
  const meta = buildMetadata({
    owner, repo,
    types: parsed.types,
    description: parsed.description,
    tags: parsed.tags,
    repoMeta,
    issueNumber,
    dup,
  });

  // 6. build readme
  const readme = buildReadme(meta);

  // 7. write artifacts
  writeArtifacts({ types: parsed.types, owner, repo, meta, readme });

  // 7b. ensure all 4 type directories exist as tracked directories
  ensureTypePlaceholders();

  // 8. regenerate index
  regenerateIndex({ readmePath: 'README.md', lang: 'zh' });
  regenerateIndex({ readmePath: 'README.en.md', lang: 'en' });

  // 9. set outputs
  appendOutput('repo', `${owner}/${repo}`);
  appendOutput('types', parsed.types.join(', '));
  const links = parsed.types.map(t => `- [${t}/${owner}-${repo}](./${t}/${owner}-${repo}/README.md)`).join('\n');
  appendOutput('links', links);
  appendOutput('description', parsed.description);
  appendOutput('issue_author', issueAuthor || '');
  if (isUpdate) {
    appendOutput('duplicate_note', `> :arrows_counterclockwise: **本资源已被收录过**,本次将更新元数据(原 \`added_via_issue\` 保留为 \`#${dup[0].prev && dup[0].prev.added_via_issue}\`)。`);
  } else {
    appendOutput('duplicate_note', '');
  }
  if (parsed._droppedTags && parsed._droppedTags.length > 0) {
    log(`dropped ${parsed._droppedTags.length} tags: ${parsed._droppedTags.join(', ')}`);
  }
  log('done.');
}

main().catch(e => {
  err('unhandled:', e);
  fail(e.message || 'unknown error');
});
