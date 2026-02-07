---
name: UI/UX Design Patterns
description: Modern design patterns for visual hierarchy, color, typography, and layouts
---

# UI/UX Design Patterns

## Color System

### Semantic Colors
```css
:root {
  /* Success/Positive (Gainers) */
  --color-success: #22c55e;
  --color-success-light: #dcfce7;
  --color-success-dark: #16a34a;
  
  /* Error/Negative (Losers) */
  --color-error: #ef4444;
  --color-error-light: #fee2e2;
  --color-error-dark: #dc2626;
  
  /* Warning */
  --color-warning: #f59e0b;
  --color-warning-light: #fef3c7;
  
  /* Info/Primary */
  --color-info: #3b82f6;
  --color-info-light: #dbeafe;
  
  /* Neutral */
  --color-muted: #64748b;
  --color-border: #e2e8f0;
  --color-bg: #f8fafc;
}
```

### Color-Coded Data Pattern
```jsx
// Apply color based on data value
const getColorClass = (value) => {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
};

// CSS
.positive { color: var(--color-success); }
.negative { color: var(--color-error); }
.neutral { color: var(--color-muted); }
```

## Card Design

### Modern Card with Gradient
```css
.card {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.25s ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}
```

### Status-Colored Cards
```css
.card.success {
  background: linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%);
  border-color: #86efac;
}

.card.error {
  background: linear-gradient(135deg, #ffffff 0%, #fef2f2 100%);
  border-color: #fecaca;
}

.card.info {
  background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);
  border-color: #93c5fd;
}
```

## Typography Scale

```css
:root {
  /* Font Sizes */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 2rem;      /* 32px */
  
  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  --font-black: 900;
}

/* Metric/Number Display */
.metric-value {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  letter-spacing: -0.02em;
  line-height: 1;
}

.metric-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

## Button Styles

### Primary Button
```css
.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}
```

### Pill/Tab Button
```css
.tab-btn {
  padding: 8px 16px;
  border-radius: 999px;
  background: #f1f5f9;
  border: 1px solid transparent;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  background: #e2e8f0;
}

.tab-btn.active {
  background: #1e293b;
  color: white;
}
```

## Spacing System

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
}
```

## Shadow System

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
  
  /* Colored shadows for depth */
  --shadow-success: 0 4px 14px rgba(34, 197, 94, 0.25);
  --shadow-error: 0 4px 14px rgba(239, 68, 68, 0.25);
  --shadow-primary: 0 4px 14px rgba(59, 130, 246, 0.25);
}
```

## Layout Patterns

### Metric Grid
```css
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}
```

### Card Grid
```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}
```

## Best Practices

1. **Visual Hierarchy**: Use size, weight, and color to establish importance
2. **Whitespace**: Don't be afraid of generous padding/margins
3. **Consistency**: Use design tokens (CSS variables) throughout
4. **Feedback**: Every interactive element needs hover/active states
5. **Accessibility**: Maintain 4.5:1 contrast ratio for text
