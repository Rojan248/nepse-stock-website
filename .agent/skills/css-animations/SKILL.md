---
name: CSS Animations & Transitions
description: Patterns for smooth animations, micro-interactions, and motion design
---

# CSS Animations & Transitions

## Core Animation Utilities

### Transition Presets
```css
/* Standard timing functions */
:root {
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-quad: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  
  /* Duration scale */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
}
```

### Hover Lift Effect
```css
.card {
  transition: transform 0.25s var(--ease-out-expo), 
              box-shadow 0.25s var(--ease-out-expo);
}

.card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}
```

### Fade In Animation
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in {
  animation: fadeIn 0.4s var(--ease-out-expo) forwards;
}
```

### Staggered List Animation
```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.list-item {
  opacity: 0;
  animation: slideUp 0.4s var(--ease-out-expo) forwards;
}

/* Stagger each item */
.list-item:nth-child(1) { animation-delay: 0ms; }
.list-item:nth-child(2) { animation-delay: 50ms; }
.list-item:nth-child(3) { animation-delay: 100ms; }
.list-item:nth-child(4) { animation-delay: 150ms; }
.list-item:nth-child(5) { animation-delay: 200ms; }
```

### Pulse/Glow Effect
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.loading {
  animation: pulse 1.5s ease-in-out infinite;
}

/* Glow effect for badges */
@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px rgba(34, 197, 94, 0.4); }
  50% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.8); }
}

.badge-live {
  animation: glow 2s ease-in-out infinite;
}
```

### Scale on Click
```css
.button {
  transition: transform 0.1s ease;
}

.button:active {
  transform: scale(0.95);
}
```

### Skeleton Loading
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### Spinner
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
```

## Micro-Interactions

### Button Hover States
```css
.btn-primary {
  background: #3b82f6;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: none;
}
```

### Icon Rotation
```css
.accordion-icon {
  transition: transform 0.3s var(--ease-out-expo);
}

.accordion.open .accordion-icon {
  transform: rotate(180deg);
}
```

### Progress Bar Animation
```css
@keyframes progressFill {
  from { width: 0; }
}

.progress-bar {
  animation: progressFill 1s var(--ease-out-expo) forwards;
}
```

## Best Practices

1. **Performance**: Use `transform` and `opacity` for animations (GPU accelerated)
2. **Duration**: Keep animations under 400ms for responsiveness
3. **Easing**: Use `ease-out` for enter animations, `ease-in` for exits
4. **Accessibility**: Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

5. **Stagger delays**: 50-100ms between items for list animations

---

## Scroll-Triggered Animations

### CSS-Only Scroll Animation (Modern Browsers)
```css
/* Fade in on scroll using animation-timeline */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.scroll-reveal {
  animation: fadeInUp linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 30%;
}
```

### Intersection Observer Pattern (React)
```jsx
// useScrollReveal.js
import { useEffect, useRef, useState } from 'react';

export function useScrollReveal(threshold = 0.1) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Only animate once
        }
      },
      { threshold }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

// Usage in component
function Card({ children }) {
  const { ref, isVisible } = useScrollReveal();
  
  return (
    <div 
      ref={ref} 
      className={`card ${isVisible ? 'visible' : ''}`}
    >
      {children}
    </div>
  );
}
```

### Scroll Reveal CSS Classes
```css
/* Initial hidden state */
.scroll-fade {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.scroll-fade.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Slide from left */
.scroll-slide-left {
  opacity: 0;
  transform: translateX(-30px);
  transition: all 0.5s var(--ease-out-expo);
}

.scroll-slide-left.visible {
  opacity: 1;
  transform: translateX(0);
}

/* Scale up */
.scroll-scale {
  opacity: 0;
  transform: scale(0.9);
  transition: all 0.5s var(--ease-out-expo);
}

.scroll-scale.visible {
  opacity: 1;
  transform: scale(1);
}

/* Staggered children */
.scroll-stagger.visible > *:nth-child(1) { transition-delay: 0ms; }
.scroll-stagger.visible > *:nth-child(2) { transition-delay: 100ms; }
.scroll-stagger.visible > *:nth-child(3) { transition-delay: 200ms; }
.scroll-stagger.visible > *:nth-child(4) { transition-delay: 300ms; }
```

---

## Glassmorphism

### Basic Glass Card
```css
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
```

### Dark Glass Card
```css
.glass-card-dark {
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

### Glass Header/Navbar
```css
.glass-header {
  position: sticky;
  top: 0;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  z-index: 100;
}
```

### Frosted Glass Button
```css
.glass-btn {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  padding: 12px 24px;
  color: white;
  transition: all 0.2s ease;
}

.glass-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}
```

### Glass with Gradient Border
```css
.glass-gradient {
  position: relative;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(16px);
  border-radius: 16px;
  padding: 24px;
}

.glass-gradient::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 16px;
  padding: 1px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.4),
    rgba(255, 255, 255, 0.1)
  );
  -webkit-mask: 
    linear-gradient(#fff 0 0) content-box, 
    linear-gradient(#fff 0 0);
  mask: 
    linear-gradient(#fff 0 0) content-box, 
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
```

### Glassmorphism Requirements
```css
/* Needs a colorful background behind the glass element */
body {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  /* Or use a background image */
}
```

