---
name: Jest Testing
description: Patterns for unit testing with Jest, including API testing with supertest, mocking, and code coverage
---

# Jest Testing Skill

## Test Structure

### Basic Test File
```javascript
// tests/stockService.test.js
const stockService = require('../src/services/stockService');

describe('Stock Service', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
    jest.clearAllMocks();
  });

  describe('getStocks', () => {
    it('should return array of stocks', async () => {
      const stocks = await stockService.getStocks();
      expect(stocks).toBeInstanceOf(Array);
      expect(stocks.length).toBeGreaterThan(0);
    });

    it('should return stocks with required fields', async () => {
      const stocks = await stockService.getStocks();
      expect(stocks[0]).toHaveProperty('symbol');
      expect(stocks[0]).toHaveProperty('ltp');
    });
  });
});
```

## API Testing with Supertest

### Testing Express Endpoints
```javascript
const request = require('supertest');
const app = require('../src/server');

describe('API Endpoints', () => {
  describe('GET /api/stocks', () => {
    it('should return 200 and stock data', async () => {
      const res = await request(app)
        .get('/api/stocks')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(res.body.status).toBe('healthy');
    });
  });
});
```

## Mocking

### Mocking Modules
```javascript
// Mock external API calls
jest.mock('axios');
const axios = require('axios');

describe('Data Fetcher', () => {
  it('should fetch data from API', async () => {
    axios.get.mockResolvedValue({
      data: [{ symbol: 'NABIL', ltp: 500 }]
    });

    const result = await dataFetcher.fetch();
    expect(result).toHaveLength(1);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});
```

### Mocking Prisma
```javascript
// __mocks__/@prisma/client.js
const mockPrisma = {
  stock: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn()
  }
};

module.exports = { PrismaClient: jest.fn(() => mockPrisma) };
```

## Jest Configuration

### jest.config.js
```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70
    }
  },
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup.js']
};
```

## Testing Async Code

### Async/Await Pattern
```javascript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

it('should handle errors', async () => {
  await expect(failingFunction()).rejects.toThrow('Error message');
});
```

## Commands

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- stockService.test.js

# Watch mode
npm test -- --watch

# Update snapshots
npm test -- -u
```

## Best Practices

1. **One assertion per test** - Keep tests focused
2. **Descriptive names** - Test names should explain what's being tested
3. **Arrange-Act-Assert** - Structure tests clearly
4. **Mock external dependencies** - Don't rely on external services
5. **Test edge cases** - Empty arrays, null values, errors
