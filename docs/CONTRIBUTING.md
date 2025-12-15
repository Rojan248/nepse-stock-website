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
2. Make your changes
3. Write/update tests
4. Run tests: `npm test`
5. Commit with clear message
6. Push and create Pull Request

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

**Examples:**
```
feat(stocks): add sector filter to stock table
fix(api): handle timeout errors gracefully
docs: update API documentation
```

## Pull Request Process

1. Ensure tests pass
2. Update documentation if needed
3. Fill out PR template
4. Request review
5. Address feedback

## Reporting Issues

Use GitHub Issues with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## Questions?

Open a Discussion or Issue on GitHub.
