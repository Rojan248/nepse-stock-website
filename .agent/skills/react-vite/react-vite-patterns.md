---
name: React Vite Development
description: Patterns for building React applications with Vite, including component design, hooks, state management, and optimization
---

# React Vite Development Skill

## Component Patterns

### Functional Components with TypeScript
```jsx
import { useState, useEffect } from 'react';

const StockCard = ({ symbol, price, change }) => {
  const isPositive = change >= 0;
  
  return (
    <div className={`stock-card ${isPositive ? 'positive' : 'negative'}`}>
      <h3>{symbol}</h3>
      <p className="price">Rs. {price.toLocaleString()}</p>
      <span className="change">
        {isPositive ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  );
};
```

### Custom Hooks
```jsx
// hooks/useStocks.js
import { useState, useEffect } from 'react';

export const useStocks = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await fetch('/api/stocks');
        const data = await res.json();
        setStocks(data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStocks();
  }, []);

  return { stocks, loading, error };
};
```

## Vite Configuration

### Environment Variables
```javascript
// vite.config.js
export default defineConfig({
  define: {
    'process.env.API_URL': JSON.stringify(process.env.VITE_API_URL)
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
});
```

### Build Optimization
```javascript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts']
        }
      }
    }
  }
});
```

## State Management

### Context API Pattern
```jsx
// context/MarketContext.jsx
import { createContext, useContext, useState } from 'react';

const MarketContext = createContext();

export const MarketProvider = ({ children }) => {
  const [marketStatus, setMarketStatus] = useState('closed');
  
  return (
    <MarketContext.Provider value={{ marketStatus, setMarketStatus }}>
      {children}
    </MarketContext.Provider>
  );
};

export const useMarket = () => useContext(MarketContext);
```

## Data Fetching

### With Auto-Refresh
```jsx
useEffect(() => {
  const fetchData = async () => {
    const res = await fetch('/api/stocks');
    setData(await res.json());
  };
  
  fetchData();
  const interval = setInterval(fetchData, 30000); // Refresh every 30s
  
  return () => clearInterval(interval);
}, []);
```

## Best Practices

1. **Component composition** - Small, reusable components
2. **Memoization** - Use `useMemo` and `useCallback` for expensive operations
3. **Error boundaries** - Wrap components to catch errors gracefully
4. **Loading states** - Always show loading indicators
5. **Accessibility** - Use semantic HTML and ARIA attributes
