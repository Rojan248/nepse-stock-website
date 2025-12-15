/**
 * Application Constants & Theme Configuration
 */

// ============================================
// THEME - Hybrid Minimal + Light Glass Dark Fintech
// ============================================

export const THEME = {
  // Colors - Dark Fintech Palette
  colors: {
    // Primary Background (Ultra Dark)
    BG_MAIN: '#050816',
    BG_MAIN_RGB: '5, 8, 22',

    // Secondary Background (Elevated)
    BG_ELEVATED: '#0B1020',
    BG_ELEVATED_RGB: '11, 16, 32',

    // Glass Background (for future glass effects)
    GLASS_BG: 'rgba(15, 23, 42, 0.7)',
    GLASS_BG_DARK: 'rgba(5, 8, 22, 0.85)',

    // Tertiary (Cards)
    BG_TERTIARY: '#111729',
    BG_HOVER: '#1A1F35',

    // Accent Colors
    PRIMARY: '#3B82F6',
    PRIMARY_SOFT: '#60A5FA',
    PRIMARY_LIGHTER: '#93C5FD',

    SUCCESS: '#22C55E',
    SUCCESS_SOFT: '#86EFAC',

    WARNING: '#F59E0B',
    DANGER: '#F97373',
    DANGER_SOFT: '#FCA5A5',

    // Text
    TEXT_MAIN: '#E5E7EB',
    TEXT_SECONDARY: '#B0B5C0',
    TEXT_MUTED: '#9CA3AF',
    TEXT_DISABLED: '#6B7280',

    // Borders
    BORDER_SUBTLE: 'rgba(148, 163, 184, 0.35)',
    BORDER_LIGHT: 'rgba(203, 213, 225, 0.15)',
    BORDER_MEDIUM: 'rgba(148, 163, 184, 0.5)',
  },

  // Spacing Scale (Rem-based)
  spacing: {
    XS: '0.25rem',   // 4px
    SM: '0.5rem',    // 8px
    MD: '1rem',      // 16px
    LG: '1.5rem',    // 24px
    XL: '2rem',      // 32px
    XL2: '3rem',     // 48px
    XL3: '4rem',     // 64px
  },

  // Border Radius
  radii: {
    SM: '8px',
    MD: '12px',
    LG: '16px',
    XL: '20px',
    FULL: '9999px',
  },

  // Shadows
  shadows: {
    SOFT: '0 18px 45px rgba(0, 0, 0, 0.55)',
    MD: '0 8px 16px rgba(0, 0, 0, 0.3)',
    SM: '0 4px 8px rgba(0, 0, 0, 0.15)',
    NONE: 'none',
    INSET: 'inset 0 1px 2px rgba(0, 0, 0, 0.3)',
  },

  // Transitions
  transitions: {
    FAST: '150ms ease',
    NORMAL: '300ms ease',
    SLOW: '500ms ease',
  },
};

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Market Hours (Nepal Standard Time)
export const MARKET_OPEN_HOUR = 10;
export const MARKET_OPEN_MINUTE = 0;
export const MARKET_CLOSE_HOUR = 15;
export const MARKET_CLOSE_MINUTE = 0;

// Update Intervals (milliseconds)
export const REFRESH_INTERVAL = 10000; // 10 seconds for auto-refresh
export const SEARCH_DEBOUNCE = 300; // 300ms debounce for search

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const ITEMS_PER_PAGE = 20;

// IPO Statuses
export const IPO_STATUSES = [
    { value: 'all', label: 'All IPOs' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'completed', label: 'Completed' }
];

// Stock Sectors (common NEPSE sectors)
export const SECTORS = [
    'Commercial Banks',
    'Development Banks',
    'Finance',
    'Microfinance',
    'Life Insurance',
    'Non-Life Insurance',
    'Hotels',
    'Hydropower',
    'Investment',
    'Manufacturing And Processing',
    'Mutual Fund',
    'Trading',
    'Others'
];

// Sort Options
export const SORT_OPTIONS = [
    { value: 'symbol', label: 'Symbol' },
    { value: 'companyName', label: 'Company Name' },
    { value: 'ltp', label: 'Price' },
    { value: 'change', label: 'Change' },
    { value: 'changePercent', label: 'Change %' },
    { value: 'volume', label: 'Volume' }
];
