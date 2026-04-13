# AI Agent Instructions

## 🎯 MANDATORY: Read Skills Before Starting Work

This project has documented patterns and conventions in `.agent/skills/`. 
**Before implementing any feature, you MUST:**

1. Check which skills are relevant to your task
2. Read the `SKILL.md` file for those skills
3. Follow the patterns documented there

## Available Skills

| Skill | Path | Use When |
|-------|------|----------|
| **Node.js Express** | `.agent/skills/nodejs-express/SKILL.md` | Building APIs, routes, middleware |
| **React Vite** | `.agent/skills/react-vite/SKILL.md` | Frontend components, hooks, styling |
| **Prisma SQLite** | `.agent/skills/prisma-sqlite/SKILL.md` | Database queries, schema changes |
| **Jest Testing** | `.agent/skills/testing-jest/SKILL.md` | Writing unit/integration tests |
| **PM2 Deployment** | `.agent/skills/deployment-pm2/SKILL.md` | Production deployment, process management |
| **CSS Animations** | `.agent/skills/css-animations/SKILL.md` | Transitions, keyframes, micro-interactions |
| **UI/UX Patterns** | `.agent/skills/ui-ux-patterns/SKILL.md` | Colors, cards, typography, layouts |
| **Caveman** | `.agent/skills/caveman/SKILL.md` | Low token, high accuracy communication |

## Quick Reference

```
.agent/
└── skills/
    ├── nodejs-express/SKILL.md    # Backend API patterns
    ├── react-vite/SKILL.md        # Frontend React patterns
    ├── prisma-sqlite/SKILL.md     # Database operations
    ├── testing-jest/SKILL.md      # Test writing patterns
    ├── deployment-pm2/SKILL.md    # Deployment configuration
    ├── css-animations/SKILL.md    # Animation & transitions
    ├── ui-ux-patterns/SKILL.md    # Design system patterns
    └── caveman/SKILL.md           # Caveman communication style
```

## Project Structure

- **Backend**: `backend/` - Express.js API with Prisma/SQLite
- **Frontend**: `frontend/` - React + Vite application
- **Docs**: `docs/` - Architecture and API documentation
