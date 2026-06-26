# Skill Registry — cymple

> Generated: 2026-06-01 by SDD Init
> Scope: project-level skills preferred over user-level when duplicate

## Project-Level Skills (.agents/skills/)

| Skill | Trigger | Path |
|-------|---------|------|
| nestjs-best-practices | NestJS code — writing, reviewing, refactoring | `.agents/skills/nestjs-best-practices/SKILL.md` |
| next-best-practices | Next.js code — file conventions, RSC, data patterns, metadata, error handling, route handlers | `.agents/skills/next-best-practices/SKILL.md` |
| prisma-postgres | Prisma Postgres — setup, Console, create-db CLI, Management API/SDK | `.agents/skills/prisma-postgres/SKILL.md` |
| simple | Creative/architectural work — feature design, component creation, behavioral changes, brainstorming | `.agents/skills/simple/SKILL.md` |
| vercel-react-best-practices | React/Next.js performance — components, data fetching, bundle optimization | `.agents/skills/vercel-react-best-practices/SKILL.md` |

> `simple` exists at both user-level and project-level; project-level wins per dedup rules.

## User-Level Skills (~/.config/opencode/skills/)

| Skill | Trigger | Path |
|-------|---------|------|
| branch-pr | Creating, opening, or preparing PRs for review | `~/.config/opencode/skills/branch-pr/SKILL.md` |
| chained-pr | PRs over 400 lines, stacked PRs, review slices | `~/.config/opencode/skills/chained-pr/SKILL.md` |
| cognitive-doc-design | Writing guides, READMEs, RFCs, onboarding, architecture docs | `~/.config/opencode/skills/cognitive-doc-design/SKILL.md` |
| comment-writer | PR feedback, issue replies, reviews, Slack, GitHub comments | `~/.config/opencode/skills/comment-writer/SKILL.md` |
| customize-opencode | Editing opencode configuration | `<built-in>` |
| find-skills | Discovering and installing agent skills | `~/.config/opencode/skills/find-skills/SKILL.md` |
| go-testing | Go tests, coverage, Bubbletea teatest, golden files | `~/.config/opencode/skills/go-testing/SKILL.md` |
| issue-creation | Creating GitHub issues, bug reports, feature requests | `~/.config/opencode/skills/issue-creation/SKILL.md` |
| judgment-day | Blind dual review, adversarial review | `~/.config/opencode/skills/judgment-day/SKILL.md` |
| skill-creator | Creating new skills, agent instructions, documenting AI patterns | `~/.config/opencode/skills/skill-creator/SKILL.md` |
| skill-improver | Auditing, upgrading, refactoring existing skills | `~/.config/opencode/skills/skill-improver/SKILL.md` |
| work-unit-commits | Commit splitting, chained PRs, keeping tests/docs with code | `~/.config/opencode/skills/work-unit-commits/SKILL.md` |

*SDD skills (sdd-*), _shared, and skill-registry are excluded from the registry.*

## Convention Files

| File | Type | Description |
|------|------|-------------|
| `AGENTS.md` | Index | Root agent instructions — project structure, build/lint commands, design system, key patterns, architecture |
| `front/AGENTS.md` | Index | Next.js-specific agent rules — proxy.ts, multi-tenant edge logic |
| `front/CLAUDE.md` | Reference | Delegates to `@AGENTS.md` (one-liner) |
