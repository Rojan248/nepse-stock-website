---
name: Prisma SQLite Database
description: Patterns for using Prisma ORM with SQLite, including schema design, migrations, queries, and optimization
---

# Prisma SQLite Database Skill

## Schema Design

### Stock Data Schema Example
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Stock {
  id            Int      @id @default(autoincrement())
  symbol        String   @unique
  companyName   String
  sector        String?
  ltp           Float    @default(0)
  previousClose Float    @default(0)
  change        Float    @default(0)
  changePercent Float    @default(0)
  volume        Int      @default(0)
  turnover      Float    @default(0)
  updatedAt     DateTime @updatedAt
  
  @@index([sector])
  @@index([symbol])
}

model MarketSummary {
  id           Int      @id @default(autoincrement())
  date         DateTime @unique
  nepseIndex   Float
  totalTurnover Float
  totalVolume  Int
  advances     Int
  declines     Int
  unchanged    Int
  createdAt    DateTime @default(now())
}
```

## Common Queries

### CRUD Operations
```javascript
const prisma = require('@prisma/client');

// Create
await prisma.stock.create({
  data: { symbol: 'NABIL', companyName: 'Nabil Bank', sector: 'Commercial Banks' }
});

// Read
const stocks = await prisma.stock.findMany({
  where: { sector: 'Commercial Banks' },
  orderBy: { ltp: 'desc' }
});

// Update
await prisma.stock.update({
  where: { symbol: 'NABIL' },
  data: { ltp: 500, volume: 10000 }
});

// Upsert (update or create)
await prisma.stock.upsert({
  where: { symbol: 'NABIL' },
  update: { ltp: 500 },
  create: { symbol: 'NABIL', companyName: 'Nabil Bank', ltp: 500 }
});

// Delete
await prisma.stock.delete({ where: { symbol: 'NABIL' } });
```

### Bulk Operations
```javascript
// Bulk upsert pattern
const stocks = [{ symbol: 'NABIL', ltp: 500 }, { symbol: 'EBL', ltp: 300 }];

await prisma.$transaction(
  stocks.map(stock =>
    prisma.stock.upsert({
      where: { symbol: stock.symbol },
      update: stock,
      create: stock
    })
  )
);
```

## Migrations

### Commands
```bash
# Create migration
npx prisma migrate dev --name init

# Apply migrations (production)
npx prisma migrate deploy

# Reset database
npx prisma migrate reset

# Generate client
npx prisma generate

# View data in browser
npx prisma studio
```

## SQLite Optimizations

### Enable WAL Mode
```javascript
// In your database initialization
await prisma.$executeRaw`PRAGMA journal_mode = WAL;`;
await prisma.$executeRaw`PRAGMA synchronous = NORMAL;`;
await prisma.$executeRaw`PRAGMA cache_size = 10000;`;
```

### Connection Handling
```javascript
// Singleton pattern for Prisma client
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}
```

## Best Practices

1. **Use transactions** - For multiple related operations
2. **Index frequently queried fields** - Add `@@index` in schema
3. **Use select/include** - Only fetch needed fields
4. **Handle disconnects** - Implement retry logic
5. **Backup regularly** - SQLite files can be copied directly
