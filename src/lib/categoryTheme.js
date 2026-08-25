/**
 * Category Theme & Color System
 * Provides distinctive, vibrant, and customizable color schemes for each product category.
 */

export const AVAILABLE_CATEGORY_COLORS = [
  {
    id: 'emerald',
    label: 'Emerald Green',
    hex: '#10b981',
    keywords: ['fruit', 'veg', 'vegetable', 'produce', 'organic', 'green', 'fresh', 'herb', 'leafy', 'onion', 'potato', 'tomato', 'ginger', 'garlic'],
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800',
    solid: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-400 dark:border-emerald-600',
    dot: 'bg-emerald-500',
    lightBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    topBar: 'bg-emerald-500',
    tabInactive: 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60'
  },
  {
    id: 'amber',
    label: 'Golden Amber',
    hex: '#f59e0b',
    keywords: ['grain', 'cereal', 'staple', 'rice', 'atta', 'flour', 'pulse', 'dal', 'wheat', 'sugar', 'jaggery', 'suji', 'rava', 'maida', 'besan', 'poha', 'grocery', 'groceries'],
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800',
    solid: 'bg-amber-600 text-white shadow-sm shadow-amber-600/25',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-400 dark:border-amber-600',
    dot: 'bg-amber-500',
    lightBg: 'bg-amber-500/10 dark:bg-amber-500/15',
    topBar: 'bg-amber-500',
    tabInactive: 'border-amber-300 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60'
  },
  {
    id: 'sky',
    label: 'Sky Blue',
    hex: '#0ea5e9',
    keywords: ['dairy', 'milk', 'butter', 'ghee', 'cheese', 'paneer', 'curd', 'yogurt', 'cream'],
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-300 dark:border-sky-800',
    solid: 'bg-sky-600 text-white shadow-sm shadow-sky-600/25',
    text: 'text-sky-600 dark:text-sky-400',
    border: 'border-sky-400 dark:border-sky-600',
    dot: 'bg-sky-500',
    lightBg: 'bg-sky-500/10 dark:bg-sky-500/15',
    topBar: 'bg-sky-500',
    tabInactive: 'border-sky-300 dark:border-sky-800/80 bg-sky-50/70 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-950/60'
  },
  {
    id: 'rose',
    label: 'Crimson Rose',
    hex: '#f43f5e',
    keywords: ['spice', 'masala', 'chilli', 'pepper', 'turmeric', 'clove', 'cardamom', 'cumin', 'mustard', 'coriander', 'condiment', 'seasoning'],
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800',
    solid: 'bg-rose-600 text-white shadow-sm shadow-rose-600/25',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-400 dark:border-rose-600',
    dot: 'bg-rose-500',
    lightBg: 'bg-rose-500/10 dark:bg-rose-500/15',
    topBar: 'bg-rose-500',
    tabInactive: 'border-rose-300 dark:border-rose-800/80 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60'
  },
  {
    id: 'purple',
    label: 'Royal Purple',
    hex: '#a855f7',
    keywords: ['beverage', 'drink', 'tea', 'chai', 'coffee', 'juice', 'soda', 'cola', 'water', 'energy', 'squash'],
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800',
    solid: 'bg-purple-600 text-white shadow-sm shadow-purple-600/25',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-400 dark:border-purple-600',
    dot: 'bg-purple-500',
    lightBg: 'bg-purple-500/10 dark:bg-purple-500/15',
    topBar: 'bg-purple-500',
    tabInactive: 'border-purple-300 dark:border-purple-800/80 bg-purple-50/70 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-950/60'
  },
  {
    id: 'orange',
    label: 'Warm Orange',
    hex: '#f97316',
    keywords: ['bakery', 'bread', 'bun', 'cake', 'pastry', 'biscuit', 'cookie', 'toast', 'rusk'],
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border border-orange-300 dark:border-orange-800',
    solid: 'bg-orange-600 text-white shadow-sm shadow-orange-600/25',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-400 dark:border-orange-600',
    dot: 'bg-orange-500',
    lightBg: 'bg-orange-500/10 dark:bg-orange-500/15',
    topBar: 'bg-orange-500',
    tabInactive: 'border-orange-300 dark:border-orange-800/80 bg-orange-50/70 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/60'
  },
  {
    id: 'fuchsia',
    label: 'Vibrant Fuchsia',
    hex: '#d946ef',
    keywords: ['snack', 'namkeen', 'chips', 'crisp', 'biscuit', 'chocolate', 'sweet', 'candy', 'noodle', 'pasta', 'munch'],
    badge: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/80 dark:text-fuchsia-300 border border-fuchsia-300 dark:border-fuchsia-800',
    solid: 'bg-fuchsia-600 text-white shadow-sm shadow-fuchsia-600/25',
    text: 'text-fuchsia-600 dark:text-fuchsia-400',
    border: 'border-fuchsia-400 dark:border-fuchsia-600',
    dot: 'bg-fuchsia-500',
    lightBg: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/15',
    topBar: 'bg-fuchsia-500',
    tabInactive: 'border-fuchsia-300 dark:border-fuchsia-800/80 bg-fuchsia-50/70 dark:bg-fuchsia-950/30 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-950/60'
  },
  {
    id: 'yellow',
    label: 'Sunflower Yellow',
    hex: '#eab308',
    keywords: ['oil', 'ghee', 'mustard oil', 'sunflower', 'edible oil', 'coconut oil'],
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/80 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-800',
    solid: 'bg-yellow-600 text-white shadow-sm shadow-yellow-600/25',
    text: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-400 dark:border-yellow-600',
    dot: 'bg-yellow-500',
    lightBg: 'bg-yellow-500/10 dark:bg-yellow-500/15',
    topBar: 'bg-yellow-500',
    tabInactive: 'border-yellow-300 dark:border-yellow-800/80 bg-yellow-50/70 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-950/60'
  },
  {
    id: 'teal',
    label: 'Mint Teal',
    hex: '#14b8a6',
    keywords: ['personal', 'soap', 'shampoo', 'toothpaste', 'brush', 'cosmetic', 'cream', 'lotion', 'face', 'hair', 'hygiene'],
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-300 dark:border-teal-800',
    solid: 'bg-teal-600 text-white shadow-sm shadow-teal-600/25',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-400 dark:border-teal-600',
    dot: 'bg-teal-500',
    lightBg: 'bg-teal-500/10 dark:bg-teal-500/15',
    topBar: 'bg-teal-500',
    tabInactive: 'border-teal-300 dark:border-teal-800/80 bg-teal-50/70 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-950/60'
  },
  {
    id: 'indigo',
    label: 'Indigo Blue',
    hex: '#6366f1',
    keywords: ['cleaning', 'household', 'detergent', 'dish', 'wash', 'cleaner', 'mop', 'broom', 'phenyl', 'harpic'],
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800',
    solid: 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-400 dark:border-indigo-600',
    dot: 'bg-indigo-500',
    lightBg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    topBar: 'bg-indigo-500',
    tabInactive: 'border-indigo-300 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/60'
  },
  {
    id: 'cyan',
    label: 'Cyan Blue',
    hex: '#06b6d4',
    keywords: ['service', 'repair', 'labor', 'tailoring', 'charge', 'delivery'],
    badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800',
    solid: 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/25',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-400 dark:border-cyan-600',
    dot: 'bg-cyan-500',
    lightBg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    topBar: 'bg-cyan-500',
    tabInactive: 'border-cyan-300 dark:border-cyan-800/80 bg-cyan-50/70 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-950/60'
  },
  {
    id: 'lime',
    label: 'Lime Green',
    hex: '#84cc16',
    keywords: ['lime', 'citrus', 'lemon', 'garden', 'plants', 'seeds'],
    badge: 'bg-lime-100 text-lime-800 dark:bg-lime-950/80 dark:text-lime-300 border border-lime-300 dark:border-lime-800',
    solid: 'bg-lime-600 text-white shadow-sm shadow-lime-600/25',
    text: 'text-lime-700 dark:text-lime-400',
    border: 'border-lime-400 dark:border-lime-600',
    dot: 'bg-lime-500',
    lightBg: 'bg-lime-500/10 dark:bg-lime-500/15',
    topBar: 'bg-lime-500',
    tabInactive: 'border-lime-300 dark:border-lime-800/80 bg-lime-50/70 dark:bg-lime-950/30 text-lime-700 dark:text-lime-300 hover:bg-lime-100 dark:hover:bg-lime-950/60'
  },
  {
    id: 'pink',
    label: 'Blush Pink',
    hex: '#ec4899',
    keywords: ['baby', 'perfume', 'fragrance', 'flowers', 'gift', 'beauty'],
    badge: 'bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300 border border-pink-300 dark:border-pink-800',
    solid: 'bg-pink-600 text-white shadow-sm shadow-pink-600/25',
    text: 'text-pink-600 dark:text-pink-400',
    border: 'border-pink-400 dark:border-pink-600',
    dot: 'bg-pink-500',
    lightBg: 'bg-pink-500/10 dark:bg-pink-500/15',
    topBar: 'bg-pink-500',
    tabInactive: 'border-pink-300 dark:border-pink-800/80 bg-pink-50/70 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-950/60'
  },
  {
    id: 'violet',
    label: 'Deep Violet',
    hex: '#8b5cf6',
    keywords: ['luxury', 'stationery', 'crafts', 'toys', 'books'],
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300 border border-violet-300 dark:border-violet-800',
    solid: 'bg-violet-600 text-white shadow-sm shadow-violet-600/25',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-400 dark:border-violet-600',
    dot: 'bg-violet-500',
    lightBg: 'bg-violet-500/10 dark:bg-violet-500/15',
    topBar: 'bg-violet-500',
    tabInactive: 'border-violet-300 dark:border-violet-800/80 bg-violet-50/70 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-950/60'
  },
  {
    id: 'blue',
    label: 'Classic Blue',
    hex: '#3b82f6',
    keywords: ['general', 'stationery', 'hardware', 'tools', 'electric'],
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800',
    solid: 'bg-blue-600 text-white shadow-sm shadow-blue-600/25',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-400 dark:border-blue-600',
    dot: 'bg-blue-500',
    lightBg: 'bg-blue-500/10 dark:bg-blue-500/15',
    topBar: 'bg-blue-500',
    tabInactive: 'border-blue-300 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/60'
  }
];

/**
 * Returns color theme for a category by its custom color property, name, or ID.
 * @param {string|object} cat Category object, color ID, or name
 * @returns {object} Complete Theme object
 */
export function getCategoryTheme(cat) {
  // 1. Explicit color property set on category object (e.g. cat.color = 'rose')
  if (typeof cat === 'object' && cat && cat.color) {
    const matched = AVAILABLE_CATEGORY_COLORS.find(
      (c) => c.id === cat.color || c.hex?.toLowerCase() === String(cat.color).toLowerCase()
    );
    if (matched) return matched;
  }

  // 2. Direct color ID string (e.g. getCategoryTheme('emerald'))
  if (typeof cat === 'string') {
    const directMatch = AVAILABLE_CATEGORY_COLORS.find((c) => c.id === cat.toLowerCase().trim());
    if (directMatch) return directMatch;
  }

  const catName = typeof cat === 'object' && cat ? (cat.name || cat.id || '') : String(cat || '');
  const clean = catName.toLowerCase().trim();

  if (!clean || clean === 'all' || clean === 'default' || clean === 'all items') {
    return {
      id: 'indigo',
      label: 'All Items',
      hex: '#4f46e5',
      badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700',
      solid: 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-400 dark:border-indigo-600',
      dot: 'bg-indigo-500',
      lightBg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
      topBar: 'bg-indigo-500',
      tabInactive: 'surface border border-[color:var(--border)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
    };
  }

  // 3. Keyword-based matching
  for (const entry of AVAILABLE_CATEGORY_COLORS) {
    if (entry.keywords && entry.keywords.some((kw) => clean.includes(kw))) {
      return entry;
    }
  }

  // 4. Deterministic hash-based rotation for user categories
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % AVAILABLE_CATEGORY_COLORS.length;
  return AVAILABLE_CATEGORY_COLORS[idx];
}

/**
 * Returns a new, unused color id from AVAILABLE_CATEGORY_COLORS for newly created categories.
 * @param {Array} existingCategories List of current categories
 * @returns {string} color ID e.g. 'emerald'
 */
export function getNextAvailableColor(existingCategories = []) {
  const usedColors = new Set(
    (existingCategories || [])
      .map((c) => c.color || getCategoryTheme(c)?.id)
      .filter(Boolean)
  );

  for (const color of AVAILABLE_CATEGORY_COLORS) {
    if (!usedColors.has(color.id)) {
      return color.id;
    }
  }

  // If all colors are used, pick next sequentially
  const nextIdx = (existingCategories || []).length % AVAILABLE_CATEGORY_COLORS.length;
  return AVAILABLE_CATEGORY_COLORS[nextIdx].id;
}
