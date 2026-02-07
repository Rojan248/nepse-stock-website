# Agent Skills Directory

This folder contains documented patterns and conventions for AI agents working on this codebase.

## ⚠️ IMPORTANT

**Always read the relevant SKILL.md before implementing:**

- Modifying backend → Read `nodejs-express/SKILL.md`
- Modifying frontend → Read `react-vite/SKILL.md`  
- Database changes → Read `prisma-sqlite/SKILL.md`
- Writing tests → Read `testing-jest/SKILL.md`
- Deployment → Read `deployment-pm2/SKILL.md`
- **Adding animations** → Read `css-animations/SKILL.md`
- **UI/UX styling** → Read `ui-ux-patterns/SKILL.md`

## Skills Overview

| Skill | Description |
|-------|-------------|
| `nodejs-express` | REST API structure, middleware, error handling, scheduling |
| `react-vite` | Component patterns, hooks, Vite config, state management |
| `prisma-sqlite` | Schema design, queries, migrations, SQLite optimizations |
| `testing-jest` | Test structure, mocking, API testing with Supertest |
| `deployment-pm2` | PM2 config, zero-downtime deploys, monitoring |
| `css-animations` | Transitions, keyframes, hover effects, loading states |
| `ui-ux-patterns` | Color system, cards, typography, buttons, layouts |

## Adding New Skills

Create a folder with a `SKILL.md` file following this format:

```markdown
---
name: Skill Name
description: Brief description
---

# Skill Name

## Patterns
[Document patterns with code examples]

## Best Practices
[List best practices]
```
