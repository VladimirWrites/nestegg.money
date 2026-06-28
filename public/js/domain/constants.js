// Shared domain constants. No imports, no side effects.

// Supported currencies (EUR is always the 1.0 base for conversion).
export const CCYS = ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "SEK", "NOK", "DKK", "PLN"];

// Offline fallback FX table (per EUR), used until live rates are fetched.
export const FALLBACK_FX = { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.96, JPY: 170, CAD: 1.47, AUD: 1.64, SEK: 11.4, NOK: 11.7, DKK: 7.46, PLN: 4.3 };

// Chart series colour cycle.
export const PALETTE = ["#4aa3ff", "#ff8c1a", "#3ad17a", "#ffd23a", "#ff4d6d", "#9b8cff", "#2fd0c8", "#ffb000", "#7aa0ff", "#e06be0", "#9ad13a", "#ff7847"];

// Starter categories for a fresh budget (separate from net-worth categories — spending, not assets).
export const DEFAULT_BUDGET_CATEGORIES = ["Housing", "Food", "Transport", "Utilities", "Health", "Leisure", "Savings"];

// Schema version written by migrate().
export const SCHEMA_VERSION = 6;

// Tombstone buckets for cross-device deletions, keyed by record kind.
export const DEL_KINDS = ["asset", "snap", "sper", "sent", "yent"];
