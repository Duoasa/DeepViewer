---
id: DV-0001
title: SDD documentation foundation - Verification
status: Verified
updated: 2026-08-15
---

# DV-0001：验证

## 验证环境

- 提交：工作树，提交前
- 平台：macOS
- 配置：纯 Markdown，无运行时依赖
- 外部依赖：无

## 验收证据

| 验收条件 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| AC-001 | 自动链接检查 + 人工导航检查 | Pass | 20 个 Markdown 文件的相对链接全部可解析；根 README 导航已复查 |
| AC-002 | 文件结构检查 | Pass | `_template` 中四个必需文件均存在 |
| AC-003 | 文本与模板检查 | Pass | `governance.md` 和模板定义 R、NFR、AC、T 与证据映射 |
| AC-004 | `AGENTS.md` 内容检查 | Pass | 根指令包含审批、追踪、同步文档和验证要求 |
| AC-005 | 首个规格完整性检查 | Pass | `DV-0001-sdd-foundation` 四文件完整且状态一致 |

## 执行的命令

```text
node -e 'const fs=require("fs"),path=require("path");const root=process.cwd();const files=[];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){if(e.name!==".git")walk(p)}else if(e.name.endsWith(".md"))files.push(p)}}walk(root);const missing=[];const re=/\[[^\]]*\]\(([^)]+)\)/g;for(const f of files){const s=fs.readFileSync(f,"utf8");for(const m of s.matchAll(re)){let t=m[1].trim().split("#")[0];if(!t||/^(https?:|mailto:)/.test(t))continue;t=decodeURIComponent(t.replace(/^<|>$/g,""));const dest=path.resolve(path.dirname(f),t);if(!fs.existsSync(dest))missing.push(path.relative(root,f)+" -> "+t)}}if(missing.length){console.error(missing.join("\n"));process.exit(1)}console.log("Checked "+files.length+" Markdown files; all relative links resolve.")'
git diff --cached --check
test -f docs/sdd/specs/_template/spec.md
test -f docs/sdd/specs/_template/design.md
test -f docs/sdd/specs/_template/tasks.md
test -f docs/sdd/specs/_template/verification.md
rg -n '^status:' docs/sdd/specs/DV-0001-sdd-foundation
rg --files docs/sdd | sort
```

结果：20 个 Markdown 文件的相对链接全部有效；四个模板文件存在；`DV-0001` 四个文档状态一致；`git diff --cached --check` 无输出并成功退出。

## 人工检查

- [x] README 到 SDD 的导航清晰
- [x] 产品、架构和规格边界无明显重复冲突
- [x] 模板不预设未批准的技术栈
- [x] 独立品牌、许可证和敏感数据规则清晰

## 残余风险

- 当前使用临时脚本验证链接；工程工具链确定后需要加入持续集成门禁。

## 结论

- 结果：Pass
- 验证人：Codex
- 日期：2026-08-15
