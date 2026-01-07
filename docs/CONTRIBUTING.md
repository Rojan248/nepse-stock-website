# Contributing to NEPSE Stock Website

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork the repository**
2. **Clone your fork:**
   ```bash
   git clone https://github.com/yourusername/nepse-stock-website.git
   ```
3. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

1. Set up according to [SETUP_GUIDE.md](SETUP_GUIDE.md)
2. Initialize database: `cd backend && npx prisma generate && npx prisma migrate dev`
3. Make your changes
4. Write/update tests
5. Run tests: `npm test`
6. Commit with clear message
7. Push and create Pull Request

## Code Standards

### JavaScript/React
- Use ES6+ features
- Use async/await for promises
- Add JSDoc comments for functions
- Keep components small and focused

### Naming Conventions
- **Files:** PascalCase for components (`StockCard.jsx`)
- **Functions:** camelCase (`formatPrice()`)
- **Constants:** UPPER_SNAKE_CASE (`API_BASE_URL`)

### CSS
- Use CSS variables from design system
- Follow BEM-like naming (`.stock-card-header`)
- Mobile-first responsive design
- Follow Stark Minimalism design philosophy

### Database
- Use Prisma ORM for all database operations
- Create migrations for schema changes: `npx prisma migrate dev --name <description>`
- Never modify production database directly

## Commit Messages

Format: `type(scope): description`

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructure
- `test`: Tests
- `chore`: Maintenance
- `db`: Database/schema changes

**Examples:**
```
feat(stocks): add sector filter to stock table
fix(api): handle timeout errors gracefully
docs: update API documentation
db(prisma): add MarketHistory model
```

## Pull Request Process

1. Ensure tests pass
2. Update documentation if needed
3. Include migration files if schema changed
4. Fill out PR template
5. Request review
6. Address feedback

## Database Changes

When modifying the database schema:

1. Update `backend/prisma/schema.prisma`
2. Create migration: `npx prisma migrate dev --name <description>`
3. Test migration: `npx prisma migrate reset` (development only)
4. Include migration files in your PR
5. Document schema changes in PR description

## Reporting Issues

Use GitHub Issues with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Error logs (from `backend/logs/` or browser console)

## Project Structure

```
nepse-stock-website/
├── backend/
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   │   ├── database/   # Data operations
│   │   │   ├── scrapers/   # Data fetchers
│   │   │   └── watchdog/   # Data verification
│   │   └── middleware/     # Express middleware
│   ├── prisma/             # Database schema & migrations
│   └── data/               # JSON fallback storage
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── services/       # API client
└── docs/                   # Documentation
```

## Questions?

Open a Discussion or Issue on GitHub.
