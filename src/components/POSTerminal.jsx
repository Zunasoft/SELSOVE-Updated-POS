import React, { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, Printer, Scale, Barcode,
  QrCode, PauseCircle, X, Receipt, User, UserPlus, Lock, Unlock, ArrowDownToLine,
  ArrowUpFromLine, LayoutGrid, Star, RotateCcw, Wallet, CheckCircle2,
  Flame, ArrowUpDown, Clock, History, Zap, FileCheck, CreditCard,
  Coins, Building2, Sparkles, PlusCircle, MinusCircle, AlertCircle, CheckCheck,
  TrendingUp, TrendingDown, Filter, ArrowRight, Users
} from 'lucide-react';

import api, { money, fmtDateTime, fmtDate, API_BASE } from '../lib/api';
import {
  Panel, Button, Modal, Field, Input, Select, Textarea, Badge, Money,
  Spinner, EmptyState, SegmentedControl, DataTable, StatTile
} from '../lib/ui';
import { getCategoryTheme } from '../lib/categoryTheme';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Credit (Udhar)', 'Partial Payment'];
const DISCOUNT_PRESETS = [0, 5, 10, 15, 20];

export function getProductImageUrl(url, name = '', barcode = '') {
  // 1. Manually uploaded or custom image takes absolute top priority!
  if (url && typeof url === 'string') {
    const trimmed = url.trim();
    if (trimmed) {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
        return trimmed;
      }
      if (trimmed.startsWith('/')) {
        return `${API_BASE.replace('/api/pos', '')}${trimmed}`;
      }
      return trimmed;
    }
  }

  // 2. Auto-generate real product photo URL based on name/barcode
  if (name && typeof name === 'string' && name.trim()) {
    return getProductAutoImageUrl(name, barcode);
  }

  return 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=350&auto=format&fit=crop&q=80';
}

const PRODUCT_KEYWORD_MAP = [
  // Technology & Computer Peripherals
  { keywords: ['wireless mouse', 'mouse'], icon: '🖱️', photo: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=350&auto=format&fit=crop&q=80', gradient: 'from-slate-600 to-slate-800' },
  { keywords: ['keyboard usb', 'keyboard'], icon: '⌨️', photo: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=350&auto=format&fit=crop&q=80', gradient: 'from-slate-700 to-zinc-900' },
  { keywords: ['wifi router', 'router', 'wifi'], icon: '📡', photo: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=350&auto=format&fit=crop&q=80', gradient: 'from-blue-600 to-indigo-800' },
  { keywords: ['bluetooth speaker', 'speaker'], icon: '🔊', photo: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=350&auto=format&fit=crop&q=80', gradient: 'from-indigo-600 to-purple-800' },
  { keywords: ['power bank'], icon: '🔋', photo: 'https://images.unsplash.com/photo-1609592807664-4a4be1a7b4fa?w=350&auto=format&fit=crop&q=80', gradient: 'from-zinc-700 to-slate-900' },
  { keywords: ['mobile charger', 'charger', 'adapter'], icon: '🔌', photo: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=350&auto=format&fit=crop&q=80', gradient: 'from-emerald-600 to-teal-800' },
  { keywords: ['usb cable', 'type-c', 'lan cable', 'hdmi cable', 'cable'], icon: '🔌', photo: 'https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=350&auto=format&fit=crop&q=80', gradient: 'from-cyan-600 to-blue-700' },
  { keywords: ['printer ink', 'ink cartridge', 'toner'], icon: '🖨️', photo: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=350&auto=format&fit=crop&q=80', gradient: 'from-slate-600 to-slate-900' },
  { keywords: ['extension box', 'socket', 'power strip'], icon: '🔌', photo: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-600 to-orange-700' },
  { keywords: ['led bulb', 'bulb', 'light'], icon: '💡', photo: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=350&auto=format&fit=crop&q=80', gradient: 'from-yellow-400 to-amber-600' },
  { keywords: ['mobile', 'phone', 'smartphone', 'earphone', 'headphone'], icon: '📱', photo: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=350&auto=format&fit=crop&q=80', gradient: 'from-slate-700 to-slate-900' },

  // Kitchen Appliances & Utensils
  { keywords: ['electric kettle', 'kettle'], icon: '🫖', photo: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=350&auto=format&fit=crop&q=80', gradient: 'from-slate-500 to-stone-700' },
  { keywords: ['lunch box', 'tiffin'], icon: '🍱', photo: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?w=350&auto=format&fit=crop&q=80', gradient: 'from-emerald-600 to-teal-700' },
  { keywords: ['table fan', 'fan'], icon: '🌀', photo: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=350&auto=format&fit=crop&q=80', gradient: 'from-sky-500 to-blue-700' },
  { keywords: ['kitchen knife', 'knife'], icon: '🔪', photo: 'https://images.unsplash.com/photo-1593618998160-e34014e67546?w=350&auto=format&fit=crop&q=80', gradient: 'from-zinc-600 to-slate-800' },
  { keywords: ['stainless steel spoon', 'spoon', 'fork', 'cutlery'], icon: '🥄', photo: 'https://images.unsplash.com/photo-1616788494707-ec28f08d05a1?w=350&auto=format&fit=crop&q=80', gradient: 'from-slate-400 to-stone-600' },
  { keywords: ['tea glass', 'steel tumbler', 'tumbler', 'glass'], icon: '🥛', photo: 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-600 to-yellow-700' },
  { keywords: ['steel plate', 'plate', 'dish'], icon: '🍽️', photo: 'https://images.unsplash.com/photo-1603199506016-b9e594b5931a?w=350&auto=format&fit=crop&q=80', gradient: 'from-slate-400 to-zinc-600' },
  { keywords: ['water bottle', 'bottle'], icon: '🍶', photo: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=350&auto=format&fit=crop&q=80', gradient: 'from-cyan-500 to-blue-600' },
  { keywords: ['plastic storage box', 'storage box', 'container'], icon: '📦', photo: 'https://images.unsplash.com/photo-1614735241165-6756e1df61ab?w=350&auto=format&fit=crop&q=80', gradient: 'from-blue-500 to-indigo-600' },
  { keywords: ['plastic bucket', 'bucket'], icon: '🪣', photo: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=350&auto=format&fit=crop&q=80', gradient: 'from-blue-600 to-cyan-700' },

  // Cleaning & Household
  { keywords: ['garbage bags', 'garbage bag', 'trash bag'], icon: '🗑️', photo: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=350&auto=format&fit=crop&q=80', gradient: 'from-zinc-700 to-stone-900' },
  { keywords: ['floor mop refill', 'floor mop', 'mop'], icon: '🧹', photo: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=350&auto=format&fit=crop&q=80', gradient: 'from-blue-500 to-teal-600' },
  { keywords: ['broom stick', 'broom'], icon: '🧹', photo: 'https://images.unsplash.com/photo-1585670270608-b4be2f629c15?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-600 to-yellow-800' },
  { keywords: ['dustpan'], icon: '🧹', photo: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=350&auto=format&fit=crop&q=80', gradient: 'from-slate-600 to-zinc-700' },
  { keywords: ['glass cleaner'], icon: '🧴', photo: 'https://images.unsplash.com/photo-1585670270608-b4be2f629c15?w=350&auto=format&fit=crop&q=80', gradient: 'from-cyan-400 to-blue-600' },
  { keywords: ['phenyl', 'disinfectant'], icon: '🧴', photo: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=350&auto=format&fit=crop&q=80', gradient: 'from-emerald-500 to-teal-700' },
  { keywords: ['toilet cleaner', 'harpic'], icon: '🧴', photo: 'https://images.unsplash.com/photo-1585670270608-b4be2f629c15?w=350&auto=format&fit=crop&q=80', gradient: 'from-blue-600 to-indigo-700' },
  { keywords: ['dishwash liquid', 'dishwash'], icon: '🧴', photo: 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=350&auto=format&fit=crop&q=80', gradient: 'from-emerald-500 to-green-600' },
  { keywords: ['hand wash', 'handwash'], icon: '🧴', photo: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=350&auto=format&fit=crop&q=80', gradient: 'from-teal-400 to-cyan-600' },
  { keywords: ['detergent liquid', 'detergent powder', 'detergent', 'washing powder'], icon: '🧼', photo: 'https://images.unsplash.com/photo-1585670270608-b4be2f629c15?w=350&auto=format&fit=crop&q=80', gradient: 'from-blue-500 to-indigo-600' },
  { keywords: ['bath soap', 'soap', 'soaps', 'sabun'], icon: '🧼', photo: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=350&auto=format&fit=crop&q=80', gradient: 'from-teal-400 to-cyan-600' },
  { keywords: ['shampoo', 'conditioner'], icon: '🧴', photo: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=350&auto=format&fit=crop&q=80', gradient: 'from-purple-400 to-indigo-600' },
  { keywords: ['toothpaste'], icon: '🪥', photo: 'https://images.unsplash.com/photo-1559591937-e10f135b1d44?w=350&auto=format&fit=crop&q=80', gradient: 'from-blue-400 to-teal-500' },
  { keywords: ['toothbrush'], icon: '🪥', photo: 'https://images.unsplash.com/photo-1559591937-e10f135b1d44?w=350&auto=format&fit=crop&q=80', gradient: 'from-sky-400 to-blue-600' },

  // Dairy & Refrigerated
  { keywords: ['paneer', 'cottage cheese'], icon: '🧀', photo: 'https://images.unsplash.com/photo-1568909344668-6f14a07b56a0?w=350&auto=format&fit=crop&q=80', gradient: 'from-sky-400 to-indigo-600' },
  { keywords: ['butter', 'makhan', 'amul butter'], icon: '🧈', photo: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-400 to-yellow-600' },
  { keywords: ['ghee', 'desi ghee'], icon: '🧈', photo: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=350&auto=format&fit=crop&q=80', gradient: 'from-yellow-500 to-amber-600' },
  { keywords: ['cheese', 'cheddar', 'mozzarella', 'cheese slice'], icon: '🧀', photo: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-400 to-orange-500' },
  { keywords: ['curd', 'dahi', 'yogurt', 'lassi'], icon: '🥣', photo: 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=350&auto=format&fit=crop&q=80', gradient: 'from-blue-400 to-sky-600' },
  { keywords: ['milk', 'dairy', 'taaza'], icon: '🥛', photo: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=350&auto=format&fit=crop&q=80', gradient: 'from-sky-500 to-blue-700' },
  { keywords: ['ice', 'ice cubes'], icon: '🧊', photo: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=350&auto=format&fit=crop&q=80', gradient: 'from-cyan-300 to-blue-500' },

  // Cooking Oils & Seeds
  { keywords: ['coconut oil'], icon: '🛢️', photo: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=350&auto=format&fit=crop&q=80', gradient: 'from-emerald-500 to-teal-700' },
  { keywords: ['groundnut oil', 'peanut oil'], icon: '🛢️', photo: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-500 to-yellow-600' },
  { keywords: ['mustard seeds', 'rai', 'sarson'], icon: '🫘', photo: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=350&auto=format&fit=crop&q=80', gradient: 'from-stone-600 to-amber-800' },
  { keywords: ['mustard oil'], icon: '🛢️', photo: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=350&auto=format&fit=crop&q=80', gradient: 'from-yellow-500 to-amber-700' },
  { keywords: ['cooking oil', 'sunflower oil', 'refined oil', 'oil'], icon: '🛢️', photo: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=350&auto=format&fit=crop&q=80', gradient: 'from-yellow-400 to-amber-600' },

  // Grains, Flour, Pulses, Sugar & Spices
  { keywords: ['poha', 'flattened rice'], icon: '🥣', photo: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-200 to-yellow-400' },
  { keywords: ['vermicelli', 'seviyan'], icon: '🍜', photo: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-300 to-yellow-500' },
  { keywords: ['tamarind', 'imli'], icon: '🌰', photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Tamarindus_indica_pods.JPG/500px-Tamarindus_indica_pods.JPG', gradient: 'from-amber-800 to-stone-900' },
  { keywords: ['jaggery', 'gur', 'gud'], icon: '🍯', photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Jaggery_Blocks.jpg/500px-Jaggery_Blocks.jpg', gradient: 'from-amber-600 to-yellow-800' },
  { keywords: ['sugar', 'cheeni', 'sakkar'], icon: '🧂', photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Sucre_blanc_cassonade_complet_rapadura.jpg/500px-Sucre_blanc_cassonade_complet_rapadura.jpg', gradient: 'from-amber-100 to-yellow-300' },
  { keywords: ['salt', 'namak', 'tata salt'], icon: '🧂', photo: 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=350&auto=format&fit=crop&q=80', gradient: 'from-slate-400 to-blue-600' },
  { keywords: ['wheat flour', 'atta', 'flour', 'wheat'], icon: '🌾', photo: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-400 to-yellow-600' },
  { keywords: ['maida'], icon: '🌾', photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/White_flour_in_bowl.jpg/500px-White_flour_in_bowl.jpg', gradient: 'from-stone-300 to-amber-500' },
  { keywords: ['besan', 'gram flour'], icon: '🌾', photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Gram_flour_besan.jpg/500px-Gram_flour_besan.jpg', gradient: 'from-yellow-400 to-amber-600' },
  { keywords: ['rava', 'suji', 'sooji', 'semolina'], icon: '🌾', photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Semolina_suji_rava.jpg/500px-Semolina_suji_rava.jpg', gradient: 'from-yellow-300 to-amber-500' },
  { keywords: ['rice', 'basmati', 'chawal'], icon: '🍚', photo: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-100 to-yellow-300' },
  { keywords: ['toor dal', 'arhar dal', 'dal', 'pulse', 'pulses'], icon: '🫘', photo: 'https://images.unsplash.com/photo-1585994192701-f1a505c8574a?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-500 to-yellow-700' },
  { keywords: ['black pepper', 'kali mirch'], icon: '🌶️', photo: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=350&auto=format&fit=crop&q=80', gradient: 'from-stone-700 to-zinc-900' },
  { keywords: ['cardamom', 'elaichi'], icon: '🌿', photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Cardamom_pods.jpg/500px-Cardamom_pods.jpg', gradient: 'from-emerald-600 to-green-700' },
  { keywords: ['cumin seeds', 'cumin', 'jeera'], icon: '🌿', photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Cumin_seeds.jpg/500px-Cumin_seeds.jpg', gradient: 'from-amber-700 to-stone-800' },
  { keywords: ['chilli powder', 'mirch powder', 'lal mirch'], icon: '🌶️', photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/BolivianChilePowder2.JPG/500px-BolivianChilePowder2.JPG', gradient: 'from-red-600 to-rose-800' },
  { keywords: ['turmeric powder', 'turmeric', 'haldi'], icon: '🧂', photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Turmeric_curcuma_powder.jpg/500px-Turmeric_curcuma_powder.jpg', gradient: 'from-yellow-400 to-amber-600' },

  // Vegetables & Fruits
  { keywords: ['green chilli'], icon: '🌶️', photo: 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=350&auto=format&fit=crop&q=80', gradient: 'from-emerald-500 to-teal-700' },
  { keywords: ['beans', 'french beans'], icon: '🫘', photo: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=350&auto=format&fit=crop&q=80', gradient: 'from-emerald-500 to-green-700' },
  { keywords: ['coriander', 'dhaniya'], icon: '🌿', photo: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=350&auto=format&fit=crop&q=80', gradient: 'from-emerald-500 to-green-700' },
  { keywords: ['cabbage', 'patta gobi'], icon: '🥬', photo: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=350&auto=format&fit=crop&q=80', gradient: 'from-emerald-600 to-green-700' },
  { keywords: ['carrot', 'gajar'], icon: '🥕', photo: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=350&auto=format&fit=crop&q=80', gradient: 'from-orange-500 to-amber-600' },
  { keywords: ['potato', 'potatoes', 'aloo'], icon: '🥔', photo: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-600 to-yellow-700' },
  { keywords: ['tomato', 'tomatoes', 'tamatar'], icon: '🍅', photo: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=350&auto=format&fit=crop&q=80', gradient: 'from-red-500 to-rose-600' },
  { keywords: ['onion', 'onions', 'pyaz'], icon: '🧅', photo: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=350&auto=format&fit=crop&q=80', gradient: 'from-purple-500 to-rose-700' },
  { keywords: ['garlic', 'lehsun'], icon: '🧄', photo: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=350&auto=format&fit=crop&q=80', gradient: 'from-stone-400 to-stone-600' },
  { keywords: ['ginger', 'adrak'], icon: '🫚', photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Koeh-146-no_text.jpg/500px-Koeh-146-no_text.jpg', gradient: 'from-amber-600 to-yellow-700' },
  { keywords: ['lemon', 'nimbu'], icon: '🍋', photo: 'https://images.unsplash.com/photo-1590502593747-42a996133562?w=350&auto=format&fit=crop&q=80', gradient: 'from-yellow-300 to-lime-500' },
  { keywords: ['coconut', 'nariyal'], icon: '🥥', photo: 'https://images.unsplash.com/photo-1544378730-8b5104b18790?w=350&auto=format&fit=crop&q=80', gradient: 'from-stone-600 to-amber-800' },
  { keywords: ['apple', 'apples', 'seb'], icon: '🍎', photo: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=350&auto=format&fit=crop&q=80', gradient: 'from-rose-500 to-red-700' },
  { keywords: ['banana', 'bananas', 'kela'], icon: '🍌', photo: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=350&auto=format&fit=crop&q=80', gradient: 'from-yellow-400 to-amber-500' },
  { keywords: ['mango', 'mangoes', 'aam'], icon: '🥭', photo: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-400 to-orange-500' },
  { keywords: ['orange', 'santre'], icon: '🍊', photo: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=350&auto=format&fit=crop&q=80', gradient: 'from-orange-400 to-amber-600' },

  // Bakery, Snacks & Beverages
  { keywords: ['eggs', 'egg', 'anda'], icon: '🥚', photo: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-300 to-orange-400' },
  { keywords: ['bread'], icon: '🍞', photo: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-500 to-yellow-700' },
  { keywords: ['biscuits', 'biscuit', 'cookie', 'cookies'], icon: '🍪', photo: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-600 to-yellow-800' },
  { keywords: ['candy', 'toffee', 'sweet'], icon: '🍬', photo: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=350&auto=format&fit=crop&q=80', gradient: 'from-pink-400 to-purple-600' },
  { keywords: ['tea powder', 'tea', 'chai'], icon: '☕', photo: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-600 to-yellow-800' },
  { keywords: ['coffee powder', 'coffee'], icon: '☕', photo: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-800 to-amber-950' },
  { keywords: ['juice', 'shake', 'smoothie'], icon: '🧃', photo: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-400 to-orange-600' },
  { keywords: ['coke', 'pepsi', 'soda', 'drink', 'beverage'], icon: '🥤', photo: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=350&auto=format&fit=crop&q=80', gradient: 'from-rose-600 to-red-800' },

  // Stationery & Office
  { keywords: ['stapler'], icon: '📎', photo: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=350&auto=format&fit=crop&q=80', gradient: 'from-slate-600 to-zinc-700' },
  { keywords: ['file folder', 'folder'], icon: '📁', photo: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=350&auto=format&fit=crop&q=80', gradient: 'from-amber-500 to-yellow-600' },
  { keywords: ['printer paper', 'a4 paper', 'a4'], icon: '📄', photo: 'https://images.unsplash.com/photo-1589330694653-ded6df03f754?w=350&auto=format&fit=crop&q=80', gradient: 'from-slate-400 to-zinc-600' },
  { keywords: ['notebook'], icon: '📓', photo: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=350&auto=format&fit=crop&q=80', gradient: 'from-indigo-500 to-purple-600' },
  { keywords: ['ball pen', 'pen'], icon: '✏️', photo: 'https://images.unsplash.com/photo-1585336261026-78c772db317c?w=350&auto=format&fit=crop&q=80', gradient: 'from-blue-500 to-indigo-600' },

  // Services
  { keywords: ['ac repair', 'ac service'], icon: '❄️', photo: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=350&auto=format&fit=crop&q=80', gradient: 'from-cyan-600 to-blue-700' },
  { keywords: ['computer maintenance', 'computer service'], icon: '💻', photo: 'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=350&auto=format&fit=crop&q=80', gradient: 'from-indigo-600 to-slate-800' },
  { keywords: ['repair', 'service'], icon: '🛠️', photo: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=350&auto=format&fit=crop&q=80', gradient: 'from-slate-600 to-stone-800' },

  // Apparel & Combos
  { keywords: ['sports shoes', 'shoes', 'sneakers', 'footwear'], icon: '👟', photo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=350&auto=format&fit=crop&q=80', gradient: 'from-stone-600 to-slate-800' },
  { keywords: ['combo'], icon: '🎁', photo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=350&auto=format&fit=crop&q=80', gradient: 'from-violet-600 to-indigo-700' }
];

const FALLBACK_GRADIENTS = [
  'from-indigo-600 to-purple-700',
  'from-blue-600 to-cyan-700',
  'from-emerald-600 to-teal-700',
  'from-amber-600 to-orange-700',
  'from-rose-600 to-pink-700',
  'from-violet-600 to-fuchsia-700',
  'from-sky-600 to-indigo-700',
  'from-teal-600 to-emerald-700'
];

export function getProductAutoImageUrl(name = '', barcode = '') {
  const clean = String(name || '').toLowerCase().trim();
  if (!clean) return 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=350&auto=format&fit=crop&q=80';

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of PRODUCT_KEYWORD_MAP) {
    if (entry.photo) {
      for (const kw of entry.keywords) {
        const kwLower = kw.toLowerCase();
        if (clean === kwLower) {
          return entry.photo;
        }
        const regex = new RegExp(`\\b${kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(clean)) {
          const score = kwLower.length * (kwLower.includes(' ') ? 3 : 2);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = entry.photo;
          }
        } else if (clean.includes(kwLower)) {
          const score = kwLower.length;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = entry.photo;
          }
        }
      }
    }
  }

  if (bestMatch) return bestMatch;
  return 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=350&auto=format&fit=crop&q=80';
}

export async function fetchRealProductPhoto(name = '', barcode = '') {
  const cleanBarcode = String(barcode || '').trim();
  // 1. Try Open Food Facts by barcode
  if (cleanBarcode && /^\d{8,14}$/.test(cleanBarcode)) {
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${cleanBarcode}.json`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 1 && data.product) {
          const img = data.product.image_front_url || data.product.image_url || data.product.image_front_small_url;
          if (img) return img;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // 2. Try curated photo dictionary by scoring
  const photo = getProductAutoImageUrl(name, barcode);
  if (photo && !photo.includes('photo-1542838132-92c53300491e')) {
    return photo;
  }

  // 3. Dynamic search across Wikipedia Commons for ANY newly created product
  try {
    const queryTerm = String(name || '')
      .replace(/\b\d+(\.\d+)?\s*(kg|g|gm|ml|l|ltr|pcs|pc|w|mah|m|cm|mm|pages|sheets|socket|socket box)\b/gi, '')
      .replace(/[^\w\s]/g, ' ')
      .trim();
    if (queryTerm) {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(queryTerm)}&gsrlimit=3&prop=pageimages&pithumbsize=400&format=json&origin=*`;
      const res = await fetch(wikiUrl);
      if (res.ok) {
        const data = await res.json();
        if (data?.query?.pages) {
          const pages = Object.values(data.query.pages);
          const found = pages.find(p => p.thumbnail?.source);
          if (found?.thumbnail?.source) {
            return found.thumbnail.source;
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return photo || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=350&auto=format&fit=crop&q=80';
}

export function getProductAutoVisual(name = '') {
  const clean = String(name || '').toLowerCase().trim();
  if (!clean) {
    return {
      icon: '📦',
      photo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=350&auto=format&fit=crop&q=80',
      gradient: 'from-indigo-600 to-purple-700',
      initials: 'P',
      isEmoji: true
    };
  }

  let bestEntry = null;
  let bestScore = 0;

  for (const entry of PRODUCT_KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      const kwLower = kw.toLowerCase();
      if (clean === kwLower) {
        return {
          icon: entry.icon,
          photo: entry.photo || null,
          gradient: entry.gradient,
          initials: (name || 'P').slice(0, 2).toUpperCase(),
          isEmoji: true
        };
      }
      const regex = new RegExp(`\\b${kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(clean)) {
        const score = kwLower.length * (kwLower.includes(' ') ? 3 : 2);
        if (score > bestScore) {
          bestScore = score;
          bestEntry = entry;
        }
      } else if (clean.includes(kwLower)) {
        const score = kwLower.length;
        if (score > bestScore) {
          bestScore = score;
          bestEntry = entry;
        }
      }
    }
  }

  if (bestEntry) {
    return {
      icon: bestEntry.icon,
      photo: bestEntry.photo || null,
      gradient: bestEntry.gradient,
      initials: (name || 'P').slice(0, 2).toUpperCase(),
      isEmoji: true
    };
  }

  // Deterministic fallback based on product name hash
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const gradIdx = Math.abs(hash) % FALLBACK_GRADIENTS.length;

  return {
    icon: (name || 'P').slice(0, 2).toUpperCase(),
    photo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=350&auto=format&fit=crop&q=80',
    gradient: FALLBACK_GRADIENTS[gradIdx],
    initials: (name || 'P').slice(0, 2).toUpperCase(),
    isEmoji: false
  };
}

export function getProductUnitOptions(product) {
  if (!product) return [{ unit: 'pcs', factor: 1, price: 0, isBase: true }];
  const baseUnit = String(product.unit || 'pcs').toLowerCase().trim();
  const basePrice = Number(product.price) || 0;
  const options = [
    { unit: product.unit || 'pcs', factor: 1, price: basePrice, isBase: true }
  ];

  // 1. Custom sub-unit (e.g. g for kg, ml for ltr, pcs for box/dozen)
  if (product.customSubUnitName && Number(product.customSubUnitFactor) > 0) {
    const subName = product.customSubUnitName.trim();
    const factorNum = Number(product.customSubUnitFactor);
    const subPrice = product.customSubUnitPrice ? Number(product.customSubUnitPrice) : basePrice / factorNum;
    options.push({
      unit: subName,
      factor: 1 / factorNum,
      price: subPrice,
      subFactor: factorNum,
      isSub: true
    });
  }

  // 2. Standard kg -> g
  if (baseUnit === 'kg' && !options.some(o => o.unit.toLowerCase() === 'g')) {
    options.push({
      unit: 'g',
      factor: 0.001,
      price: basePrice / 1000,
      subFactor: 1000,
      isSub: true
    });
  } else if ((baseUnit === 'ltr' || baseUnit === 'litre' || baseUnit === 'liter') && !options.some(o => o.unit.toLowerCase() === 'ml')) {
    options.push({
      unit: 'ml',
      factor: 0.001,
      price: basePrice / 1000,
      subFactor: 1000,
      isSub: true
    });
  }

  // 3. Alt units (e.g. boxes, cartons)
  if (Array.isArray(product.altUnits)) {
    product.altUnits.forEach((alt) => {
      if (alt && alt.unit && !options.some(o => o.unit.toLowerCase() === String(alt.unit).toLowerCase())) {
        const factor = Number(alt.factor) || 1;
        const price = alt.price !== undefined && alt.price !== null && alt.price !== '' ? Number(alt.price) : basePrice * factor;
        options.push({
          unit: alt.unit,
          factor,
          price,
          isAlt: true
        });
      }
    });
  }

  return options;
}

export function getProductRemainingStock(product, cart = [], allProducts = [], depth = 0) {
  if (!product) return { remaining: 0, text: '0', isLow: false, isOut: true };
  if (product.productType === 'service') {
    return { remaining: Infinity, text: 'Unlimited', isLow: false, isOut: false };
  }

  const prodId = product.id;
  const isComposite = product.isComposite || product.productType === 'composite';
  const isCombo = product.productType === 'combo';

  // 1. Composite item: compute availability from recipe raw materials
  if (isComposite && depth === 0) {
    const ingredients = product.recipe?.ingredients || product.recipeItems || [];
    if (ingredients.length > 0 && Array.isArray(allProducts) && allProducts.length > 0) {
      let maxCanMake = Infinity;
      for (const ing of ingredients) {
        const raw = allProducts.find((p) => p.id === ing.productId);
        if (!raw) continue;
        const ingStock = getProductRemainingStock(raw, cart, allProducts, depth + 1);
        const reqQty = Number(ing.qty) || 1;
        const canMakeThis = Math.floor(Math.max(0, ingStock.remaining) / reqQty);
        if (canMakeThis < maxCanMake) maxCanMake = canMakeThis;
      }
      if (maxCanMake === Infinity) maxCanMake = 0;

      const remaining = maxCanMake;
      const isOut = remaining <= 0;
      const isLow = remaining <= Number(product.minStock ?? 5);
      const text = `${remaining} ${product.unit || 'portions'} left`;
      return { remaining, text, isLow, isOut };
    }
  }

  // 2. Combo bundle: compute availability from constituent product stock
  if (isCombo && depth === 0) {
    const comboItems = product.comboItems || [];
    if (comboItems.length > 0 && Array.isArray(allProducts) && allProducts.length > 0) {
      let maxCanMake = Infinity;
      for (const item of comboItems) {
        const raw = allProducts.find((p) => p.id === item.productId);
        if (!raw) continue;
        const ingStock = getProductRemainingStock(raw, cart, allProducts, depth + 1);
        const reqQty = Number(item.qty) || 1;
        const canMakeThis = Math.floor(Math.max(0, ingStock.remaining) / reqQty);
        if (canMakeThis < maxCanMake) maxCanMake = canMakeThis;
      }
      if (maxCanMake === Infinity) maxCanMake = 0;

      const remaining = maxCanMake;
      const isOut = remaining <= 0;
      const isLow = remaining <= Number(product.minStock ?? 5);
      const text = `${remaining} ${product.unit || 'combos'} left`;
      return { remaining, text, isLow, isOut };
    }
  }

  // 3. Raw Material / Standard Product: calculate in-cart deduction (direct sales + composite recipes + combos consuming this product)
  const inCartBase = cart.reduce((sum, item) => {
    if (item.id === prodId || item.name === product.name) {
      const factor = Number(item.unitFactor) || (String(item.unit).toLowerCase() === String(product.unit).toLowerCase() ? 1 : 1);
      return sum + (Number(item.qty) || 0) * factor;
    }
    const isComp = item.isComposite || item.productType === 'composite';
    if (isComp) {
      const ingredients = item.recipe?.ingredients || item.recipeItems || [];
      const matched = ingredients.find((ing) => ing.productId === prodId);
      if (matched) {
        const reqQty = Number(matched.qty) || 0;
        const soldQty = Number(item.qty) || 0;
        return sum + (reqQty * soldQty);
      }
    }
    const isCb = item.productType === 'combo';
    if (isCb) {
      const cItems = item.comboItems || [];
      const matched = cItems.find((ci) => ci.productId === prodId);
      if (matched) {
        const reqQty = Number(matched.qty) || 0;
        const soldQty = Number(item.qty) || 0;
        return sum + (reqQty * soldQty);
      }
    }
    return sum;
  }, 0);

  const rawRemaining = Number(product.stock || 0) - inCartBase;
  const remaining = Math.max(0, Math.round(rawRemaining * 10000) / 10000);
  const isOut = remaining <= 0;
  const isLow = remaining <= Number(product.minStock ?? 5);

  const options = getProductUnitOptions(product);
  const subOption = options.find((o) => o.isSub);

  let text = `${remaining} ${product.unit}`;
  if (subOption && subOption.subFactor && remaining > 0) {
    const remainingSub = Math.round(remaining * subOption.subFactor * 100) / 100;
    text = `${remaining} ${product.unit} (${remainingSub} ${subOption.unit})`;
  }

  return { remaining, text, isLow, isOut };
}

export function playScanSound(type = 'add') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'add') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'remove') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (_) {}
}

export function resolveProductPricing(product, customer, priceSheets = [], overrideSheetId = null) {
  if (!product) return { price: 0, discountPercent: 0, ruleSource: null };

  let basePrice = Number(product.price || 0);
  let discountPercent = 0;
  let ruleSource = null;

  // 1. Direct customer custom price override — skipped when a sheet is picked manually for this bill
  if (!overrideSheetId && customer?.customPrices && customer.customPrices[product.id] !== undefined) {
    const custPrice = Number(customer.customPrices[product.id]);
    if (Number.isFinite(custPrice) && custPrice >= 0) {
      return {
        price: custPrice,
        discountPercent: Number(customer.discountPercent || 0),
        ruleSource: 'Customer Price'
      };
    }
  }

  // 2. Manually-picked bill sheet > Customer's assigned Price Sheet > Customer Group Price Sheet
  const targetSheetId = overrideSheetId || customer?.priceSheetId;
  const targetGroup = overrideSheetId ? null : customer?.group;
  const activeSheet = priceSheets.find(
    (s) => s.isActive && (s.id === targetSheetId || (targetGroup && String(s.customerType || '').toLowerCase() === String(targetGroup).toLowerCase()))
  );

  if (activeSheet) {
    if (activeSheet.pricingMap && activeSheet.pricingMap[product.id] !== undefined) {
      basePrice = Number(activeSheet.pricingMap[product.id]);
      ruleSource = `Price Sheet (${activeSheet.name})`;
    }
    if (activeSheet.discountMap && activeSheet.discountMap[product.id] !== undefined) {
      discountPercent = Number(activeSheet.discountMap[product.id]);
      ruleSource = ruleSource || `Price Sheet (${activeSheet.name})`;
    } else if (Number(activeSheet.defaultDiscountPercent) > 0) {
      discountPercent = Number(activeSheet.defaultDiscountPercent);
      ruleSource = ruleSource || `Price Sheet (${activeSheet.name})`;
    }
  }

  // 3. Customer default discount
  if (discountPercent === 0 && Number(customer?.discountPercent) > 0) {
    discountPercent = Number(customer.discountPercent);
    ruleSource = 'Customer Discount';
  }

  // Fold the resolved discount % into the actual selling price — callers only
  // read `price` for the cart/grid, they never re-apply discountPercent themselves.
  const finalPrice = discountPercent > 0
    ? Math.round(basePrice * (1 - discountPercent / 100) * 100) / 100
    : basePrice;

  return { price: finalPrice, discountPercent, ruleSource };
}

/**
 * The billing terminal — SOW Module 3.
 * Physical hardware is treated as a first-class input: the barcode scanner is a
 * keyboard wedge, so keystrokes are captured globally rather than requiring the
 * search box to hold focus, and weighed items pull a stable read from the scale.
 */
export default function POSTerminal({ tenant, showToast, settings: appSettings, onSaleCompleted }) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [priceSheets, setPriceSheets] = useState([]);
  const [tables, setTables] = useState([]);
  const [settings, setSettings] = useState(appSettings);
  const [session, setSession] = useState(null);
  const [heldBills, setHeldBills] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [recentBilledIds, setRecentBilledIds] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [priceSheetId, setPriceSheetId] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [roundOffOverride, setRoundOffOverride] = useState(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [tableId, setTableId] = useState('');
  const [note, setNote] = useState('');

  const [weightModal, setWeightModal] = useState(null);
  const [weightUnit, setWeightUnit] = useState('kg');
  const [weightInput, setWeightInput] = useState('1');
  const [scaleReading, setScaleReading] = useState(false);
  const [liveWeight, setLiveWeight] = useState(0);

  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [cashTendered, setCashTendered] = useState('');
  const [partialPaidAmount, setPartialPaidAmount] = useState('');
  const [partialPaymentMethod, setPartialPaymentMethod] = useState('Cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [redeemAdvance, setRedeemAdvance] = useState(0);
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [showHeld, setShowHeld] = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [showTables, setShowTables] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState([]);

  const searchRef = useRef(null);
  const scanBuffer = useRef('');
  const scanTimer = useRef(null);

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setInitialLoading(true);
    else setSyncing(true);
    try {
      const [data, rec] = await Promise.all([
        api.get('/init'),
        api.get('/orders', { limit: 20 }).catch(() => [])
      ]);
      setCategories(data.categories || []);
      setProducts(data.products || []);
      setRecentBilledIds(data.recentBilledIds || []);
      setCustomers(data.customers || []);
      setVendors(data.vendors || []);
      setPriceSheets(data.priceSheets || []);
      setSession(data.session || null);
      setHeldBills(data.heldBills || []);
      setTables(data.tables || []);
      setSettings(data.settings || null);

      const ordersList = Array.isArray(rec) ? rec : [];
      setRecentInvoices((prev) => {
        const map = new Map();
        ordersList.forEach((o) => { if (o && o.orderId) map.set(o.orderId, o); });
        (prev || []).forEach((o) => { if (o && o.orderId && !map.has(o.orderId)) map.set(o.orderId, o); });
        return Array.from(map.values())
          .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
          .slice(0, 20);
      });
    } catch (err) {
      showToast(api.message(err, 'Could not load the terminal.'), 'error');
    } finally {
      setInitialLoading(false);
      setSyncing(false);
    }
  }, [showToast]);

  useEffect(() => {
    load(true);
  }, [load]);

  // Customer-Specific Pricing & Price Sheet Auto-Application
  useEffect(() => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust && !priceSheetId) return;

    setCart((prevCart) => {
      if (prevCart.length === 0) return prevCart;
      return prevCart.map((item) => {
        const prod = products.find((p) => p.id === item.id) || item;
        const pricing = resolveProductPricing(prod, cust, priceSheets, priceSheetId);
        const unitOpts = getProductUnitOptions(prod);
        const opt = unitOpts.find((o) => o.unit === item.unit) || unitOpts[0];
        const factor = opt?.factor || 1;
        const unitPrice = opt?.isAlt || opt?.isSub ? opt.price : pricing.price * factor;
        const total = Math.round(item.qty * unitPrice * 100) / 100;
        return {
          ...item,
          price: unitPrice,
          total,
          pricingRule: pricing.ruleSource,
          itemDiscountPercent: pricing.discountPercent
        };
      });
    });
  }, [customerId, customers, priceSheets, priceSheetId, products]);

  /* ------------------------- cart maths ------------------------- */

  const customer = customers.find((c) => c.id === customerId) || null;
  const taxInclusive = settings?.tax?.taxMode === 'INCLUSIVE';
  const gstEnabled = settings?.tax?.enableGst !== false;

  const isRoundOff = useMemo(() => {
    if (roundOffOverride !== null) return roundOffOverride;
    const b = settings?.billing || {};
    if (b.roundOff !== undefined) return Boolean(b.roundOff);
    if (b.roundOffTotal !== undefined) return Boolean(b.roundOffTotal);
    if (b.roundOffGrandTotal !== undefined) return Boolean(b.roundOffGrandTotal);
    return true; // Always round off by default in billing
  }, [roundOffOverride, settings]);

  const totals = useMemo(() => {
    const lineValue = (item) => (Number(item.qty) || 0) * (Number(item.price) || 0);

    const subtotal = cart.reduce((s, i) => {
      const gross = lineValue(i);
      return s + (taxInclusive && gstEnabled ? gross / (1 + (i.taxRate || 0) / 100) : gross);
    }, 0);

    const discountAmount = (subtotal * discountPercent) / 100;
    const discountFactor = subtotal > 0 ? 1 - discountAmount / subtotal : 1;

    const tax = !gstEnabled
      ? 0
      : cart.reduce((s, i) => {
          const gross = lineValue(i);
          const taxable = taxInclusive ? gross / (1 + (i.taxRate || 0) / 100) : gross;
          return s + (taxable * discountFactor * (i.taxRate || 0)) / 100;
        }, 0);

    const beforeRound = subtotal - discountAmount + tax;
    const grand = isRoundOff ? Math.round(beforeRound) : Math.round(beforeRound * 100) / 100;
    const roundOff = Math.round((grand - beforeRound) * 100) / 100;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      beforeRound: Math.round(beforeRound * 100) / 100,
      roundOff,
      grand
    };
  }, [cart, discountPercent, taxInclusive, gstEnabled, isRoundOff]);

  /* ------------------------- loyalty redemption ------------------------- */
  const loyalty = useMemo(() => {
    const pos = settings?.pos || {};
    const rate = Number(pos.loyaltyRedeemValue) || 0;
    const available = customer?.loyaltyPoints || 0;
    const minPoints = Number(pos.loyaltyMinRedeemPoints) || 0;

    const maxByBill = rate > 0 ? Math.floor(totals.grand / rate) : 0;
    const maxPoints = Math.max(0, Math.min(available, maxByBill));

    const points = Math.min(Number(redeemPoints) || 0, maxPoints);
    return {
      enabled: pos.enableLoyalty !== false && rate > 0 && Boolean(customer),
      rate,
      available,
      minPoints,
      maxPoints,
      points,
      amount: Math.round(points * rate * 100) / 100,
      belowMinimum: available > 0 && available < minPoints
    };
  }, [settings, customer, totals.grand, redeemPoints]);

  /* ---------------------- Customer Advance / Store Credit ---------------------- */
  const advanceCredit = useMemo(() => {
    const available = Math.max(0, Number(customer?.advance || customer?.advanceBalance || 0));
    const afterLoyalty = Math.max(0, totals.grand - loyalty.amount);
    const maxAdvance = Math.min(available, afterLoyalty);
    const applied = Math.max(0, Math.min(Number(redeemAdvance) || 0, maxAdvance));
    return {
      available,
      maxAdvance,
      applied: Math.round(applied * 100) / 100
    };
  }, [customer, totals.grand, loyalty.amount, redeemAdvance]);

  const payable = isRoundOff
    ? Math.max(0, Math.round(totals.grand - loyalty.amount - advanceCredit.applied))
    : Math.max(0, Math.round((totals.grand - loyalty.amount - advanceCredit.applied) * 100) / 100);

  useEffect(() => {
    setRedeemPoints(0);
    setRedeemAdvance(0);
  }, [customerId, cart.length]);

  const changeDue = Math.max(0, (parseFloat(cashTendered) || 0) - payable);

  // Per-category product counts for the category tab bar — was previously a
  // full products.filter() re-run for every category on every render (cart
  // edits, search keystrokes, etc.), i.e. O(categories × products) each time
  // instead of once per actual products/categories change.
  const categoryProductCounts = useMemo(() => {
    const counts = new Map();
    products.forEach((p) => {
      const ids = p.categoryIds || [p.categoryId];
      ids.forEach((id) => {
        if (!id) return;
        counts.set(id, (counts.get(id) || 0) + 1);
      });
    });
    return counts;
  }, [products]);

  // O(1) product-by-id lookup for the cart list render below, which previously
  // ran a full products.find() per cart line on every render — O(cart size ×
  // catalog size) each time, for a value that only actually changes when the
  // catalog itself changes.
  const productsById = useMemo(() => {
    const map = new Map();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  /* ------------------------- adding items ------------------------- */

  const addToCart = useCallback(
    (product, qty = 1) => {
      if (session?.status !== 'open') {
        setShowSession(true);
        showToast('Cash Counter is closed. Please open drawer to start billing.', 'error');
        return;
      }

      const cust = customers.find((c) => c.id === customerId);
      const pricing = resolveProductPricing(product, cust, priceSheets, priceSheetId);
      const options = getProductUnitOptions({ ...product, price: pricing.price });
      const isScaleWeighed = Boolean(product.requiresWeight);

      if (isScaleWeighed && qty === 1) {
        setWeightModal({ ...product, price: pricing.price });
        const hasGrams = options.some((o) => o.unit === 'g');
        const defaultUnit = hasGrams ? 'g' : options[0]?.unit || product.unit || 'pcs';
        setWeightUnit(defaultUnit);
        setWeightInput(defaultUnit === 'g' ? '500' : '1');
        return;
      }

      const defaultOpt = options[0] || { unit: product.unit || 'pcs', factor: 1, price: pricing.price };

      setCart((prev) => {
        const idx = prev.findIndex((i) => i.id === product.id && i.unit === defaultOpt.unit);
        if (idx >= 0) {
          const next = [...prev];
          const mergedQty = Math.round((next[idx].qty + qty) * 1000) / 1000;
          const merged = { ...next[idx], qty: mergedQty, total: Math.round(mergedQty * next[idx].price * 100) / 100 };
          next[idx] = merged;
          showToast(`Updated ${product.name} (qty: ${mergedQty})`);
          return next;
        }
        showToast(`Added ${product.name} to bill (qty: ${qty})`);
        return [
          ...prev,
          {
            ...product,
            id: product.id,
            name: product.name,
            printName: product.printName || product.name,
            barcode: product.barcode || '',
            qty,
            unit: defaultOpt.unit,
            saleUnit: defaultOpt.unit,
            unitFactor: defaultOpt.factor || 1,
            price: defaultOpt.price,
            total: Math.round(qty * defaultOpt.price * 100) / 100,
            taxRate: product.taxRate || 0,
            pricingRule: pricing.ruleSource,
            itemDiscountPercent: pricing.discountPercent
          }
        ];
      });
    },
    [customerId, customers, priceSheets, priceSheetId, showToast, session]
  );

  const removeFromCart = useCallback((product, qty = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === product.id || i.name === product.name);
      if (idx < 0) {
        showToast(`${product.name} is not in the bill.`, 'error');
        playScanSound('error');
        return prev;
      }
      const current = prev[idx];
      const newQty = Math.round((current.qty - qty) * 1000) / 1000;
      if (newQty <= 0) {
        showToast(`Removed ${product.name} from bill.`);
        playScanSound('remove');
        return prev.filter((_, i) => i !== idx);
      }
      const next = [...prev];
      next[idx] = {
        ...current,
        qty: newQty,
        total: Math.round(newQty * current.price * 100) / 100
      };
      showToast(`Decremented ${product.name} (qty: ${newQty})`);
      playScanSound('remove');
      return next;
    });
  }, [showToast]);

  /**
   * Weight-embedded and standard barcode scanner handling
   */
  const resolveScan = useCallback(
    async (code) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      if (session?.status !== 'open') {
        setShowSession(true);
        showToast('Cash Counter is closed. Please open drawer to start billing.', 'error');
        return;
      }

      const prefix = settings?.hardware?.weighingScale?.embeddedBarcodePrefix || '21';

      if (trimmed.length >= 12 && trimmed.startsWith(prefix)) {
        const itemPart = trimmed.slice(prefix.length, prefix.length + 5);
        const grams = Number(trimmed.slice(prefix.length + 5, prefix.length + 10));
        const match = products.find(
          (p) => String(p.barcode).slice(-5) === itemPart || (p.barcodes || []).some((b) => String(b).slice(-5) === itemPart)
        );
        if (match && Number.isFinite(grams)) {
          addToCart(match, grams / 1000);
          playScanSound('add');
          showToast(`${match.name} — ${(grams / 1000).toFixed(3)} kg added from label.`);
          return;
        }
      }

      const local = products.find((p) => p.barcode === trimmed || (p.barcodes || []).includes(trimmed));
      if (local) {
        addToCart(local, 1);
        playScanSound('add');
        showToast(`Scanned ${local.name}`);
        return;
      }

      try {
        const decoded = await api.get(`/hardware/decode-barcode/${encodeURIComponent(trimmed)}`);
        addToCart(decoded.product, decoded.quantity || 1);
        playScanSound('add');
        showToast(
          decoded.embedded
            ? `${decoded.product.name} — ${Number(decoded.quantity).toFixed(3)} ${decoded.product.unit} from label.`
            : `Scanned ${decoded.product.name}`
        );
        return;
      } catch {
        /* fall through to product lookup */
      }

      try {
        const found = await api.get(`/products/lookup/${encodeURIComponent(trimmed)}`);
        addToCart(found, 1);
        playScanSound('add');
        showToast(`Scanned ${found.name}`);
      } catch {
        playScanSound('error');
        showToast(`No product matches barcode ${trimmed}`, 'error');
      }
    },
    [products, addToCart, showToast, settings, session]
  );

  // Global keyboard-wedge capture: a scanner types fast and ends with Enter.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (showCheckout || weightModal || showSession) return;

      const tag = document.activeElement?.tagName;
      const typingInField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Enter') {
        if (scanBuffer.current.length >= 6) {
          resolveScan(scanBuffer.current);
          scanBuffer.current = '';
          e.preventDefault();
        }
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (typingInField) return;

      if (/^[0-9]$/.test(e.key)) {
        scanBuffer.current += e.key;
        clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(() => {
          scanBuffer.current = '';
        }, 250);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resolveScan, showCheckout, weightModal, showSession]);

  const readScale = async () => {
    setScaleReading(true);
    try {
      const res = await api.get('/hardware/weight');
      const grams = Number(res.weight) || 0;
      setLiveWeight(grams);

      if (weightUnit === 'g' || weightUnit === 'gm' || weightUnit === 'grams') {
        setWeightInput(String(grams));
      } else {
        setWeightInput((grams / 1000).toFixed(3));
      }

      showToast(`Scale reading: ${grams} g (${(grams / 1000).toFixed(3)} kg)${res.simulated ? ' (simulated)' : ''}`);
    } catch (err) {
      showToast(api.message(err, 'Scale did not respond.'), 'error');
    } finally {
      setScaleReading(false);
    }
  };

  const confirmWeight = () => {
    const value = parseFloat(weightInput) || 0;
    if (value <= 0) {
      showToast('Enter a quantity / weight greater than zero.', 'error');
      return;
    }
    const product = weightModal;
    const options = getProductUnitOptions(product);
    const selectedOpt = options.find((o) => o.unit.toLowerCase() === weightUnit.toLowerCase()) || options[0];
    const unitPrice = selectedOpt.price;
    const unitFactor = selectedOpt.factor || 1;
    const lineTotal = Math.round(value * unitPrice * 100) / 100;

    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === product.id && i.unit === selectedOpt.unit);
      if (idx >= 0) {
        const next = [...prev];
        const qty = Math.round((next[idx].qty + value) * 1000) / 1000;
        next[idx] = { ...next[idx], qty, total: Math.round(qty * next[idx].price * 100) / 100 };
        return next;
      }
      return [
        ...prev,
        {
          ...product,
          qty: value,
          saleUnit: selectedOpt.unit,
          unit: selectedOpt.unit,
          unitFactor,
          price: unitPrice,
          total: lineTotal
        }
      ];
    });

    setWeightModal(null);
    showToast(`${value} ${selectedOpt.unit} of ${product.name} added (${money(lineTotal)}).`);
  };

  const switchCartItemUnit = (cartItemId, targetUnit) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== cartItemId) return item;
        const product = products.find((p) => p.id === item.id) || item;
        const options = getProductUnitOptions(product);
        const currentOpt = options.find((o) => o.unit.toLowerCase() === String(item.unit).toLowerCase()) || { factor: item.unitFactor || 1, price: item.price };
        const newOpt = options.find((o) => o.unit.toLowerCase() === String(targetUnit).toLowerCase()) || options[0];

        // Base quantity currently in cart:
        const currentBaseQty = (Number(item.qty) || 0) * (currentOpt.factor || 1);
        // New quantity in target unit:
        const newQty = newOpt.factor > 0 ? Math.round((currentBaseQty / newOpt.factor) * 1000) / 1000 : item.qty;
        const newPrice = newOpt.price;
        const total = Math.round(newQty * newPrice * 100) / 100;

        return {
          ...item,
          unit: newOpt.unit,
          saleUnit: newOpt.unit,
          unitFactor: newOpt.factor,
          price: newPrice,
          qty: newQty,
          total
        };
      })
    );
  };

  const updateQty = (id, delta) =>
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id !== id) return i;
          const step = i.unit === 'g' || i.unit === 'ml' ? 50 : 1;
          const qty = Math.round(Math.max(0, i.qty + delta * step) * 1000) / 1000;
          return { ...i, qty, total: Math.round(qty * i.price * 100) / 100 };
        })
        .filter((i) => i.qty > 0)
    );

  // Rate/qty are free-typed in the cart, and nothing downstream re-checks their
  // sign before checkout — verified live that a negative qty slips straight
  // through to the backend, credits stock instead of debiting it, and posts a
  // negative "COMPLETED" sale. Clamp both to non-negative here, at the source.
  const setLinePrice = (id, price) =>
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, price: Math.max(0, Number(price) || 0), total: Math.round(i.qty * Math.max(0, Number(price) || 0) * 100) / 100 } : i))
    );

  const setLineQty = (id, val) =>
    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const newQty = val === '' ? '' : Math.max(0, Number(val) || 0);
        const safeQty = Number(newQty) || 0;
        return { ...i, qty: newQty, total: Math.round(safeQty * i.price * 100) / 100 };
      })
    );

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setNote('');
    setTableId('');
  };

  /* ------------------------- bill actions ------------------------- */

  const holdBill = async () => {
    if (session?.status !== 'open') {
      setShowSession(true);
      showToast('Cash Counter is closed. Please open drawer to start billing.', 'error');
      return;
    }
    if (cart.length === 0) return;
    try {
      const res = await api.post('/bills/hold', {
        customerName: customer?.name || 'Walk-in Customer',
        customerId: customer?.id || null,
        items: cart,
        total: totals.grand,
        notes: note || 'Hold bill',
        tableId: tableId || null
      });
      showToast(res.message);
      clearCart();
      load();
    } catch (err) {
      showToast(api.message(err, 'Could not hold the bill.'), 'error');
    }
  };

  const saveAsQuotation = async () => {
    if (session?.status !== 'open') {
      setShowSession(true);
      showToast('Cash Counter is closed. Please open drawer to start billing.', 'error');
      return;
    }
    if (cart.length === 0) return;
    try {
      const res = await api.post('/quotations', {
        customerId: customer?.id || null,
        customerName: customer?.name || 'Walk-in Customer',
        customerPhone: customer?.phone || 'N/A',
        customerGstin: customer?.gstin || '',
        customerPan: customer?.pan || '',
        customerAddress: customer?.address || '',
        items: cart.map((i) => ({
          productId: i.id,
          name: i.name,
          barcode: i.barcode || '',
          qty: Number(i.qty) || 1,
          unit: i.unit || 'pcs',
          price: Number(i.price) || 0,
          taxRate: Number(i.taxRate) || 0,
          total: Number(i.total) || (Number(i.qty) || 1) * (Number(i.price) || 0)
        })),
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discountAmount,
        roundOff: totals.roundOff,
        total: totals.grand,
        notes: note || ''
      });
      showToast(res.message || 'Quotation created successfully!', 'success');
    } catch (err) {
      showToast(api.message(err, 'Could not save quotation.'), 'error');
    }
  };

  const resumeBill = async (bill) => {
    setCart(bill.items);
    setCustomerId(bill.customerId || '');
    setPriceSheetId('');
    setTableId(bill.tableId || '');
    setNote(bill.notes || '');
    try {
      await api.del(`/bills/held/${bill.id}`);
      setShowHeld(false);
      load();
      showToast('Held bill resumed.');
    } catch (err) {
      showToast(api.message(err, 'Could not resume the bill.'), 'error');
    }
  };

  const maxDiscount = settings?.pos?.maxDiscountPercent ?? 100;

  const checkout = async () => {
    if (cart.length === 0) return;
    // Guard against a double-tap/double-click firing two POST /orders for the
    // same bill — verified live that nothing else stops this: two identical
    // requests each create their own order, deduct stock and post accounting
    // entries independently, since the backend has no dedup/idempotency check.
    if (checkingOut) return;

    if ((paymentMode === 'Credit (Udhar)' || paymentMode === 'Partial Payment') && !customer) {
      showToast('Select a customer for credit / partial payment sales.', 'error');
      return;
    }

    const isPartial = paymentMode === 'Partial Payment';
    const partialPaid = isPartial ? Math.min(payable, Math.max(0, Number(partialPaidAmount) || 0)) : 0;
    if (isPartial && partialPaid <= 0) {
      showToast('Please enter an upfront partial amount greater than zero.', 'error');
      return;
    }

    const creditPortion = isPartial ? Math.max(0, payable - partialPaid) : (paymentMode === 'Credit (Udhar)' ? payable : 0);

    if (customer?.creditLimit > 0 && creditPortion > 0) {
      const projected = (customer.outstanding || 0) + creditPortion;
      if (projected > customer.creditLimit) {
        showToast(
          `Warning: ${customer.name} will exceed their ${money(customer.creditLimit)} credit limit (${money(projected)}).`,
          'error'
        );
      }
    }

    setCheckingOut(true);
    try {
      const actualPaymentMode = payable === 0 && advanceCredit.applied > 0 ? 'Advance / Store Credit' : (isPartial ? partialPaymentMethod : paymentMode);
      const res = await api.post('/orders', {
        customerId: customer?.id || null,
        customerName: customer?.name || 'Walk-in Customer',
        customerPhone: customer?.phone || null,
        customerGstin: customer?.gstin || '',
        customerPan: customer?.pan || '',
        customerAddress: customer?.address || '',
        customerState: customer?.state || '',
        customerStateCode: customer?.stateCode || '',
        paymentMethod: actualPaymentMode,
        paymentRef: paymentRef.trim() || '',
        status: isPartial ? 'PARTIALLY_PAID' : undefined,
        paidAmount: isPartial ? partialPaid : undefined,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discountAmount,
        roundOff: totals.roundOff,
        total: totals.grand,
        redeemPoints: loyalty.points || 0,
        redeemAdvanceAmount: advanceCredit.applied || 0,
        items: cart,
        tableId: tableId || null,
        notes: note
      });

      setReceipt(res.data);
      setShowCheckout(false);
      clearCart();
      setCashTendered('');
      setPartialPaidAmount('');
      setPaymentRef('');
      setRedeemPoints(0);
      setRedeemAdvance(0);

      if (res.data) {
        setRecentInvoices((prev) => [res.data, ...(prev || []).filter((o) => o.orderId !== res.data.orderId)].slice(0, 20));
        const itemIds = (res.data.items || []).map((i) => i.id || i.productId).filter(Boolean);
        setRecentBilledIds((prev) => Array.from(new Set([...itemIds, ...(prev || [])])));
      }

      (res.warnings || []).forEach((w) => showToast(w, 'error'));
      showToast(res.message);

      // The tenant middleware now flushes every write to MongoDB before this
      // request's response is sent (verified live: an immediate, zero-delay
      // direct DB read and an immediate GET /orders both saw the new order
      // right after the POST resolved) — so there is nothing left to wait
      // out. Refresh right away: this also brings stock levels, the session
      // drawer balance and held bills back in sync without the multi-second
      // gap during which the grid used to show stale stock.
      load();
      onSaleCompleted?.();

      if (settings?.billing?.printAfterCheckout) setTimeout(() => window.print(), 400);
    } catch (err) {
      showToast(api.message(err, 'Checkout failed.'), 'error');
    } finally {
      setCheckingOut(false);
    }
  };

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const recentBilledProducts = useMemo(() => {
    const seen = new Set();
    const list = [];

    (recentInvoices || []).forEach((order) => {
      (order.items || []).forEach((item) => {
        const prod = products.find((p) => p.id === item.id || p.name === item.name);
        if (prod && !seen.has(prod.id)) {
          seen.add(prod.id);
          list.push(prod);
        }
      });
    });

    (recentBilledIds || []).forEach((idOrName) => {
      const prod = products.find((p) => p.id === idOrName || p.name === idOrName);
      if (prod && !seen.has(prod.id)) {
        seen.add(prod.id);
        list.push(prod);
      }
    });

    return list;
  }, [recentInvoices, recentBilledIds, products]);

  const recentBilledIdSet = useMemo(() => {
    return new Set(recentBilledProducts.map((p) => p.id));
  }, [recentBilledProducts]);

  const filtered = useMemo(() => {
    const needle = deferredSearchQuery.trim().toLowerCase();
    let list = products;

    if (selectedCategory === 'recent-billed') {
      list = recentBilledProducts.length > 0 ? recentBilledProducts : products;
    } else if (selectedCategory !== 'all') {
      list = list.filter((p) => (p.categoryIds || [p.categoryId]).includes(selectedCategory));
    }

    if (needle) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (p.regionalName || p.printName || '').toLowerCase().includes(needle) ||
          p.id.toLowerCase().includes(needle) ||
          (p.barcodes || [p.barcode]).some((b) => String(b).includes(needle))
      );
    }

    if (sortBy === 'default' || sortBy === 'recent-billed' || selectedCategory === 'recent-billed') {
      if (recentBilledProducts.length > 0) {
        const orderMap = new Map(recentBilledProducts.map((p, idx) => [p.id, idx]));
        list = [...list].sort((a, b) => {
          const idxA = orderMap.has(a.id) ? orderMap.get(a.id) : 999999;
          const idxB = orderMap.has(b.id) ? orderMap.get(b.id) : 999999;
          return idxA - idxB;
        });
      }
    } else if (sortBy === 'price-asc') {
      list = [...list].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortBy === 'price-desc') {
      list = [...list].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'stock') {
      list = [...list].sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
    }

    return list;
  }, [products, selectedCategory, deferredSearchQuery, recentBilledProducts, sortBy]);

  const currentCustomer = useMemo(() => customers.find((c) => c.id === customerId) || null, [customers, customerId]);

  // Stock + pricing per product used to be recomputed inline in JSX for every
  // visible card on every POSTerminal render — including renders triggered by
  // wholly unrelated state (typing a cash amount, opening a modal). With ~150
  // cards each doing a cart scan + price-sheet lookup, that was the "buffering"
  // stutter on selection. Memoized here so it only recomputes when something
  // that actually affects a card's stock/price/label changes.
  const visibleProductCards = useMemo(() => {
    return filtered.slice(0, 150).map((p, index) => {
      const stockInfo = getProductRemainingStock(p, cart, products);
      const out = stockInfo.isOut;
      const isLow = stockInfo.isLow;
      const pricing = resolveProductPricing(p, currentCustomer, priceSheets, priceSheetId);
      const isRecent = recentBilledIdSet.has(p.id) && (selectedCategory === 'recent-billed' || index < 8);
      const imgUrl = getProductImageUrl(p.imageUrl, p.name, p.barcode);
      const autoVisual = getProductAutoVisual(p.name);
      const prodCat = categories.find((c) => (p.categoryIds || [p.categoryId]).includes(c.id)) || { name: p.categoryId || 'General' };
      const catTheme = getCategoryTheme(prodCat);
      return { product: p, stockInfo, out, isLow, pricing, isRecent, imgUrl, autoVisual, catTheme };
    });
  }, [filtered, cart, products, currentCustomer, priceSheets, priceSheetId, recentBilledIdSet, selectedCategory, categories]);

  if (initialLoading) return <Spinner label="Opening the billing terminal…" />;

  const sessionOpen = session?.status === 'open';

  return (
    <div className="relative min-h-[80vh] w-full rounded-2xl">
      {/* Drawer Closed / Shift Ended Lock Popup inside Billing Section */}
      {!sessionOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 sm:p-6 rounded-2xl animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-[color:var(--bg-surface)] border border-[color:var(--border)] p-6 sm:p-8 text-center shadow-2xl space-y-5">
            <div className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-3xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-inner">
              <Lock className="h-8 w-8 sm:h-10 sm:w-10" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                Shift Inactive · Counter Closed
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-[color:var(--text-primary)] tracking-tight">
                Cash Counter is Closed
              </h3>
              <p className="text-xs sm:text-sm text-[color:var(--text-muted)] max-w-sm mx-auto leading-relaxed">
                Billing and checkout are locked while the counter shift is closed. Please open the cash drawer and record your opening cash float to begin billing.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowSession(true)}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm sm:text-base shadow-xl shadow-indigo-500/30 hover:from-indigo-700 hover:to-purple-700 active:scale-[0.99] transition-all cursor-pointer"
              >
                <Unlock className="h-5 w-5" />
                Open Cash Drawer to Start Billing
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-10">
        {/* ----------------------------- Catalogue (70%) ----------------------------- */}
        <div className="space-y-3 lg:col-span-7">
        <Panel className="flex flex-wrap items-center gap-2 relative">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              ref={searchRef}
              className="field-input"
              style={{ paddingLeft: '2.1rem' }}
              placeholder="Scan barcode or search items… (F2)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length >= 1) {
                  addToCart(filtered[0], 1);
                  playScanSound('add');
                  setSearchQuery('');
                }
              }}
            />

            {/* Search with Dropdown selection */}
            {searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-2 shadow-2xl backdrop-blur-md max-h-72 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-muted)] flex justify-between items-center">
                  <span>Matching Items ({filtered.length})</span>
                  <span className="text-[9px] lowercase">press Enter or click</span>
                </div>
                {filtered.length === 0 ? (
                  <div className="p-3 text-center text-xs text-[color:var(--text-muted)]">No matching products found</div>
                ) : (
                  filtered.slice(0, 8).map((p) => {
                    const stockInfo = getProductRemainingStock(p, cart, products);
                    const cust = customers.find((c) => c.id === customerId);
                    const pricing = resolveProductPricing(p, cust, priceSheets, priceSheetId);
                    const imgUrl = getProductImageUrl(p.imageUrl, p.name, p.barcode);
                    const autoVisual = getProductAutoVisual(p.name);
                    const prodCat = categories.find((c) => (p.categoryIds || [p.categoryId]).includes(c.id)) || { name: p.categoryId || 'General' };
                    const catTheme = getCategoryTheme(prodCat);
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          addToCart(p, 1);
                          playScanSound('add');
                          setSearchQuery('');
                        }}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-[color:var(--bg-subtle)] cursor-pointer text-xs transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div className="h-8 w-8 rounded-lg overflow-hidden border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] shrink-0 flex items-center justify-center">
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={p.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  if (e.currentTarget.nextSibling) {
                                    e.currentTarget.nextSibling.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <div
                              className={`h-full w-full bg-gradient-to-br ${autoVisual.gradient} flex items-center justify-center text-xs select-none`}
                              style={{ display: imgUrl ? 'none' : 'flex' }}
                            >
                              <span>{autoVisual.icon}</span>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="font-bold text-[color:var(--text-primary)] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                                {p.name}
                              </div>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8.5px] font-extrabold ${catTheme.badge} shrink-0`}>
                                <span className={`h-1 w-1 rounded-full ${catTheme.dot}`} />
                                {prodCat.name}
                              </span>
                            </div>
                            <div className="text-[10px] text-[color:var(--text-muted)] flex items-center gap-2 mt-0.5">
                              {p.barcode && <span className="font-mono bg-[color:var(--bg-subtle)] px-1.5 py-0.2 rounded">{p.barcode}</span>}
                              <span>{p.unit || 'pcs'}</span>
                              <span className={stockInfo.isOut ? 'text-rose-500 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>
                                {stockInfo.text}
                              </span>
                              {pricing.ruleSource && (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">
                                  {pricing.ruleSource}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <Money value={pricing.price} decimals={false} className="font-bold text-[13px]" />
                          <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            + Add
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="flex shrink-0 items-center rounded-xl px-2.5 py-2 text-[11.5px] font-bold transition-colors cursor-pointer outline-none"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            title="Sort items in catalog"
          >
            <option value="default">🕒 Recently Billed</option>
            <option value="name">🔤 Name (A-Z)</option>
            <option value="price-asc">💵 Price: Low to High</option>
            <option value="price-desc">💎 Price: High to Low</option>
            <option value="stock">📦 Stock Level</option>
          </select>

          <Badge tone={settings?.hardware?.barcodeScanner?.enabled !== false ? 'success' : 'neutral'}>
            <Barcode className="h-3 w-3" />
            {settings?.hardware?.barcodeScanner?.enabled !== false ? 'Scanner Armed' : 'Scanner Off'}
          </Badge>

          {/* Live weight display */}
          {settings?.hardware?.weighingScale?.enabled !== false && (
            <button
              type="button"
              onClick={readScale}
              title="Read the weighing scale"
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11.5px] font-bold transition-colors"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
            >
              <Scale className={`h-3.5 w-3.5 ${scaleReading ? 'animate-pulse text-amber-500' : 'text-[color:var(--accent)]'}`} />
              <span className="tabular text-[color:var(--text-primary)]">
                {scaleReading ? '— — —' : `${Number(liveWeight || 0).toFixed(3)} kg`}
              </span>
            </button>
          )}

          {settings?.pos?.enableTables && (
            <Button icon={LayoutGrid} onClick={() => setShowTables(true)}>
              {tableId ? tables.find((t) => t.id === tableId)?.name : 'Table'}
            </Button>
          )}

          <Button icon={Receipt} onClick={() => setShowRecent(true)}>
            Reprint
          </Button>

          <Button
            icon={sessionOpen ? Unlock : Lock}
            variant={sessionOpen ? 'subtle' : 'primary'}
            onClick={() => setShowSession(true)}
            title="Counter Opening, Cash In / Out, Internal Expenses & Cash Movements"
          >
            {sessionOpen ? `Drawer: ${money(session.currentCash, { decimals: false })}` : 'Open Counter'}
          </Button>
        </Panel>

        {!sessionOpen && (
          <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-[12px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <Lock className="h-4 w-4" />
            The counter session is closed. Open a session to track cash float and denominations for this shift.
          </div>
        )}

        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`shrink-0 rounded-xl px-3 py-2 text-[11.5px] font-bold transition-all ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'surface text-[color:var(--text-secondary)] border border-[color:var(--border)] hover:text-[color:var(--text-primary)]'
            }`}
          >
            All items ({products.length})
          </button>

          {categories.map((cat) => {
            const count = categoryProductCounts.get(cat.id) || 0;
            const catTheme = getCategoryTheme(cat);
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[11.5px] font-bold transition-all ${
                  isSelected
                    ? `${catTheme.solid}`
                    : `border ${catTheme.tabInactive}`
                }`}
              >
                <span>{cat.icon || '📦'}</span>
                <span>{cat.name}</span>
                <span className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${isSelected ? 'bg-white/20 text-white' : 'opacity-70'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <Panel>
            <EmptyState
              title={selectedCategory === 'recent-billed' ? 'No recently billed items' : 'No items match'}
              hint={selectedCategory === 'recent-billed' ? 'Products you bill will automatically appear here.' : 'Clear the search or pick another category.'}
            />
          </Panel>
        ) : (
          <div className="grid max-h-[calc(100vh+11.5rem)] grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 overflow-y-auto pr-1 pb-2">
            {visibleProductCards.map(({ product: p, stockInfo, out, isLow, pricing, isRecent, imgUrl, autoVisual, catTheme }) => {
              return (
                <motion.button
                  key={p.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    addToCart(p, 1);
                    playScanSound('add');
                  }}
                  className="surface group flex flex-col justify-between rounded-xl p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer relative overflow-hidden border border-[color:var(--border)] hover:border-indigo-400 dark:hover:border-indigo-600"
                >
                  {/* Category Accent Top Line */}
                  <div className={`absolute top-0 left-0 right-0 h-[3.5px] ${catTheme.topBar}`} />

                  {/* Product Image Card (Compact 4-per-row) */}
                  <div className="relative w-full h-22 sm:h-24 rounded-lg overflow-hidden bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)] mt-0.5 mb-1.5 flex items-center justify-center shrink-0">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextSibling) {
                            e.currentTarget.nextSibling.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-full h-full bg-gradient-to-br ${autoVisual.gradient} flex flex-col items-center justify-center relative overflow-hidden transition-transform duration-300 group-hover:scale-105 select-none`}
                      style={{ display: imgUrl ? 'none' : 'flex' }}
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)] pointer-events-none" />
                      {autoVisual.isEmoji ? (
                        <span className="text-3xl sm:text-4xl filter drop-shadow-md select-none transform transition-transform group-hover:scale-110 duration-200">
                          {autoVisual.icon}
                        </span>
                      ) : (
                        <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-white font-black text-sm shadow-md tracking-wider uppercase">
                          {autoVisual.icon}
                        </div>
                      )}
                    </div>

                    {/* Overlay Badges */}
                    <div className="absolute top-1 left-1 right-1 flex items-center justify-between gap-0.5 pointer-events-none">
                      {p.barcode ? (
                        <span className="tabular truncate text-[8px] font-mono font-bold px-1 py-0.2 rounded bg-slate-950/80 text-white backdrop-blur-xs shadow-xs max-w-[65%]">
                          {p.barcode}
                        </span>
                      ) : <span />}

                      <div className="flex items-center gap-0.5 shrink-0">
                        {isRecent && (
                          <span
                            className="flex items-center gap-0.5 rounded px-1 py-0.2 text-[7.5px] font-bold bg-amber-500 text-white shadow-xs"
                            title="Recently billed product"
                          >
                            <Clock className="h-2 w-2" />
                            Recent
                          </span>
                        )}
                        {p.requiresWeight && (
                          <span className="rounded p-0.5 bg-cyan-600 text-white shadow-xs" title="Weighing Scale Required">
                            <Scale className="h-2 w-2" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="min-w-0 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="line-clamp-2 text-[11px] sm:text-[11.5px] font-bold leading-tight text-[color:var(--text-primary)] group-hover:text-[color:var(--accent)] transition-colors">
                        {p.name}
                      </div>
                      {pricing.ruleSource && (
                        <div className="mt-0.5 text-[8.5px] font-bold text-indigo-600 dark:text-indigo-400 truncate">
                          {pricing.ruleSource}
                        </div>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center justify-between gap-1 border-t pt-1.5" style={{ borderColor: 'var(--border)' }}>
                      <Money value={pricing.price} decimals={false} className="text-[12px] sm:text-[12.5px] font-bold text-[color:var(--text-primary)]" />
                      <span
                        className={`tabular rounded px-1 py-0.2 text-[8px] sm:text-[8.5px] font-bold shrink-0 ${
                          out
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : isLow
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : 'text-[color:var(--text-muted)]'
                        }`}
                        style={!out && !isLow ? { background: 'var(--bg-subtle)' } : undefined}
                        title={`Stock: ${stockInfo.text}`}
                      >
                        {out ? 'Out' : stockInfo.text}
                      </span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------- Cart / Billing (30%) ------------------------------- */}
      <div className="lg:sticky lg:top-20 lg:col-span-3">
        <Panel className="space-y-3">
          <div className="flex items-center justify-between gap-2 border-b pb-2.5" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-[color:var(--accent)]" />
              <span className="text-[13px] font-bold text-[color:var(--text-primary)]">Current Bill</span>
              {cart.length > 0 && <Badge tone="accent">{cart.length} items</Badge>}
            </div>
            <div className="flex items-center gap-1.5">
              {heldBills.length > 0 && (
                <Button size="sm" icon={PauseCircle} onClick={() => setShowHeld(true)}>
                  {heldBills.length}
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={clearCart} disabled={cart.length === 0}>
                Clear
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-7 min-w-0">
              <span className="label-eyebrow mb-1.5 block">Customer</span>
              <div className="flex items-center gap-1.5 min-w-0 w-full">
                <div className="flex-1 min-w-0">
                  <Select
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      setPriceSheetId('');
                    }}
                    className="w-full text-xs"
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map((c) => {
                      const hasCustom = c.customPrices && Object.keys(c.customPrices).length > 0;
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.phone ? ` (${c.phone})` : ''}{hasCustom ? ' ★ Custom' : ''}{c.outstanding > 0 ? ` · due ${money(c.outstanding, { decimals: false })}` : ''}
                        </option>
                      );
                    })}
                  </Select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  icon={UserPlus}
                  onClick={() => setShowAddCustomer(true)}
                  title="Add New Customer"
                  className="shrink-0 h-[36px] w-[36px] p-0 flex items-center justify-center rounded-xl border border-[color:var(--border)] hover:border-indigo-500 hover:text-indigo-600 bg-[color:var(--bg-subtle)]"
                />
              </div>
            </div>

            <div className="col-span-5 min-w-0">
              <Field label={`Discount % (max ${maxDiscount}%)`} className="min-w-0">
                <Select
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Math.min(maxDiscount, Number(e.target.value)))}
                  className="w-full text-xs"
                >
                  {DISCOUNT_PRESETS.filter((d) => d <= maxDiscount).map((d) => (
                    <option key={d} value={d}>
                      {d === 0 ? 'No disc' : `${d}% off`}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          {priceSheets.length > 0 && (
            <Field
              label="Price Sheet"
              hint={
                priceSheetId
                  ? 'Active price sheet for this bill.'
                  : customer?.priceSheetId
                    ? `Linked to ${customer.name}'s profile.`
                    : 'Select a custom sheet or leave default.'
              }
              className="min-w-0"
            >
              <Select
                value={priceSheetId}
                onChange={(e) => setPriceSheetId(e.target.value)}
                className="w-full text-xs"
              >
                <option value="">Select Price Sheet</option>
                {priceSheets.filter((s) => s.isActive).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.customerType ? ` · ${s.customerType}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {customer && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-[11px]" style={{ background: 'var(--bg-subtle)' }}>
              <User className="h-3.5 w-3.5 text-[color:var(--text-muted)]" />
              <span className="font-semibold text-[color:var(--text-primary)]">{customer.phone || 'No phone'}</span>
              {customer.group && (
                <Badge tone="neutral">Group: {customer.group}</Badge>
              )}
              {customer.customPrices && Object.keys(customer.customPrices).length > 0 && (
                <Badge tone="success">★ Customer-Specific Pricing</Badge>
              )}
              {customer.priceSheetId && (
                <Badge tone="accent">Price Sheet Linked</Badge>
              )}
              <Badge tone="accent">
                <Star className="h-2.5 w-2.5" />
                {customer.loyaltyPoints || 0} pts
              </Badge>
              {totals.grand > 0 && (
                <Badge tone="success">
                  ✨ +{Math.floor((totals.grand / 100) * (Number(settings?.pos?.loyaltyPointsPerHundred) || 1))} pts on this bill
                </Badge>
              )}
              {(Number(customer.advance) > 0 || Number(customer.advanceBalance) > 0) && (
                <Badge tone="info" className="font-bold">
                  💳 Advance / Credit: {money(customer.advance || customer.advanceBalance)}
                </Badge>
              )}
              {customer.outstanding > 0 && <Badge tone="warning">Due {money(customer.outstanding, { decimals: false })}</Badge>}
            </div>
          )}

          <div className="max-h-[34vh] space-y-1.5 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Cart is empty"
                hint="Scan a barcode or tap an item to start billing."
              />
            ) : (
              cart.map((item) => {
                const prod = productsById.get(item.id) || item;
                const unitOpts = getProductUnitOptions(prod);
                const stockInfo = getProductRemainingStock(prod, cart, products);
                const imgUrl = getProductImageUrl(prod?.imageUrl || item?.imageUrl, item.name || prod?.name, item.barcode || prod?.barcode);
                const autoVisual = getProductAutoVisual(item.name || prod?.name);

                const prodCat = categories.find((c) => (prod?.categoryIds || [prod?.categoryId]).includes(c.id)) || { name: prod?.categoryId || 'General' };
                const catTheme = getCategoryTheme(prodCat);

                return (
                  <div
                    key={`${item.id}_${item.unit}`}
                    className="flex flex-col gap-1.5 rounded-xl p-2 sm:p-2.5 transition-colors"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-2">
                      {/* Product Image Card in Cart / Billing */}
                      <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] flex items-center justify-center shadow-2xs">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.nextSibling) {
                                e.currentTarget.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className={`h-full w-full bg-gradient-to-br ${autoVisual.gradient} flex items-center justify-center text-[13px] shadow-inner select-none font-bold text-white`}
                          style={{ display: imgUrl ? 'none' : 'flex' }}
                        >
                          <span>{autoVisual.icon}</span>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate text-[12px] font-bold text-[color:var(--text-primary)]" title={item.name}>
                            {item.name}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-extrabold ${catTheme.badge} shrink-0`}>
                            {prodCat.name}
                          </span>
                        </div>
                        <div className="text-[10px] text-[color:var(--text-muted)] truncate">
                          Stock: <span className="font-semibold text-[color:var(--text-secondary)]">{stockInfo.text}</span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, -1)}
                          className="rounded-md p-1 text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)] transition-colors"
                          style={{ background: 'var(--surface)' }}
                          title="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, 1)}
                          className="rounded-md p-1 text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)] transition-colors"
                          style={{ background: 'var(--surface)' }}
                          title="Increase quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <Money value={item.total} decimals={false} className="w-14 text-right text-[12px] font-bold" />
                        <button
                          type="button"
                          onClick={() => setCart(cart.filter((i) => !(i.id === item.id && i.unit === item.unit)))}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[color:var(--border-subtle)] text-[11px]">
                      <span className="text-[10px] text-[color:var(--text-muted)]">Rate:</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={item.price}
                        onChange={(e) => setLinePrice(item.id, e.target.value)}
                        className="tabular w-16 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      />
                      <span className="text-[10px] text-[color:var(--text-muted)]">×</span>
                      <input
                        type="number"
                        step="any"
                        value={item.qty}
                        onChange={(e) => setLineQty(item.id, e.target.value)}
                        className="tabular w-12 rounded-md px-1 py-0.5 text-[10.5px] font-semibold text-center"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      />

                      {unitOpts.length > 1 ? (
                        <select
                          value={item.unit}
                          onChange={(e) => switchCartItemUnit(item.id, e.target.value)}
                          className="tabular rounded-md px-1 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                        >
                          {unitOpts.map((opt) => (
                            <option key={opt.unit} value={opt.unit}>
                              {opt.unit}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="tabular text-[10.5px] font-bold text-[color:var(--text-secondary)]">
                          {item.unit}
                        </span>
                      )}

                      {item.taxRate ? <span className="text-[9.5px] text-[color:var(--text-muted)] ml-auto">GST {item.taxRate}%</span> : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-1 border-t pt-2.5 text-[12px]" style={{ borderColor: 'var(--border)' }}>
            <Row label={`Subtotal${taxInclusive ? ' (tax extracted)' : ''}`} value={totals.subtotal} />
            {totals.discountAmount > 0 && (
              <Row label={`Discount (${discountPercent}%)`} value={-totals.discountAmount} tone="success" />
            )}
            {gstEnabled && <Row label="GST" value={totals.tax} />}

            <div className="flex items-center justify-between py-1 border-y border-[color:var(--border-subtle)] my-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[11.5px] font-bold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={isRoundOff}
                  onChange={(e) => setRoundOffOverride(e.target.checked)}
                  className="rounded border-[color:var(--border)] text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                />
                <span>Round off to ₹</span>
              </label>
              {isRoundOff && totals.roundOff !== 0 ? (
                <span className={`font-mono font-bold text-[11.5px] ${totals.roundOff > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {totals.roundOff > 0 ? `+₹${totals.roundOff.toFixed(2)}` : `-₹${Math.abs(totals.roundOff).toFixed(2)}`}
                </span>
              ) : (
                <span className="font-mono text-[11px] text-[color:var(--text-muted)]">₹0.00</span>
              )}
            </div>

            <div className="flex items-center justify-between pt-1" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[13px] font-bold text-[color:var(--text-primary)]">Grand Total</span>
              <Money value={totals.grand} className="text-[20px] font-bold text-[color:var(--accent)]" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <Button icon={PauseCircle} onClick={holdBill} disabled={cart.length === 0} title="Hold running bill" className="px-2 text-xs">
              Hold
            </Button>
            <Button variant="secondary" icon={FileCheck} onClick={saveAsQuotation} disabled={cart.length === 0} title="Save items as Quotation" className="px-2 text-xs">
              Quote
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                if (session?.status !== 'open') {
                  setShowSession(true);
                  showToast('Cash Counter is closed. Please open drawer to start billing.', 'error');
                  return;
                }
                setShowCheckout(true);
              }}
              disabled={cart.length === 0}
              className="px-2"
            >
              Pay
            </Button>
          </div>
        </Panel>

        {/* Invoices Section in rows near the billing cart */}
        <Panel className="space-y-2 mt-3">
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[12px] font-bold text-[color:var(--text-primary)]">Recent Invoices</span>
              {recentInvoices.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  {recentInvoices.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowRecent(true)}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              All Invoices →
            </button>
          </div>

          {recentInvoices.length === 0 ? (
            <div className="py-2.5 text-center text-[11px] text-[color:var(--text-muted)]">
              No recent bills for this shift
            </div>
          ) : (
            <div className="divide-y divide-[color:var(--border-subtle)]">
              {recentInvoices.slice(0, 5).map((inv) => (
                <div
                  key={inv.orderId}
                  className="flex items-center justify-between py-2 text-xs hover:bg-[color:var(--bg-subtle)] px-2.5 rounded-xl transition-colors group cursor-pointer border border-transparent hover:border-[color:var(--border)]"
                  onClick={() => setReceipt(inv)}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11.5px] group-hover:underline">
                        {inv.orderId}
                      </span>
                      <span className="text-[10px] text-[color:var(--text-muted)]">
                        {fmtDateTime(inv.date).slice(11)}
                      </span>
                    </div>
                    <div className="truncate text-[11px] font-semibold text-[color:var(--text-primary)]">
                      {inv.customerName || 'Walk-in'} · <span className="font-normal text-[color:var(--text-muted)]">{(inv.items || []).length} item{(inv.items || []).length === 1 ? '' : 's'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-bold text-[12px] text-[color:var(--text-primary)]">
                        {money(inv.total)}
                      </div>
                      <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${
                        inv.status === 'VOID'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}>
                        {inv.status === 'VOID' ? 'VOID' : 'PAID'}
                      </span>
                    </div>

                    <button
                      type="button"
                      title="View / Print Receipt"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReceipt(inv);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ----------------------------- Modals ----------------------------- */}

      <Modal
        open={Boolean(weightModal)}
        onClose={() => setWeightModal(null)}
        title={weightModal ? `Quantity & Weight — ${weightModal.name}` : ''}
        subtitle={weightModal ? `Base Price: ${money(weightModal.price)} per ${weightModal.unit}` : ''}
        icon={Scale}
        size="sm"
        footer={
          <>
            <Button onClick={() => setWeightModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={confirmWeight}>
              Add to Bill
            </Button>
          </>
        }
      >
        {weightModal && (() => {
          const options = getProductUnitOptions(weightModal);
          const currentOpt = options.find((o) => o.unit.toLowerCase() === weightUnit.toLowerCase()) || options[0];
          const val = parseFloat(weightInput) || 0;
          const lineAmount = Math.round(val * currentOpt.price * 100) / 100;
          const stockInfo = getProductRemainingStock(weightModal, cart, products);

          // Calculate remaining after this proposed sale
          const baseQtyToAdd = val * (currentOpt.factor || 1);
          const remainingAfter = Math.max(0, Math.round((stockInfo.remaining - baseQtyToAdd) * 1000) / 1000);

          const subOpt = options.find(o => o.isSub);
          let remainingAfterText = `${remainingAfter} ${weightModal.unit}`;
          if (subOpt && subOpt.subFactor && remainingAfter > 0) {
            remainingAfterText = `${remainingAfter} ${weightModal.unit} (${Math.round(remainingAfter * subOpt.subFactor * 100) / 100} ${subOpt.unit})`;
          }

          const handleUnitSwitch = (newUnit) => {
            const newOpt = options.find((o) => o.unit.toLowerCase() === newUnit.toLowerCase()) || options[0];
            const currentBase = (parseFloat(weightInput) || 0) * (currentOpt.factor || 1);
            const convertedVal = newOpt.factor > 0 ? Math.round((currentBase / newOpt.factor) * 1000) / 1000 : weightInput;
            setWeightUnit(newOpt.unit);
            setWeightInput(String(convertedVal || (newOpt.unit === 'g' ? '500' : '1')));
          };

          return (
            <div className="space-y-3">
              {/* Unit selection tabs */}
              {options.length > 1 && (
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)]">
                  {options.map((opt) => (
                    <button
                      key={opt.unit}
                      type="button"
                      onClick={() => handleUnitSwitch(opt.unit)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        weightUnit.toLowerCase() === opt.unit.toLowerCase()
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                      }`}
                    >
                      {opt.unit === 'g' ? 'Grams (g)' : opt.unit === 'kg' ? 'Kilograms (kg)' : opt.unit}
                    </button>
                  ))}
                </div>
              )}

              <Button icon={Scale} onClick={readScale} loading={scaleReading} className="w-full" variant="outline">
                Read from weighing scale
              </Button>

              <Field label={`Enter Quantity (${weightUnit})`}>
                <Input
                  type="number"
                  step="any"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="tabular text-center text-[24px] font-bold"
                  autoFocus
                />
              </Field>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-1.5">
                {(weightUnit === 'g' || weightUnit === 'gm' || weightUnit === 'grams'
                  ? [100, 250, 500, 750, 1000, 2000]
                  : weightUnit === 'kg'
                  ? [0.25, 0.5, 1, 2, 5]
                  : [1, 2, 5, 10, 12, 24]
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setWeightInput(String(preset))}
                    className="px-2.5 py-1 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface)] text-[11px] font-bold text-[color:var(--text-secondary)] hover:border-indigo-500 hover:text-indigo-600 transition-all"
                  >
                    {preset} {weightUnit}
                  </button>
                ))}
              </div>

              {/* Calculation & Remaining Stock summary */}
              <div className="space-y-2 rounded-xl p-3 bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)] text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[color:var(--text-secondary)] font-medium">Unit Rate:</span>
                  <span className="font-bold text-[color:var(--text-primary)]">
                    {money(currentOpt.price)} / {weightUnit}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[color:var(--text-secondary)] font-medium">Line Amount:</span>
                  <Money value={lineAmount} className="text-[17px] font-bold text-emerald-600 dark:text-emerald-400" />
                </div>

                <div className="pt-2 border-t border-[color:var(--border-subtle)] flex items-center justify-between text-[11px]">
                  <span className="text-[color:var(--text-muted)] font-medium">Stock after this sale:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {remainingAfterText}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        title={`Collect ${money(payable)}`}
        subtitle={customer ? `From ${customer.name}` : 'Walk-in customer'}
        icon={Wallet}
        size="md"
        footer={
          <>
            <Button onClick={() => setShowCheckout(false)} disabled={checkingOut}>Cancel</Button>
            <Button variant="success" icon={CheckCircle2} onClick={checkout} loading={checkingOut} disabled={checkingOut}>
              Confirm Payment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {loyalty.enabled && loyalty.available > 0 && (
            <div
              className="space-y-2 rounded-xl px-3 py-2.5"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-[color:var(--text-secondary)]">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  Loyalty points
                </span>
                <Badge tone="accent">{loyalty.available} pts available</Badge>
              </div>

              {loyalty.belowMinimum ? (
                <div className="text-[10.5px] font-semibold text-[color:var(--text-muted)]">
                  {loyalty.minPoints} points are needed before they can be redeemed.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max={loyalty.maxPoints}
                      value={redeemPoints}
                      onChange={(e) => setRedeemPoints(Math.max(0, Math.min(loyalty.maxPoints, Number(e.target.value) || 0)))}
                      className="tabular w-24 text-center font-bold"
                    />
                    <Button size="sm" onClick={() => setRedeemPoints(loyalty.maxPoints)} disabled={loyalty.maxPoints === 0}>
                      Use max
                    </Button>
                    {redeemPoints > 0 && (
                      <Button size="sm" onClick={() => setRedeemPoints(0)}>
                        Clear
                      </Button>
                    )}
                    <span className="ml-auto text-[10.5px] font-semibold text-[color:var(--text-muted)]">
                      1 pt = {money(loyalty.rate)}
                    </span>
                  </div>

                  {loyalty.amount > 0 && (
                    <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[11.5px] font-semibold text-[color:var(--text-secondary)]">
                        {loyalty.points} pts redeemed
                      </span>
                      <span className="tabular text-[12.5px] font-bold text-emerald-600 dark:text-emerald-400">
                        −{money(loyalty.amount)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Customer Advance / Store Credit (Pending Owed to Customer) */}
          {customer && advanceCredit.available > 0 && (
            <div
              className="space-y-2 rounded-xl px-3 py-2.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-blue-700 dark:text-blue-300">
                  <CreditCard className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Customer Advance / Store Credit (Pending Owed)
                </span>
                <Badge tone="info">{money(advanceCredit.available)} available</Badge>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max={advanceCredit.maxAdvance}
                  step="0.01"
                  value={redeemAdvance || ''}
                  onChange={(e) => setRedeemAdvance(Math.max(0, Math.min(advanceCredit.maxAdvance, Number(e.target.value) || 0)))}
                  placeholder="0.00"
                  className="tabular w-28 text-center font-bold font-mono"
                />
                <Button size="sm" onClick={() => setRedeemAdvance(advanceCredit.maxAdvance)} disabled={advanceCredit.maxAdvance === 0}>
                  Use max ({money(advanceCredit.maxAdvance)})
                </Button>
                {redeemAdvance > 0 && (
                  <Button size="sm" onClick={() => setRedeemAdvance(0)}>
                    Clear
                  </Button>
                )}
                <span className="ml-auto text-[10.5px] font-semibold text-blue-600 dark:text-blue-400">
                  Pending: {money(advanceCredit.available)}
                </span>
              </div>

              {advanceCredit.applied > 0 && (
                <div className="flex items-center justify-between border-t border-blue-200/80 dark:border-blue-800/60 pt-2">
                  <span className="text-[11.5px] font-semibold text-blue-700 dark:text-blue-300">
                    Deducted from Pending Advance
                  </span>
                  <span className="tabular text-[12.5px] font-bold text-emerald-600 dark:text-emerald-400">
                    −{money(advanceCredit.applied)}
                  </span>
                </div>
              )}
            </div>
          )}

          {customer && settings?.pos?.enableLoyalty !== false && (
            <div className="flex items-center justify-between rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
              <span className="flex items-center gap-1.5 font-bold text-[color:var(--text-secondary)]">
                <Star className="h-3.5 w-3.5 text-amber-500" />
                Loyalty Earned on this Order
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                +{Math.floor((payable / 100) * (Number(settings?.pos?.loyaltyPointsPerHundred) || 1))} pts
              </span>
            </div>
          )}

          {(loyalty.amount > 0 || advanceCredit.applied > 0) && (
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-subtle)' }}>
              <div className="text-[11.5px] font-semibold text-[color:var(--text-secondary)]">
                Bill {money(totals.grand)}
                {loyalty.amount > 0 && ` − pts ${money(loyalty.amount)}`}
                {advanceCredit.applied > 0 && ` − advance ${money(advanceCredit.applied)}`}
              </div>
              <Money value={payable} className="text-[18px] font-bold text-[color:var(--accent)]" />
            </div>
          )}

          {payable === 0 && advanceCredit.applied > 0 && (
            <div className="rounded-xl p-2.5 text-center text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              ✨ Bill fully covered by Customer Advance / Store Credit (₹0.00 payable)
            </div>
          )}

          <Field label="Payment mode">
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setPaymentMode(mode); setPaymentRef(''); }}
                  className={`rounded-xl border px-3 py-2.5 text-[12px] font-bold transition-all ${
                    paymentMode === mode
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                      : 'text-[color:var(--text-secondary)]'
                  }`}
                  style={paymentMode === mode ? undefined : { background: 'var(--bg-subtle)', borderColor: 'var(--border)' }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </Field>

          {paymentMode === 'Cash' && (
            <>
              <Field label="Cash tendered">
                <Input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={String(payable)}
                  className="tabular text-[19px] font-bold"
                  autoFocus
                />
              </Field>
              <div className="flex gap-1.5">
                {[payable, ...(settings?.pos?.quickAmountPills || [500, 1000, 2000])].map((amount, i) => (
                  <Button key={i} size="sm" onClick={() => setCashTendered(String(amount))}>
                    {money(amount, { decimals: false })}
                  </Button>
                ))}
              </div>
              {parseFloat(cashTendered) > payable && (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/40">
                  <span className="text-[12px] font-bold text-emerald-700 dark:text-emerald-300">Change due</span>
                  <Money value={changeDue} className="text-[19px] font-bold text-emerald-700 dark:text-emerald-300" />
                </div>
              )}
            </>
          )}

          {paymentMode === 'UPI' && (
            <div className="rounded-2xl px-4 py-5 text-center" style={{ background: 'var(--bg-subtle)' }}>
              <QrCode className="mx-auto h-16 w-16 text-[color:var(--accent)]" />
              <div className="tabular mt-2 text-[13px] font-bold text-[color:var(--text-primary)]">
                Scan to pay {money(payable)}
              </div>
              <div className="text-[10.5px] text-[color:var(--text-muted)]">
                {settings?.company?.name} · confirm once the customer's app shows success
              </div>
            </div>
          )}

          {paymentMode === 'Credit (Udhar)' && (
            <div
              className={`rounded-xl px-3 py-2.5 text-[12px] font-semibold ${
                customer
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
              }`}
            >
              {customer
                ? `${customer.name}'s balance will rise from ${money(customer.outstanding || 0)} to ${money((customer.outstanding || 0) + payable)}.`
                : 'Select a customer above — a credit sale needs a named party.'}
            </div>
          )}

          {paymentMode === 'Partial Payment' && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-300">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  Partial / Advance Split
                </span>
                <span>Payable: {money(payable)}</span>
              </div>

              {!customer && (
                <div className="p-2 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[11px] font-semibold">
                  ⚠️ Select a registered customer above to record the remaining credit / udhar balance.
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Field label="Amount Paid Upfront (₹) *">
                  <Input
                    type="number"
                    min="0.01"
                    max={payable}
                    step="0.01"
                    value={partialPaidAmount}
                    onChange={(e) => setPartialPaidAmount(e.target.value)}
                    placeholder={String(Math.round(payable / 2))}
                    className="font-bold font-mono text-sm bg-white dark:bg-slate-900"
                    autoFocus
                  />
                </Field>

                <Field label="Paid Upfront Mode">
                  <Select value={partialPaymentMethod} onChange={(e) => { setPartialPaymentMethod(e.target.value); setPaymentRef(''); }}>
                    <option value="Cash">Cash (Drawer)</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="Card">Card</option>
                    <option value="Net Banking">Net Banking</option>
                    <option value="Cheque">Cheque</option>
                  </Select>
                </Field>
              </div>

              {['UPI', 'Card', 'Net Banking', 'Cheque'].includes(partialPaymentMethod) && (
                <Field label="Transaction Ref / UTR">
                  <Input
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="e.g. UTR / Ref Number"
                    className="bg-white dark:bg-slate-900 text-xs"
                  />
                </Field>
              )}

              <div className="rounded-xl p-2.5 bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
                <div className="flex justify-between text-[11px] text-[color:var(--text-secondary)]">
                  <span>Paid Upfront Now:</span>
                  <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {money(Number(partialPaidAmount) || 0)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-amber-800 dark:text-amber-300 border-t border-amber-100 dark:border-amber-900/60 pt-1">
                  <span>Added to Customer Udhar (Due):</span>
                  <span className="font-mono">{money(Math.max(0, payable - (Number(partialPaidAmount) || 0)))}</span>
                </div>
              </div>
            </div>
          )}

          <Field label="Bill note">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note printed on the bill" />
          </Field>
        </div>
      </Modal>

      <ReceiptModal
        receipt={receipt}
        settings={settings}
        tenant={tenant}
        onClose={() => setReceipt(null)}
      />

      <Modal open={showHeld} onClose={() => setShowHeld(false)} title={`Held Bills (${heldBills.length})`} icon={PauseCircle} size="lg">
        {heldBills.length === 0 ? (
          <EmptyState title="No held bills" />
        ) : (
          <div className="space-y-2">
            {heldBills.map((bill) => (
              <div
                key={bill.id}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
                style={{ background: 'var(--bg-subtle)' }}
              >
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-bold text-[color:var(--text-primary)]">{bill.customerName}</div>
                  <div className="text-[10.5px] text-[color:var(--text-muted)]">
                    {bill.items.length} items · {fmtDateTime(bill.heldAt)} · {bill.heldBy}
                    {bill.tableId ? ` · ${tables.find((t) => t.id === bill.tableId)?.name || 'Table'}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Money value={bill.total} className="font-bold" />
                  <Button size="sm" variant="primary" onClick={() => resumeBill(bill)}>
                    Resume
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <SessionModal
        open={showSession}
        session={session}
        customers={customers}
        vendors={vendors}
        onClose={() => setShowSession(false)}
        showToast={showToast}
        onChanged={load}
      />

      <TablesModal
        open={showTables}
        tables={tables}
        selectedId={tableId}
        onSelect={(id) => {
          setTableId(id);
          setShowTables(false);
        }}
        onClose={() => setShowTables(false)}
        showToast={showToast}
        onChanged={load}
      />

      <RecentBillsModal open={showRecent} onClose={() => setShowRecent(false)} onReprint={setReceipt} showToast={showToast} />

      <QuickCustomerModal
        open={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onCreated={(newCust) => {
          setCustomers((prev) => [newCust, ...(prev || [])]);
          setCustomerId(newCust.id);
          setPriceSheetId('');
        }}
        priceSheets={priceSheets}
        showToast={showToast}
      />
    </div>
    </div>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[color:var(--text-secondary)]">{label}</span>
      <Money
        value={value}
        className={tone === 'success' ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'font-semibold'}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Receipt
 * ------------------------------------------------------------------ */

function ReceiptModal({ receipt, settings, tenant, onClose }) {
  if (!receipt) return null;
  const company = receipt.company || settings?.company || { name: tenant?.name };
  const billing = receipt.billing || settings?.billing || {};
  const showGst = billing.showGstBreakup !== false;

  // GST is grouped by rate so the printed bill shows a compliant slab summary.
  const gstSlabs = {};
  (receipt.items || []).forEach((item) => {
    const rate = item.taxRate || 0;
    if (!rate) return;
    if (!gstSlabs[rate]) gstSlabs[rate] = { taxable: 0, tax: 0 };
    gstSlabs[rate].taxable += item.total;
    gstSlabs[rate].tax += (item.total * rate) / 100;
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Invoice ${receipt.orderId}`}
      subtitle={receipt.voucherNo ? `Accounting voucher ${receipt.voucherNo}` : undefined}
      icon={Receipt}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" icon={Printer} onClick={() => window.print()}>
            Print Bill
          </Button>
        </>
      }
    >
      <div id="printable-thermal-receipt" className="font-mono text-[11.5px] text-[color:var(--text-primary)]">
        <div className="border-b border-dashed pb-2 text-center" style={{ borderColor: 'var(--border-strong)' }}>
          <div className="text-[13px] font-bold uppercase">{company.name}</div>
          {company.address && <div className="text-[10px]">{company.address}</div>}
          {(company.city || company.phone) && (
            <div className="text-[10px]">
              {company.city}
              {company.city && company.phone ? ' · ' : ''}
              {company.phone}
            </div>
          )}
          {company.gstin && <div className="text-[10px]">GSTIN: {company.gstin}</div>}
        </div>

        <div className="flex justify-between border-b border-dashed py-1.5 text-[10px]" style={{ borderColor: 'var(--border-strong)' }}>
          <div>
            <div>Bill: {receipt.orderId}</div>
            <div>{fmtDateTime(receipt.date)}</div>
          </div>
          <div className="text-right">
            <div>{receipt.customerName}</div>
            {receipt.customerPhone && receipt.customerPhone !== 'N/A' && <div>{receipt.customerPhone}</div>}
            <div>Cashier: {receipt.cashier}</div>
          </div>
        </div>

        <table className="w-full py-1">
          <thead>
            <tr className="border-b border-dashed text-[9.5px] uppercase" style={{ borderColor: 'var(--border-strong)' }}>
              <th className="py-1 text-left">Item</th>
              <th className="py-1 text-right">Qty</th>
              <th className="py-1 text-right">Rate</th>
              <th className="py-1 text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {(receipt.items || []).map((item, i) => (
              <tr key={i}>
                <td className="py-0.5 pr-1">{item.printName || item.name}</td>
                <td className="tabular py-0.5 text-right">{item.qty}</td>
                <td className="tabular py-0.5 text-right">{Number(item.price).toFixed(2)}</td>
                <td className="tabular py-0.5 text-right">{Number(item.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-0.5 border-t border-dashed pt-1.5" style={{ borderColor: 'var(--border-strong)' }}>
          <ReceiptRow label="Subtotal" value={receipt.subtotal} />
          {receipt.discount > 0 && <ReceiptRow label="Discount" value={-receipt.discount} />}
          {receipt.tax > 0 && <ReceiptRow label="GST" value={receipt.tax} />}
          {receipt.roundOff !== undefined && receipt.roundOff !== 0 && (
            <ReceiptRow label="Round off" value={receipt.roundOff} />
          )}
          {receipt.loyaltyRedeemed > 0 && (
            <ReceiptRow label={`Points redeemed (${receipt.pointsRedeemed})`} value={-receipt.loyaltyRedeemed} />
          )}
          {receipt.advanceRedeemed > 0 && (
            <ReceiptRow label="Advance / Credit Deducted" value={-receipt.advanceRedeemed} />
          )}
          <div className="flex justify-between border-t border-dashed pt-1 text-[14px] font-bold" style={{ borderColor: 'var(--border-strong)' }}>
            <span>TOTAL</span>
            <span className="tabular">₹{Number(receipt.total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>Paid by {receipt.paymentMethod}</span>
            {receipt.loyaltyEarned > 0 && <span>+{receipt.loyaltyEarned} pts</span>}
          </div>
          {receipt.loyaltyBalance !== undefined && (
            <div className="text-[9.5px]">Points balance: {receipt.loyaltyBalance}</div>
          )}
          {receipt.advanceBalance !== undefined && receipt.advanceRedeemed > 0 && (
            <div className="text-[9.5px]">Remaining advance: ₹{Number(receipt.advanceBalance).toFixed(2)}</div>
          )}
        </div>

        {showGst && Object.keys(gstSlabs).length > 0 && (
          <div className="mt-2 border-t border-dashed pt-1.5 text-[9.5px]" style={{ borderColor: 'var(--border-strong)' }}>
            <div className="mb-0.5 font-bold uppercase">GST Summary</div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left">Slab</th>
                  <th className="text-right">Taxable</th>
                  <th className="text-right">CGST</th>
                  <th className="text-right">SGST</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(gstSlabs).map(([rate, v]) => (
                  <tr key={rate}>
                    <td>{rate}%</td>
                    <td className="tabular text-right">{v.taxable.toFixed(2)}</td>
                    <td className="tabular text-right">{(v.tax / 2).toFixed(2)}</td>
                    <td className="tabular text-right">{(v.tax / 2).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-2 border-t border-dashed pt-1.5 text-center text-[9.5px]" style={{ borderColor: 'var(--border-strong)' }}>
          {billing.termsText && <div>{billing.termsText}</div>}
          <div className="mt-0.5 font-bold">{billing.footerText || 'Thank you, visit again!'}</div>
        </div>
      </div>
    </Modal>
  );
}

function ReceiptRow({ label, value }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span>{label}</span>
      <span className="tabular">₹{Number(value).toFixed(2)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Session, tables, reprint
 * ------------------------------------------------------------------ */

const CASH_REASONS = [
  'Change float added',
  'Cash deposited to bank',
  'Petty expense paid',
  'Owner drawing',
  'Vendor paid in cash',
  'Opening float top-up',
  'Miscellaneous cash in/out'
];

const EXPENSE_CATEGORIES = [
  'Tea & Refreshments',
  'Logistics & Delivery',
  'Repairs & Maintenance',
  'Office Supplies',
  'Staff Meal & Welfare',
  'Utilities & Bills',
  'Cleaning & Sanitation',
  'Miscellaneous'
];

const CURRENCY_DENOMINATIONS = [
  { key: '2000', label: '₹2,000', value: 2000, color: 'text-pink-600 dark:text-pink-400 bg-pink-500/10 border-pink-300 dark:border-pink-800' },
  { key: '500', label: '₹500', value: 500, color: 'text-stone-700 dark:text-stone-300 bg-stone-500/10 border-stone-300 dark:border-stone-700' },
  { key: '200', label: '₹200', value: 200, color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-300 dark:border-amber-800' },
  { key: '100', label: '₹100', value: 100, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-300 dark:border-indigo-800' },
  { key: '50', label: '₹50', value: 50, color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-300 dark:border-cyan-800' },
  { key: '20', label: '₹20', value: 20, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-300 dark:border-emerald-800' },
  { key: '10', label: '₹10', value: 10, color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-300 dark:border-orange-800' },
  { key: 'coins', label: 'Coins', value: 1, color: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-300 dark:border-slate-700' }
];

const PRESET_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

const EXPENSE_CATEGORY_ICONS = {
  'Tea & Refreshments': '☕',
  'Logistics & Delivery': '🚚',
  'Repairs & Maintenance': '🛠️',
  'Office Supplies': '📑',
  'Staff Meal & Welfare': '🍔',
  'Utilities & Bills': '💡',
  'Cleaning & Sanitation': '🧹',
  'Miscellaneous': '🏷️'
};

function SessionModal({ open, session, customers = [], vendors = [], onClose, showToast, onChanged }) {
  const [openingMode, setOpeningMode] = useState('DENOMINATIONS'); // 'DENOMINATIONS' or 'LUMPSUM'
  const [openingCash, setOpeningCash] = useState('');
  const [denominations, setDenominations] = useState({
    '2000': 0, '500': 0, '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, coins: 0
  });

  const [activeTab, setActiveTab] = useState('CASH_IN'); // 'CASH_IN' | 'CASH_OUT' | 'EXPENSE' | 'CLOSE' | 'HISTORY'
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('ALL'); // 'ALL' | 'IN' | 'OUT' | 'EXPENSE' | 'CUSTOMER' | 'VENDOR'
  const [entry, setEntry] = useState({
    type: 'IN',
    amount: '',
    partyType: 'OTHER', // 'CUSTOMER' | 'VENDOR' | 'OTHER'
    customerId: '',
    vendorId: '',
    person: '',
    phone: '',
    address: '',
    purpose: '',
    classification: 'OFFICIAL', // 'OFFICIAL' | 'UNOFFICIAL'
    expenseCategory: EXPENSE_CATEGORIES[0]
  });

  const [closingMode, setClosingMode] = useState('DENOMINATIONS');
  const [closingDenominations, setClosingDenominations] = useState({
    '2000': 0, '500': 0, '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, coins: 0
  });
  const [countedCash, setCountedCash] = useState('');
  const [busy, setBusy] = useState(false);

  const isOpen = session?.status === 'open';

  const resetClosingDenominations = () => {
    setClosingDenominations({
      '2000': 0, '500': 0, '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, coins: 0
    });
    setCountedCash('');
  };

  const resetOpeningDenominations = () => {
    setDenominations({
      '2000': 0, '500': 0, '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, coins: 0
    });
    setOpeningCash('');
  };

  // Auto-clear previous calculation and notes inputs whenever modal opens or session updates
  useEffect(() => {
    if (open) {
      resetClosingDenominations();
      resetOpeningDenominations();
      setActiveTab('CASH_IN');
      setHistorySearch('');
      setHistoryFilter('ALL');
    }
  }, [open, session?.id, session?.status]);

  // Compute opening cash sum from denominations
  const denominationTotal = useMemo(() => {
    return CURRENCY_DENOMINATIONS.reduce((sum, d) => {
      const count = Number(denominations[d.key]) || 0;
      return sum + count * d.value;
    }, 0);
  }, [denominations]);

  // Compute closing cash sum from denominations
  const closingDenominationTotal = useMemo(() => {
    return CURRENCY_DENOMINATIONS.reduce((sum, d) => {
      const count = Number(closingDenominations[d.key]) || 0;
      return sum + count * d.value;
    }, 0);
  }, [closingDenominations]);

  const act = async (fn) => {
    setBusy(true);
    try {
      const res = await fn();
      showToast(res.message);
      onChanged();
    } catch (err) {
      showToast(api.message(err, 'Action failed.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenSession = async () => {
    const finalAmount = openingMode === 'DENOMINATIONS' ? denominationTotal : Number(openingCash);
    if (!finalAmount || finalAmount < 0) {
      showToast('Please enter a valid opening cash float.', 'error');
      return;
    }
    await act(() =>
      api.post('/session/open', {
        openingCash: finalAmount,
        denominations: openingMode === 'DENOMINATIONS' ? denominations : undefined
      })
    );
    onClose();
  };

  const handleRecordEntry = async () => {
    if (!entry.amount || Number(entry.amount) <= 0) {
      showToast('Enter a valid amount.', 'error');
      return;
    }

    if (!entry.person?.trim()) {
      showToast('Please enter or select a name / party.', 'error');
      return;
    }

    if (entry.partyType === 'OTHER' && !entry.phone?.trim()) {
      showToast('Phone number is required.', 'error');
      return;
    }

    const isCust = entry.partyType === 'CUSTOMER';
    const isVend = entry.partyType === 'VENDOR';
    const finalClassification =
      activeTab === 'EXPENSE'
        ? 'EXPENSE'
        : entry.classification;

    await act(() =>
      api.post('/session/cash-entry', {
        type: activeTab === 'CASH_OUT' || activeTab === 'EXPENSE' ? 'OUT' : 'IN',
        amount: Number(entry.amount),
        partyType: entry.partyType,
        customerId: isCust ? entry.customerId : undefined,
        vendorId: isVend ? entry.vendorId : undefined,
        person: entry.person,
        phone: entry.phone,
        address: entry.address,
        purpose:
          activeTab === 'EXPENSE'
            ? entry.purpose || entry.expenseCategory
            : entry.purpose || (isCust ? `Customer ${activeTab === 'CASH_IN' ? 'Receipt' : 'Refund'} (${entry.person || 'Customer'})` : isVend ? `Vendor ${activeTab === 'CASH_IN' ? 'Repayment/Refund' : 'Payment'} (${entry.person || 'Vendor'})` : `Cash ${activeTab === 'CASH_IN' ? 'In' : 'Out'}`),
        reason:
          activeTab === 'EXPENSE'
            ? `Internal Expense: ${entry.expenseCategory}`
            : entry.purpose || (isCust ? `Customer ${activeTab === 'CASH_IN' ? 'Receipt' : 'Refund'}` : isVend ? `Vendor ${activeTab === 'CASH_IN' ? 'Repayment' : 'Payment'}` : `Cash ${activeTab === 'CASH_IN' ? 'In' : 'Out'}`),
        classification: finalClassification,
        expenseCategory: activeTab === 'EXPENSE' ? entry.expenseCategory : undefined
      })
    );

    setEntry({
      type: 'IN',
      amount: '',
      partyType: 'OTHER',
      customerId: '',
      vendorId: '',
      person: '',
      phone: '',
      address: '',
      purpose: '',
      classification: 'OFFICIAL',
      expenseCategory: EXPENSE_CATEGORIES[0]
    });
  };

  const handleCloseSession = async () => {
    const finalCounted = closingMode === 'DENOMINATIONS' ? closingDenominationTotal : (countedCash !== '' ? Number(countedCash) : undefined);
    await act(() =>
      api.post('/session/close', {
        countedCash: finalCounted,
        closingDenominations: closingMode === 'DENOMINATIONS' ? closingDenominations : undefined
      })
    );
    onClose();
  };

  const cashIn = (session?.cashEntries || []).filter((e) => e.type === 'IN').reduce((s, e) => s + e.amount, 0);
  const cashOut = (session?.cashEntries || []).filter((e) => e.type === 'OUT').reduce((s, e) => s + e.amount, 0);

  const cashInEntries = useMemo(() => {
    return (session?.cashEntries || []).filter((e) => e.type === 'IN').reverse();
  }, [session?.cashEntries]);

  const cashOutEntries = useMemo(() => {
    return (session?.cashEntries || []).filter((e) => e.type === 'OUT' && e.classification !== 'EXPENSE').reverse();
  }, [session?.cashEntries]);

  const expenseEntries = useMemo(() => {
    return (session?.cashEntries || []).filter((e) => e.classification === 'EXPENSE' || (e.expenseCategory && e.type === 'OUT')).reverse();
  }, [session?.cashEntries]);

  const cashOutOnly = useMemo(() => {
    return cashOutEntries.reduce((s, e) => s + e.amount, 0);
  }, [cashOutEntries]);

  const expenseTotal = useMemo(() => {
    return expenseEntries.reduce((s, e) => s + e.amount, 0);
  }, [expenseEntries]);

  const effectiveCounted = closingMode === 'DENOMINATIONS' ? closingDenominationTotal : (countedCash !== '' ? Number(countedCash) : session?.currentCash || 0);
  const variance = effectiveCounted - (session?.currentCash || 0);

  const filteredHistory = useMemo(() => {
    let entries = [...(session?.cashEntries || [])].reverse();
    if (historyFilter === 'IN') {
      entries = entries.filter((e) => e.type === 'IN');
    } else if (historyFilter === 'OUT') {
      entries = entries.filter((e) => e.type === 'OUT' && e.classification !== 'EXPENSE');
    } else if (historyFilter === 'EXPENSE') {
      entries = entries.filter((e) => e.classification === 'EXPENSE' || (e.expenseCategory && e.type === 'OUT'));
    } else if (historyFilter === 'CUSTOMER') {
      entries = entries.filter((e) => e.customerId || e.partyType === 'CUSTOMER');
    } else if (historyFilter === 'VENDOR') {
      entries = entries.filter((e) => e.vendorId || e.partyType === 'VENDOR' || e.classification === 'VENDOR_REPAY');
    }

    if (!historySearch.trim()) return entries;
    const q = historySearch.toLowerCase();
    return entries.filter((e) =>
      (e.person && e.person.toLowerCase().includes(q)) ||
      (e.reason && e.reason.toLowerCase().includes(q)) ||
      (e.classification && e.classification.toLowerCase().includes(q)) ||
      (e.type && e.type.toLowerCase().includes(q)) ||
      (e.partyType && e.partyType.toLowerCase().includes(q)) ||
      (e.expenseCategory && e.expenseCategory.toLowerCase().includes(q))
    );
  }, [session?.cashEntries, historyFilter, historySearch]);

  const addAmountPreset = (amt) => {
    const cur = Number(entry.amount) || 0;
    setEntry((prev) => ({ ...prev, amount: String(cur + amt) }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-[color:var(--text-primary)]">
                {isOpen ? 'Cash Counter' : 'Open Cash Counter Float'}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                isOpen
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}>
                <span className={`h-2 w-2 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {isOpen ? 'Live Shift Active' : 'Counter Closed'}
              </span>
            </div>
            <p className="text-[11px] text-[color:var(--text-secondary)]">
              {isOpen
                ? `Shift opened at ${fmtDateTime(session.openedAt)} by ${session.openedBy || 'Current Cashier'}`
                : 'Count note denominations and record initial drawer float to begin sales shift'}
            </p>
          </div>
        </div>
      }
      size="fullscreen"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="text-xs text-[color:var(--text-muted)] flex items-center gap-2">
            <span>Esc to close</span>
            {isOpen && (
              <>
                <span>•</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Live Drawer: {money(session.currentCash, { decimals: false })}
                </span>
              </>
            )}
          </div>
          <Button variant="subtle" onClick={onClose}>
            Close Drawer
          </Button>
        </div>
      }
    >
      {!isOpen ? (
        <div className="space-y-5 p-1 max-w-5xl mx-auto w-full">
          {/* Header Card for Shift Opening */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20">
            <div>
              <h4 className="text-sm font-bold text-[color:var(--text-primary)]">Record Opening Cash Float</h4>
              <p className="text-xs text-[color:var(--text-muted)]">
                Count notes by denomination or enter a quick lumpsum opening cash float to begin billing.
              </p>
            </div>
            <SegmentedControl
              value={openingMode}
              onChange={setOpeningMode}
              options={[
                { value: 'DENOMINATIONS', label: 'Count by Notes' },
                { value: 'LUMPSUM', label: 'Quick Lumpsum' }
              ]}
            />
          </div>

          {openingMode === 'DENOMINATIONS' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {CURRENCY_DENOMINATIONS.map((d) => {
                  const count = denominations[d.key] || 0;
                  const rowSum = count * d.value;
                  return (
                    <div
                      key={d.key}
                      className={`p-3.5 rounded-2xl border bg-[color:var(--bg-surface)] flex flex-col justify-between gap-2.5 transition-all shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 ${d.color}`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="font-mono text-sm">{d.label}</span>
                        <span className="tabular text-xs opacity-90 font-mono">
                          ₹{rowSum.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={denominations[d.key] === 0 ? '' : denominations[d.key]}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                            setDenominations({ ...denominations, [d.key]: val });
                          }}
                          placeholder="0 notes"
                          className="tabular w-full px-2.5 py-1.5 text-xs font-bold rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] text-right"
                        />
                        <button
                          type="button"
                          onClick={() => setDenominations({ ...denominations, [d.key]: (Number(denominations[d.key]) || 0) + 1 })}
                          className="px-2 py-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-subtle)] text-[11px] font-bold hover:bg-indigo-500 hover:text-white transition-colors"
                          title="Add 1 note"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() => setDenominations({ ...denominations, [d.key]: (Number(denominations[d.key]) || 0) + 5 })}
                          className="px-2 py-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-subtle)] text-[11px] font-bold hover:bg-indigo-500 hover:text-white transition-colors"
                          title="Add 5 notes"
                        >
                          +5
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Calculation Card */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
                    <Coins className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-sm font-bold opacity-90">Total Opening Cash Float</span>
                    <p className="text-xs opacity-75">Calculated from note denominations breakdown</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight">
                    ₹{denominationTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-6 bg-[color:var(--bg-surface)] border border-[color:var(--border)] space-y-4 max-w-xl mx-auto">
              <Field label="Opening cash float amount" required hint="Enter physical cash available in counter drawer">
                <Input
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  placeholder="e.g. 2000"
                  className="tabular text-xl font-bold py-2.5"
                  autoFocus
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                {[500, 1000, 2000, 3000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setOpeningCash(String(amt))}
                    className="px-3 py-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-subtle)] text-xs font-semibold hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                  >
                    ₹{amt.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              icon={Unlock}
              size="lg"
              loading={busy}
              onClick={handleOpenSession}
              className="px-8 py-3 font-bold shadow-lg shadow-indigo-500/25"
            >
              Confirm & Open Counter Shift
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          {/* Top 4 Live Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            <div className="p-3.5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-surface)] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[color:var(--text-muted)] uppercase tracking-wider">Opening Float</span>
                <div className="text-lg font-bold font-mono text-[color:var(--text-primary)] mt-0.5">
                  {money(session.openingCash, { decimals: false })}
                </div>
              </div>
              <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Wallet className="h-4 w-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/60 bg-emerald-500/5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Cash Received (+In)</span>
                <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  +{money(cashIn, { decimals: false })}
                </div>
              </div>
              <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold">
                <ArrowDownToLine className="h-4 w-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-rose-200/60 dark:border-rose-900/60 bg-rose-500/5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wider">Cash Outflows (−Out)</span>
                <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                  −{money(cashOut, { decimals: false })}
                </div>
              </div>
              <div className="h-9 w-9 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-300 flex items-center justify-center font-bold">
                <ArrowUpFromLine className="h-4 w-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-indigo-300 dark:border-indigo-700 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 shadow-sm flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Live Drawer Total</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-300 mt-0.5">
                  {money(session.currentCash, { decimals: false })}
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Tab Navigation Pill Bar */}
          <div className="flex items-center border-b border-[color:var(--border)] gap-1.5 overflow-x-auto pb-2 shrink-0">
            <button
              onClick={() => setActiveTab('CASH_IN')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'CASH_IN'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface)]'
              }`}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              + Cash In
            </button>
            <button
              onClick={() => setActiveTab('CASH_OUT')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'CASH_OUT'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface)]'
              }`}
            >
              <ArrowUpFromLine className="h-3.5 w-3.5" />
              − Cash Out
            </button>
            <button
              onClick={() => setActiveTab('EXPENSE')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'EXPENSE'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface)]'
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              Internal Expense
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'HISTORY'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface)]'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Audit Log ({session.cashEntries?.length || 0})
            </button>
            <button
              onClick={() => {
                resetClosingDenominations();
                setActiveTab('CLOSE');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ml-auto ${
                activeTab === 'CLOSE'
                  ? 'bg-red-700 text-white shadow-md'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40'
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              Close Shift & Reconcile
            </button>
          </div>

          {/* Tab 1: CASH IN */}
          {activeTab === 'CASH_IN' && (
            <div className="flex-1 overflow-y-auto space-y-4 rounded-2xl p-4 sm:p-6 bg-[color:var(--bg-surface)] border border-[color:var(--border)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[color:var(--border)]">
                <div>
                  <h4 className="text-sm font-bold text-[color:var(--text-primary)] flex items-center gap-2">
                    <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                    Record Cash Inflow to Drawer
                  </h4>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    Receive cash into drawer from a customer, vendor debt repayment/refund, float top-up, or other source.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SegmentedControl
                    value={entry.classification}
                    onChange={(cls) => setEntry({ ...entry, classification: cls })}
                    options={[
                      { value: 'OFFICIAL', label: 'Official Inflow' },
                      { value: 'UNOFFICIAL', label: 'Unofficial Inflow' }
                    ]}
                  />
                </div>
              </div>

              {/* Party Selection (Customer / Vendor / Other) */}
              <div className="rounded-2xl p-3.5 sm:p-4 bg-[color:var(--bg-subtle)] border border-[color:var(--border)] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[color:var(--text-secondary)] flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                    Received From (Party Type):
                  </span>
                  <div className="flex items-center gap-1 bg-[color:var(--bg-surface)] p-0.5 rounded-xl border border-[color:var(--border)]">
                    <button
                      type="button"
                      onClick={() => setEntry((prev) => ({ ...prev, partyType: 'CUSTOMER', vendorId: '', person: '' }))}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        entry.partyType === 'CUSTOMER'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                      }`}
                    >
                      Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntry((prev) => ({ ...prev, partyType: 'VENDOR', customerId: '', person: '' }))}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        entry.partyType === 'VENDOR'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                      }`}
                    >
                      Vendor
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntry((prev) => ({ ...prev, partyType: 'OTHER', customerId: '', vendorId: '' }))}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        entry.partyType === 'OTHER'
                          ? 'bg-zinc-700 text-white shadow-xs'
                          : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                      }`}
                    >
                      Other / Custom
                    </button>
                  </div>
                </div>

                {/* Customer Dropdown */}
                {entry.partyType === 'CUSTOMER' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Select Customer from Directory" hint="Auto-fills customer details">
                        <Select
                          value={entry.customerId || ''}
                          onChange={(e) => {
                            const cId = e.target.value;
                            const found = customers.find((c) => c.id === cId);
                            setEntry((prev) => ({
                              ...prev,
                              customerId: cId,
                              person: found ? found.name : prev.person,
                              purpose: prev.purpose || (found ? `Customer cash payment / advance from ${found.name}` : '')
                            }));
                          }}
                        >
                          <option value="">-- Choose Customer --</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.phone ? `(${c.phone})` : ''} {c.outstanding > 0 ? `· Due: ₹${c.outstanding}` : ''}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field label="Customer Name" required>
                        <Input
                          value={entry.person}
                          onChange={(e) => setEntry({ ...entry, person: e.target.value })}
                          placeholder="Customer name"
                        />
                      </Field>
                    </div>

                    {entry.customerId && (
                      <div className="flex items-center justify-between text-xs px-3.5 py-2 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-900 dark:text-blue-100 font-semibold">
                        <span>Customer: {customers.find((c) => c.id === entry.customerId)?.name} ({customers.find((c) => c.id === entry.customerId)?.phone || 'No phone'})</span>
                        <span>Current Outstanding / Due: {money(customers.find((c) => c.id === entry.customerId)?.outstanding || 0)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Vendor Dropdown */}
                {entry.partyType === 'VENDOR' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Select Vendor / Supplier" hint="Vendor debt repayment / credit refund">
                        <Select
                          value={entry.vendorId || ''}
                          onChange={(e) => {
                            const vId = e.target.value;
                            const found = vendors.find((v) => v.id === vId);
                            setEntry((prev) => ({
                              ...prev,
                              vendorId: vId,
                              person: found ? found.name : prev.person,
                              purpose: prev.purpose || (found ? `Debt repayment from ${found.name}` : '')
                            }));
                          }}
                        >
                          <option value="">-- Choose Vendor / Supplier --</option>
                          {vendors.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} {v.phone ? `(${v.phone})` : ''} {v.outstanding > 0 ? `· Due: ₹${v.outstanding}` : ''}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field label="Vendor / Supplier Name" required>
                        <Input
                          value={entry.person}
                          onChange={(e) => setEntry({ ...entry, person: e.target.value })}
                          placeholder="Vendor / Supplier name"
                        />
                      </Field>
                    </div>

                    {entry.vendorId && (
                      <div className="flex items-center justify-between text-xs px-3.5 py-2 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-900 dark:text-purple-100 font-semibold">
                        <span>Vendor: {vendors.find((v) => v.id === entry.vendorId)?.name}</span>
                        <span>Current Payable / Outstanding: {money(vendors.find((v) => v.id === entry.vendorId)?.outstanding || 0)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Other / Custom Text Input */}
                {entry.partyType === 'OTHER' && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Received From (Full Name)" required>
                        <Input
                          value={entry.person}
                          onChange={(e) => setEntry({ ...entry, person: e.target.value })}
                          placeholder="e.g. Cashier / Owner / Partner / Customer"
                        />
                      </Field>

                      <Field label="Phone Number" required>
                        <Input
                          type="tel"
                          value={entry.phone || ''}
                          onChange={(e) => setEntry({ ...entry, phone: e.target.value })}
                          placeholder="e.g. 9876543210"
                        />
                      </Field>
                    </div>

                    <Field label="Address">
                      <Input
                        value={entry.address || ''}
                        onChange={(e) => setEntry({ ...entry, address: e.target.value })}
                        placeholder="e.g. Shop / Street / City address"
                      />
                    </Field>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Amount (₹)" required>
                  <Input
                    type="number"
                    value={entry.amount}
                    onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
                    placeholder="e.g. 1000"
                    className="tabular text-base font-bold"
                    autoFocus
                  />
                </Field>

                <Field label="Purpose / Remarks">
                  <Input
                    value={entry.purpose}
                    onChange={(e) => setEntry({ ...entry, purpose: e.target.value })}
                    placeholder="e.g. Advance deposit / change float / balance settlement"
                  />
                </Field>
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs font-semibold text-[color:var(--text-muted)] mr-1">Quick Add:</span>
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => addAmountPreset(amt)}
                    className="px-2.5 py-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-subtle)] text-xs font-bold hover:bg-emerald-500 hover:text-white transition-colors"
                  >
                    +₹{amt.toLocaleString('en-IN')}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEntry((prev) => ({ ...prev, amount: '' }))}
                  className="px-2.5 py-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-subtle)] text-xs font-semibold text-[color:var(--text-muted)] hover:bg-rose-500 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>

              <div className="flex justify-end pt-3">
                <Button
                  variant="primary"
                  icon={ArrowDownToLine}
                  size="lg"
                  loading={busy}
                  disabled={
                    !entry.amount ||
                    Number(entry.amount) <= 0 ||
                    !entry.person?.trim() ||
                    (entry.partyType === 'OTHER' && !entry.phone?.trim())
                  }
                  onClick={handleRecordEntry}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-md"
                >
                  Confirm Cash In ({entry.person || 'Party'})
                </Button>
              </div>

              {/* Recent Cash In History */}
              <div className="pt-3 space-y-2.5 border-t border-[color:var(--border)]">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-[color:var(--text-primary)] flex items-center gap-1.5">
                    <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-600" />
                    Recent Cash In History ({cashInEntries.length})
                  </h5>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    Total Inflow: +{money(cashIn, { decimals: false })}
                  </span>
                </div>
                {cashInEntries.length === 0 ? (
                  <div className="py-4 text-center text-xs text-[color:var(--text-muted)] bg-[color:var(--bg-subtle)] rounded-xl border border-[color:var(--border)]">
                    No cash in recorded yet in this shift.
                  </div>
                ) : (
                  <DataTable
                    dense
                    columns={[
                      { key: 'time', label: 'Time', width: 120, render: (e) => fmtDateTime(e.time) },
                      {
                        key: 'party',
                        label: 'Received From',
                        render: (e) => (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              {e.customerId || e.partyType === 'CUSTOMER' ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                                  Customer
                                </span>
                              ) : e.vendorId || e.partyType === 'VENDOR' || e.classification === 'VENDOR_REPAY' ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                                  Vendor
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold">
                                  Other
                                </span>
                              )}
                              <span className="font-semibold text-xs text-[color:var(--text-primary)]">
                                {e.person || '—'}
                              </span>
                            </div>
                            {(e.phone || e.address) && (
                              <div className="text-[10.5px] text-[color:var(--text-muted)] flex items-center gap-2 mt-0.5 ml-0.5">
                                {e.phone && <span>Ph: {e.phone}</span>}
                                {e.address && <span className="truncate max-w-[180px]">{e.address}</span>}
                              </div>
                            )}
                          </div>
                        )
                      },
                      { key: 'reason', label: 'Purpose / Notes' },
                      {
                        key: 'amount',
                        label: 'Amount',
                        align: 'right',
                        width: 120,
                        render: (e) => (
                          <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            +₹{Number(e.amount).toLocaleString('en-IN')}
                          </span>
                        )
                      }
                    ]}
                    rows={cashInEntries}
                    rowKey={(e, i) => i}
                  />
                )}
              </div>
            </div>
          )}

          {/* Tab 2: CASH OUT */}
          {activeTab === 'CASH_OUT' && (
            <div className="flex-1 overflow-y-auto space-y-4 rounded-2xl p-4 sm:p-6 bg-[color:var(--bg-surface)] border border-[color:var(--border)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[color:var(--border)]">
                <div>
                  <h4 className="text-sm font-bold text-[color:var(--text-primary)] flex items-center gap-2">
                    <ArrowUpFromLine className="h-4 w-4 text-rose-600" />
                    Record Cash Outflow from Drawer
                  </h4>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    Record cash withdrawn for vendor payout, customer refund, bank deposit, or owner drawing.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SegmentedControl
                    value={entry.classification}
                    onChange={(cls) => setEntry({ ...entry, classification: cls })}
                    options={[
                      { value: 'OFFICIAL', label: 'Official Outflow' },
                      { value: 'UNOFFICIAL', label: 'Unofficial Outflow' }
                    ]}
                  />
                </div>
              </div>

              {/* Party Selection (Vendor / Customer / Other) */}
              <div className="rounded-2xl p-3.5 sm:p-4 bg-[color:var(--bg-subtle)] border border-[color:var(--border)] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[color:var(--text-secondary)] flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-rose-600" />
                    Paid / Issued To (Party Type):
                  </span>
                  <div className="flex items-center gap-1 bg-[color:var(--bg-surface)] p-0.5 rounded-xl border border-[color:var(--border)]">
                    <button
                      type="button"
                      onClick={() => setEntry((prev) => ({ ...prev, partyType: 'VENDOR', customerId: '', person: '' }))}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        entry.partyType === 'VENDOR'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                      }`}
                    >
                      Vendor
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntry((prev) => ({ ...prev, partyType: 'CUSTOMER', vendorId: '', person: '' }))}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        entry.partyType === 'CUSTOMER'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                      }`}
                    >
                      Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntry((prev) => ({ ...prev, partyType: 'OTHER', customerId: '', vendorId: '' }))}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        entry.partyType === 'OTHER'
                          ? 'bg-zinc-700 text-white shadow-xs'
                          : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                      }`}
                    >
                      Other / Custom
                    </button>
                  </div>
                </div>

                {/* Vendor Dropdown */}
                {entry.partyType === 'VENDOR' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Select Registered Vendor" hint="Vendor / Supplier payout">
                        <Select
                          value={entry.vendorId || ''}
                          onChange={(e) => {
                            const vId = e.target.value;
                            const found = vendors.find((v) => v.id === vId);
                            setEntry((prev) => ({
                              ...prev,
                              vendorId: vId,
                              person: found ? found.name : prev.person,
                              purpose: prev.purpose || (found ? `Supplier payment to ${found.name}` : '')
                            }));
                          }}
                        >
                          <option value="">-- Choose Vendor / Supplier --</option>
                          {vendors.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} {v.phone ? `(${v.phone})` : ''} {v.outstanding > 0 ? `· Due: ₹${v.outstanding}` : ''}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field label="Vendor / Supplier Name" required>
                        <Input
                          value={entry.person}
                          onChange={(e) => setEntry({ ...entry, person: e.target.value })}
                          placeholder="Vendor name"
                        />
                      </Field>
                    </div>

                    {entry.vendorId && (
                      <div className="flex items-center justify-between text-xs px-3.5 py-2 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-900 dark:text-purple-100 font-semibold">
                        <span>Vendor: {vendors.find((v) => v.id === entry.vendorId)?.name}</span>
                        <span>Current Payable / Outstanding: {money(vendors.find((v) => v.id === entry.vendorId)?.outstanding || 0)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Customer Dropdown */}
                {entry.partyType === 'CUSTOMER' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Select Registered Customer" hint="Customer refund / payout">
                        <Select
                          value={entry.customerId || ''}
                          onChange={(e) => {
                            const cId = e.target.value;
                            const found = customers.find((c) => c.id === cId);
                            setEntry((prev) => ({
                              ...prev,
                              customerId: cId,
                              person: found ? found.name : prev.person,
                              purpose: prev.purpose || (found ? `Customer refund payout to ${found.name}` : '')
                            }));
                          }}
                        >
                          <option value="">-- Choose Customer --</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.phone ? `(${c.phone})` : ''} {c.outstanding > 0 ? `· Due: ₹${c.outstanding}` : ''}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field label="Customer Name" required>
                        <Input
                          value={entry.person}
                          onChange={(e) => setEntry({ ...entry, person: e.target.value })}
                          placeholder="Customer name"
                        />
                      </Field>
                    </div>

                    {entry.customerId && (
                      <div className="flex items-center justify-between text-xs px-3.5 py-2 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-900 dark:text-blue-100 font-semibold">
                        <span>Customer: {customers.find((c) => c.id === entry.customerId)?.name}</span>
                        <span>Current Outstanding / Due: {money(customers.find((c) => c.id === entry.customerId)?.outstanding || 0)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Other / Custom Text Input */}
                {entry.partyType === 'OTHER' && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Paid To / Issued To (Full Name)" required>
                        <Input
                          value={entry.person}
                          onChange={(e) => setEntry({ ...entry, person: e.target.value })}
                          placeholder="e.g. Delivery partner / Owner / Bank / Vendor"
                        />
                      </Field>

                      <Field label="Phone Number" required>
                        <Input
                          type="tel"
                          value={entry.phone || ''}
                          onChange={(e) => setEntry({ ...entry, phone: e.target.value })}
                          placeholder="e.g. 9876543210"
                        />
                      </Field>
                    </div>

                    <Field label="Address">
                      <Input
                        value={entry.address || ''}
                        onChange={(e) => setEntry({ ...entry, address: e.target.value })}
                        placeholder="e.g. Shop / Street / City address"
                      />
                    </Field>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Amount (₹)" required>
                  <Input
                    type="number"
                    value={entry.amount}
                    onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
                    placeholder="e.g. 500"
                    className="tabular text-base font-bold"
                    autoFocus
                  />
                </Field>

                <Field label="Purpose / Reason">
                  <Input
                    value={entry.purpose}
                    onChange={(e) => setEntry({ ...entry, purpose: e.target.value })}
                    placeholder="e.g. Bank deposit / Supplier cash payout / Customer return refund"
                  />
                </Field>
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs font-semibold text-[color:var(--text-muted)] mr-1">Quick Add:</span>
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => addAmountPreset(amt)}
                    className="px-2.5 py-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-subtle)] text-xs font-bold hover:bg-rose-500 hover:text-white transition-colors"
                  >
                    +₹{amt.toLocaleString('en-IN')}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEntry((prev) => ({ ...prev, amount: '' }))}
                  className="px-2.5 py-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-subtle)] text-xs font-semibold text-[color:var(--text-muted)] hover:bg-rose-500 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>

              <div className="flex justify-end pt-3">
                <Button
                  variant="primary"
                  icon={ArrowUpFromLine}
                  size="lg"
                  loading={busy}
                  disabled={
                    !entry.amount ||
                    Number(entry.amount) <= 0 ||
                    !entry.person?.trim() ||
                    (entry.partyType === 'OTHER' && !entry.phone?.trim())
                  }
                  onClick={handleRecordEntry}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 shadow-md"
                >
                  Confirm Cash Out ({entry.person || 'Party'})
                </Button>
              </div>

              {/* Recent Cash Out History */}
              <div className="pt-3 space-y-2.5 border-t border-[color:var(--border)]">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-[color:var(--text-primary)] flex items-center gap-1.5">
                    <ArrowUpFromLine className="h-3.5 w-3.5 text-rose-600" />
                    Recent Cash Out History ({cashOutEntries.length})
                  </h5>
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">
                    Total Outflow: −{money(cashOutOnly, { decimals: false })}
                  </span>
                </div>
                {cashOutEntries.length === 0 ? (
                  <div className="py-4 text-center text-xs text-[color:var(--text-muted)] bg-[color:var(--bg-subtle)] rounded-xl border border-[color:var(--border)]">
                    No cash out recorded yet in this shift.
                  </div>
                ) : (
                  <DataTable
                    dense
                    columns={[
                      { key: 'time', label: 'Time', width: 120, render: (e) => fmtDateTime(e.time) },
                      {
                        key: 'party',
                        label: 'Paid / Issued To',
                        render: (e) => (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              {e.customerId || e.partyType === 'CUSTOMER' ? (
                                 <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                                   Customer
                                 </span>
                              ) : e.vendorId || e.partyType === 'VENDOR' ? (
                                 <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                                   Vendor
                                 </span>
                              ) : (
                                 <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold">
                                   Other
                                 </span>
                              )}
                              <span className="font-semibold text-xs text-[color:var(--text-primary)]">
                                {e.person || '—'}
                              </span>
                            </div>
                            {(e.phone || e.address) && (
                              <div className="text-[10.5px] text-[color:var(--text-muted)] flex items-center gap-2 mt-0.5 ml-0.5">
                                {e.phone && <span>Ph: {e.phone}</span>}
                                {e.address && <span className="truncate max-w-[180px]">{e.address}</span>}
                              </div>
                            )}
                          </div>
                        )
                      },
                      { key: 'reason', label: 'Purpose / Reason' },
                      {
                        key: 'amount',
                        label: 'Amount',
                        align: 'right',
                        width: 120,
                        render: (e) => (
                          <span className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                            −₹{Number(e.amount).toLocaleString('en-IN')}
                          </span>
                        )
                      }
                    ]}
                    rows={cashOutEntries}
                    rowKey={(e, i) => i}
                  />
                )}
              </div>
            </div>
          )}

          {/* Tab 3: INTERNAL EXPENSE */}
          {activeTab === 'EXPENSE' && (
            <div className="flex-1 overflow-y-auto space-y-4 rounded-2xl p-4 sm:p-6 bg-[color:var(--bg-surface)] border border-amber-200 dark:border-amber-900/50">
              <div className="flex items-center justify-between pb-3 border-b border-amber-200/50 dark:border-amber-900/50">
                <div>
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Shop Internal Petty Expense Entry
                  </h4>
                  <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                    Records shop operational expenses paid directly from counter drawer cash and automatically posts an accounting voucher.
                  </p>
                </div>
              </div>

              {/* Expense Category Cards */}
              <div>
                <span className="text-xs font-bold text-[color:var(--text-secondary)] block mb-2">Select Expense Category:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const isSelected = entry.expenseCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setEntry({ ...entry, expenseCategory: cat })}
                        className={`flex items-center justify-center p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-100 shadow-xs'
                            : 'border-[color:var(--border)] bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] hover:border-amber-300'
                        }`}
                      >
                        <span className="truncate">{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Expense Amount (₹)" required>
                  <Input
                    type="number"
                    value={entry.amount}
                    onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
                    placeholder="e.g. 150"
                    className="tabular text-base font-bold"
                    autoFocus
                  />
                </Field>

                <Field label="Paid To (Shop / Person / Vendor)">
                  <Input
                    value={entry.person}
                    onChange={(e) => setEntry({ ...entry, person: e.target.value })}
                    placeholder="e.g. Tea stall / Courier / Electrician"
                  />
                </Field>

                <Field label="Expense Remarks / Item Details">
                  <Input
                    value={entry.purpose}
                    onChange={(e) => setEntry({ ...entry, purpose: e.target.value })}
                    placeholder="e.g. Evening staff tea & biscuits"
                  />
                </Field>
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs font-semibold text-[color:var(--text-muted)] mr-1">Quick Add:</span>
                {[50, 100, 150, 200, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => addAmountPreset(amt)}
                    className="px-2.5 py-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-subtle)] text-xs font-bold hover:bg-amber-500 hover:text-white transition-colors"
                  >
                    +₹{amt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEntry((prev) => ({ ...prev, amount: '' }))}
                  className="px-2.5 py-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-subtle)] text-xs font-semibold text-[color:var(--text-muted)] hover:bg-rose-500 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>

              <div className="flex justify-end pt-3">
                <Button
                  variant="primary"
                  icon={ArrowUpFromLine}
                  size="lg"
                  loading={busy}
                  disabled={!entry.amount}
                  onClick={handleRecordEntry}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 shadow-md"
                >
                  Confirm Internal Expense
                </Button>
              </div>

              {/* Recent Internal Expenses History */}
              <div className="pt-3 space-y-2.5 border-t border-amber-200/60 dark:border-amber-900/60">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Recent Internal Expenses ({expenseEntries.length})
                  </h5>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
                    Total Expenses: −{money(expenseTotal, { decimals: false })}
                  </span>
                </div>
                {expenseEntries.length === 0 ? (
                  <div className="py-4 text-center text-xs text-[color:var(--text-muted)] bg-[color:var(--bg-subtle)] rounded-xl border border-[color:var(--border)]">
                    No internal expenses recorded yet in this shift.
                  </div>
                ) : (
                  <DataTable
                    dense
                    columns={[
                      { key: 'time', label: 'Time', width: 120, render: (e) => fmtDateTime(e.time) },
                      {
                        key: 'category',
                        label: 'Category',
                        width: 160,
                        render: (e) => (
                          <Badge tone="warning">
                            {e.expenseCategory || 'Expense'}
                          </Badge>
                        )
                      },
                      { key: 'person', label: 'Paid To', render: (e) => e.person || '—' },
                      { key: 'reason', label: 'Remarks / Purpose' },
                      {
                        key: 'amount',
                        label: 'Amount',
                        align: 'right',
                        width: 120,
                        render: (e) => (
                          <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                            −₹{Number(e.amount).toLocaleString('en-IN')}
                          </span>
                        )
                      }
                    ]}
                    rows={expenseEntries}
                    rowKey={(e, i) => i}
                  />
                )}
              </div>
            </div>
          )}

          {/* Tab 4: AUDIT HISTORY */}
          {activeTab === 'HISTORY' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3 rounded-2xl p-4 sm:p-6 bg-[color:var(--bg-surface)] border border-[color:var(--border)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <h4 className="text-sm font-bold text-[color:var(--text-primary)] flex items-center gap-2">
                    <History className="h-4 w-4 text-indigo-600" />
                    Shift Cash Movements & Audit History
                  </h4>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    Combined chronological audit ledger showing all cash in, cash out, and expense movements.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap items-center gap-1 bg-[color:var(--bg-subtle)] p-1 rounded-xl border border-[color:var(--border)]">
                    {[
                      { id: 'ALL', label: `All (${session.cashEntries?.length || 0})` },
                      { id: 'IN', label: `Cash In (${cashInEntries.length})` },
                      { id: 'OUT', label: `Cash Out (${cashOutEntries.length})` },
                      { id: 'EXPENSE', label: `Expenses (${expenseEntries.length})` },
                      { id: 'CUSTOMER', label: 'Customers' },
                      { id: 'VENDOR', label: 'Vendors' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setHistoryFilter(tab.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                          historyFilter === tab.id
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative min-w-[200px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="Search movements…"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] text-xs font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                {filteredHistory.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[color:var(--text-muted)]">
                    {historySearch ? 'No movements matching your search query.' : 'No cash movements recorded yet in this shift.'}
                  </div>
                ) : (
                  <DataTable
                    dense
                    columns={[
                      { key: 'time', label: 'Time', width: 120, render: (e) => fmtDateTime(e.time) },
                      {
                        key: 'type',
                        label: 'Direction',
                        width: 100,
                        render: (e) => (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            e.type === 'IN'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                          }`}>
                            {e.type === 'IN' ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}
                            {e.type === 'IN' ? 'CASH IN' : 'CASH OUT'}
                          </span>
                        )
                      },
                      {
                        key: 'party',
                        label: 'Party / Recipient',
                        render: (e) => (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              {e.customerId || e.partyType === 'CUSTOMER' ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                                  Customer
                                </span>
                              ) : e.vendorId || e.partyType === 'VENDOR' || e.classification === 'VENDOR_REPAY' ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                                  Vendor
                                </span>
                              ) : e.classification === 'EXPENSE' ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                                  Expense
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold">
                                  Other
                                </span>
                              )}
                              <span className="font-semibold text-xs text-[color:var(--text-primary)]">
                                {e.person || '—'}
                              </span>
                            </div>
                            {(e.phone || e.address) && (
                              <div className="text-[10.5px] text-[color:var(--text-muted)] flex items-center gap-2 mt-0.5 ml-0.5">
                                {e.phone && <span>Ph: {e.phone}</span>}
                                {e.address && <span className="truncate max-w-[180px]">{e.address}</span>}
                              </div>
                            )}
                          </div>
                        )
                      },
                      {
                        key: 'classification',
                        label: 'Classification',
                        width: 140,
                        render: (e) => (
                          <Badge
                            tone={
                              e.classification === 'VENDOR_REPAY' || e.classification === 'VENDOR_PAYMENT'
                                ? 'accent'
                                : e.classification === 'CUSTOMER_ENTRY'
                                ? 'primary'
                                : e.classification === 'EXPENSE'
                                ? 'warning'
                                : e.classification === 'UNOFFICIAL'
                                ? 'neutral'
                                : 'success'
                            }
                          >
                            {e.classification === 'VENDOR_REPAY' ? 'VENDOR REPAY' : e.classification === 'CUSTOMER_ENTRY' ? 'CUSTOMER' : e.classification || 'OFFICIAL'}
                          </Badge>
                        )
                      },
                      { key: 'reason', label: 'Reason / Notes' },
                      {
                        key: 'amount',
                        label: 'Amount',
                        align: 'right',
                        width: 120,
                        render: (e) => (
                          <span className={`font-mono font-bold text-xs ${e.type === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {e.type === 'IN' ? '+' : '−'}₹{Number(e.amount).toLocaleString('en-IN')}
                          </span>
                        )
                      }
                    ]}
                    rows={filteredHistory}
                    rowKey={(e, i) => i}
                  />
                )}
              </div>
            </div>
          )}

          {/* Tab 5: CLOSE & RECONCILE */}
          {activeTab === 'CLOSE' && (
            <div className="flex-1 overflow-y-auto space-y-4 rounded-2xl p-4 sm:p-6 bg-[color:var(--bg-surface)] border border-red-200 dark:border-red-900/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[color:var(--border)]">
                <div>
                  <h4 className="text-sm font-bold text-red-900 dark:text-red-200 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-red-600" />
                    Counter Shift Closure & Physical Cash Reconciliation
                  </h4>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    Count physical currency notes in the counter drawer to reconcile against calculated shift sales and compute cash variance.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {closingMode === 'DENOMINATIONS' && (
                    <button
                      type="button"
                      onClick={resetClosingDenominations}
                      className="px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-800 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-bold hover:bg-red-500 hover:text-white transition-colors"
                      title="Clear all note counts"
                    >
                      Clear Breakdown
                    </button>
                  )}
                  <SegmentedControl
                    value={closingMode}
                    onChange={setClosingMode}
                    options={[
                      { value: 'DENOMINATIONS', label: 'Count by Notes' },
                      { value: 'LUMPSUM', label: 'Quick Lumpsum' }
                    ]}
                  />
                </div>
              </div>

              {closingMode === 'DENOMINATIONS' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {CURRENCY_DENOMINATIONS.map((d) => {
                      const count = closingDenominations[d.key] || 0;
                      const rowSum = count * d.value;
                      return (
                        <div
                          key={d.key}
                          className={`p-3 rounded-xl border bg-[color:var(--bg-surface)] flex flex-col justify-between gap-2 transition-all shadow-xs hover:border-red-400 dark:hover:border-red-600 ${d.color}`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="font-mono text-xs">{d.label}</span>
                            <span className="tabular text-[11px] opacity-90 font-mono">
                              ₹{rowSum.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={closingDenominations[d.key] === 0 ? '' : closingDenominations[d.key]}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                                setClosingDenominations({ ...closingDenominations, [d.key]: val });
                              }}
                              placeholder="0"
                              className="tabular w-full px-2 py-1 text-xs font-bold rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-right"
                            />
                            <button
                              type="button"
                              onClick={() => setClosingDenominations({ ...closingDenominations, [d.key]: (Number(closingDenominations[d.key]) || 0) + 1 })}
                              className="px-1.5 py-1 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-subtle)] text-[10.5px] font-bold hover:bg-red-500 hover:text-white transition-colors"
                              title="Add 1"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => setClosingDenominations({ ...closingDenominations, [d.key]: (Number(closingDenominations[d.key]) || 0) + 5 })}
                              className="px-1.5 py-1 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-subtle)] text-[10.5px] font-bold hover:bg-red-500 hover:text-white transition-colors"
                              title="Add 5"
                            >
                              +5
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl p-4 bg-[color:var(--bg-subtle)] border border-[color:var(--border)] max-w-md">
                  <Field label="Physically counted cash in drawer" hint="Any variance will be permanently recorded in shift audit reports">
                    <Input
                      type="number"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      placeholder={String(session.currentCash)}
                      className="tabular text-base font-bold"
                    />
                  </Field>
                </div>
              )}

              {/* Reconciliation Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-gradient-to-r from-slate-500/5 via-slate-500/10 to-slate-500/5 border border-[color:var(--border)]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[color:var(--text-muted)] tracking-wider">System Expected Cash</span>
                  <div className="text-xl font-bold font-mono text-[color:var(--text-primary)] mt-1">
                    {money(session.currentCash)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[color:var(--text-muted)] tracking-wider">Physically Counted</span>
                  <div className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                    ₹{effectiveCounted.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[color:var(--text-muted)] tracking-wider">Reconciliation Variance</span>
                  <div className={`text-xl font-bold font-mono mt-1 ${variance === 0 ? 'text-emerald-600 dark:text-emerald-400' : variance > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {variance >= 0 ? `+₹${variance.toLocaleString('en-IN')}` : `−₹${Math.abs(variance).toLocaleString('en-IN')}`}
                    <span className="text-xs font-normal ml-1.5 opacity-90">
                      {variance === 0 ? '✓ Matched' : variance > 0 ? '↑ Excess' : '↓ Shortage'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="danger"
                  icon={Lock}
                  size="lg"
                  loading={busy}
                  onClick={handleCloseSession}
                  className="bg-red-700 hover:bg-red-800 text-white font-bold px-8 py-3 shadow-lg shadow-red-500/25"
                >
                  Confirm & Permanently Close Counter Shift
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * Table management — SOW Module 19.
 *
 * Three things happen on one grid, so the grid works in modes: normally a tap
 * assigns the current bill to a table; while a move is armed the next tap is the
 * destination. Transfer needs a free destination, merge needs a busy one, which
 * is why the armed mode dims the tables that cannot receive the action.
 */
function TablesModal({ open, tables, selectedId, onSelect, onClose, showToast, onChanged }) {
  const [pending, setPending] = useState(null); // { mode: 'TRANSFER' | 'MERGE', tableId }
  const [busy, setBusy] = useState(false);

  // Arming a move and then closing the sheet should not leave it armed.
  useEffect(() => {
    if (!open) setPending(null);
  }, [open]);

  const source = pending ? tables.find((t) => t.id === pending.tableId) : null;

  const runMove = async (target) => {
    if (!pending || target.id === pending.tableId) {
      setPending(null);
      return;
    }

    setBusy(true);
    try {
      const res =
        pending.mode === 'MERGE'
          ? await api.post('/tables/merge', { sourceTableId: pending.tableId, targetTableId: target.id })
          : await api.post('/tables/transfer', { fromTableId: pending.tableId, toTableId: target.id });

      showToast(res.message);
      setPending(null);
      onChanged();
    } catch (err) {
      showToast(
        api.message(err, pending.mode === 'MERGE' ? 'Could not merge the tables.' : 'Could not transfer the table.'),
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  // Transfer needs an empty table; merge needs another running bill to fold into.
  const canReceive = (table) => {
    if (!pending) return true;
    if (table.id === pending.tableId) return false;
    return pending.mode === 'MERGE' ? table.status === 'OCCUPIED' && table.bill : table.status !== 'OCCUPIED';
  };

  const handleTap = (table) => {
    if (busy) return;
    if (pending) {
      if (!canReceive(table)) {
        showToast(
          pending.mode === 'MERGE'
            ? `${table.name} has no running bill to merge into.`
            : `${table.name} is occupied — merge instead of transferring.`,
          'error'
        );
        return;
      }
      runMove(table);
      return;
    }
    onSelect(table.id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tables"
      subtitle={
        pending
          ? pending.mode === 'MERGE'
            ? `Pick the table to merge ${source?.name} into.`
            : `Pick the free table to move ${source?.name} to.`
          : 'Assign this bill to a table, move a running bill, or merge two tables.'
      }
      icon={LayoutGrid}
      size="lg"
      footer={
        <>
          {pending ? (
            <Button className="mr-auto" onClick={() => setPending(null)}>
              Cancel {pending.mode === 'MERGE' ? 'merge' : 'transfer'}
            </Button>
          ) : (
            selectedId && (
              <Button className="mr-auto" onClick={() => onSelect('')}>
                Clear table
              </Button>
            )
          )}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {tables.length === 0 ? (
        <EmptyState title="No tables configured" hint="Add tables under Settings → Tables." />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {tables.map((table) => {
            const occupied = table.status === 'OCCUPIED';
            const isSelected = selectedId === table.id;
            const isSource = pending?.tableId === table.id;
            const receivable = canReceive(table);

            return (
              <div
                key={table.id}
                onClick={() => handleTap(table)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleTap(table)}
                className={`surface cursor-pointer rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 ${
                  isSelected ? 'ring-2 ring-indigo-500' : ''
                } ${isSource ? 'ring-2 ring-amber-500' : ''} ${
                  pending && !receivable ? 'pointer-events-none opacity-40' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-[15px] font-bold text-[color:var(--text-primary)]">{table.name}</span>
                  <Badge tone={isSource ? 'accent' : occupied ? 'warning' : 'success'}>
                    {isSource ? 'Moving' : occupied ? 'Busy' : 'Free'}
                  </Badge>
                </div>
                <div className="mt-1 text-[10.5px] text-[color:var(--text-muted)]">
                  {table.area} · {table.seats} seats
                </div>

                {table.bill && (
                  <div className="mt-2 border-t pt-1.5" style={{ borderColor: 'var(--border)' }}>
                    <Money value={table.bill.total} className="text-[13px] font-bold" />
                    <div className="text-[10px] text-[color:var(--text-muted)]">
                      {table.bill.items.length} items running
                    </div>

                    {!pending && (
                      <div className="mt-1 flex items-center gap-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPending({ mode: 'TRANSFER', tableId: table.id });
                          }}
                          className="text-[10px] font-bold text-[color:var(--accent)]"
                        >
                          Transfer →
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPending({ mode: 'MERGE', tableId: table.id });
                          }}
                          className="text-[10px] font-bold text-amber-600 dark:text-amber-400"
                        >
                          Merge ⇢
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pending?.mode === 'MERGE' && (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          Merging moves every item from {source?.name} onto the destination's bill and frees {source?.name}. Matching
          items are combined rather than duplicated.
        </div>
      )}
    </Modal>
  );
}

function RecentBillsModal({ open, onClose, onReprint, showToast }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchOrders = useCallback(() => {
    setLoading(true);
    api
      .get('/orders', { limit: 100 })
      .then((data) => setOrders(data || []))
      .catch((err) => showToast(api.message(err), 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    if (!open) return;
    fetchOrders();
  }, [open, fetchOrders]);

  const voidBill = async (order) => {
    if (!window.confirm(`Void ${order.orderId}? Stock will be restored and the accounting entries reversed.`)) return;
    try {
      const res = await api.post(`/orders/${order.orderId}/void`);
      showToast(res.message);
      setOrders((prev) => prev.map((o) => (o.orderId === order.orderId ? { ...o, status: 'VOID' } : o)));
    } catch (err) {
      showToast(api.message(err, 'Could not void the bill.'), 'error');
    }
  };

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (o) =>
        (o.orderId || '').toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.customerPhone || '').includes(q) ||
        (o.paymentMethod || '').toLowerCase().includes(q)
    );
  }, [orders, search]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Recent Bills"
      subtitle="Reprint a receipt or void a mistaken bill."
      icon={Receipt}
      size="xl"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by invoice #, customer, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field-input text-xs"
              style={{ paddingLeft: '2.1rem' }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button size="sm" icon={RotateCcw} onClick={fetchOrders} loading={loading}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <DataTable
            maxHeight="52vh"
            dense
            columns={[
              { key: 'orderId', label: 'Invoice', width: 140, render: (o) => <span className="tabular font-bold text-indigo-600 dark:text-indigo-400">{o.orderId}</span> },
              { key: 'date', label: 'When', width: 120, render: (o) => fmtDateTime(o.date) },
              { key: 'customerName', label: 'Customer', width: 140, render: (o) => <span className="font-semibold">{o.customerName || 'Walk-in'}</span> },
              {
                key: 'items',
                label: 'Products Bought',
                render: (o) => {
                  const summary = (o.items || [])
                    .map((it) => `${it.name || it.printName || 'Item'} × ${it.qty}${it.unit ? ` ${it.unit}` : ''}`)
                    .join(', ');
                  return (
                    <div className="max-w-[260px] truncate text-[11px] font-mono text-[color:var(--text-secondary)]" title={summary}>
                      {summary || `${(o.items || []).length} items`}
                    </div>
                  );
                }
              },
              { key: 'paymentMethod', label: 'Mode', width: 100, render: (o) => <Badge>{o.paymentMethod}</Badge> },
              { key: 'total', label: 'Total', align: 'right', width: 110, render: (o) => <Money value={o.total} className="font-bold" /> },
              {
                key: 'status',
                label: 'Status',
                width: 80,
                render: (o) => <Badge tone={o.status === 'VOID' ? 'danger' : 'success'}>{o.status === 'VOID' ? 'Void' : 'OK'}</Badge>
              },
              {
                key: 'actions',
                label: '',
                align: 'right',
                width: 150,
                render: (o) => (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" icon={Printer} onClick={() => onReprint(o)}>
                      Reprint
                    </Button>
                    {o.status !== 'VOID' && (
                      <Button size="sm" variant="ghost" icon={X} onClick={() => voidBill(o)} className="text-rose-500" />
                    )}
                  </div>
                )
              }
            ]}
            rows={filteredOrders}
            rowKey={(o) => o.orderId}
            empty={<EmptyState icon={Receipt} title="No bills found" hint="Completed bills will appear here." />}
          />
        )}
      </div>
    </Modal>
  );
}

function QuickCustomerModal({ open, onClose, onCreated, priceSheets = [], showToast }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [group, setGroup] = useState('Retail');
  const [creditLimit, setCreditLimit] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setGstin('');
      setPan('');
      setGroup('Retail');
      setCreditLimit('');
      setSheetId('');
    }
  }, [open]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter the customer name.', 'error');
      return;
    }
    if (!phone.trim()) {
      showToast('Please enter the mobile number.', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/customers', {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        gstin: gstin.trim(),
        pan: pan.trim(),
        group,
        creditLimit: Number(creditLimit) || 0,
        priceSheetId: sheetId || null
      });

      const newCustomer = res.data;
      showToast(`Customer "${newCustomer.name}" created and selected!`);
      onCreated(newCustomer);
      onClose();
    } catch (err) {
      showToast(api.message(err, 'Failed to create customer.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add New Customer"
      subtitle="Register customer details to link with this bill."
      icon={UserPlus}
      size="md"
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" icon={UserPlus} onClick={handleSubmit} loading={saving}>
            Save & Select Customer
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <Field label="Customer Name *" hint="Full name of customer">
          <Input
            autoFocus
            placeholder="e.g. Rahul Sharma"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>

        <Field label="Mobile Number *" hint="10-digit phone number for receipts & SMS">
          <Input
            type="tel"
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Customer Group">
            <Select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="Retail">Retail</option>
              <option value="Wholesale">Wholesale</option>
              <option value="VIP">VIP</option>
              <option value="Corporate">Corporate</option>
            </Select>
          </Field>

          <Field label="Credit Limit (₹)" hint="Max credit allowed">
            <Input
              type="number"
              placeholder="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
            />
          </Field>
        </div>

        {priceSheets.length > 0 && (
          <Field label="Price Sheet" hint="Prices from this sheet apply automatically whenever this customer is billed">
            <Select value={sheetId} onChange={(e) => setSheetId(e.target.value)}>
              <option value="">None — use group / standard pricing</option>
              {priceSheets.filter((s) => s.isActive).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.customerType ? ` · ${s.customerType}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Email Address" hint="Optional for invoice email">
          <Input
            type="email"
            placeholder="e.g. rahul@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Address / City" hint="Optional delivery or billing address">
          <Input
            placeholder="e.g. MG Road, Bengaluru"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="GSTIN" hint="For B2B customers — printed on tax invoices">
            <Input
              placeholder="29AABCM1234K1Z5"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="PAN">
            <Input
              placeholder="AABCM1234K"
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

