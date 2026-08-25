import { Utensils, Bed, Bus, ShoppingBag, PartyPopper, Wine, ShoppingCart, Receipt } from 'lucide-react';

export const CATEGORIES = {
  food: { icon: Utensils, emoji: '🍔', color: '#f97316', label: { he: 'אוכל', en: 'Food' } },
  accommodation: { icon: Bed, emoji: '🏨', color: '#1e9e6e', label: { he: 'לינה', en: 'Accommodation' } },
  transport: { icon: Bus, emoji: '🚌', color: '#14b8a6', label: { he: 'תחבורה', en: 'Transport' } },
  shopping: { icon: ShoppingBag, emoji: '🛍️', color: '#ec4899', label: { he: 'קניות', en: 'Shopping' } },
  entertainment: { icon: PartyPopper, emoji: '🎉', color: '#a855f7', label: { he: 'בילויים', en: 'Entertainment' } },
  drinks: { icon: Wine, emoji: '🍷', color: '#e11d48', label: { he: 'שתייה', en: 'Drinks' } },
  groceries: { icon: ShoppingCart, emoji: '🛒', color: '#eab308', label: { he: 'סופרמרקט', en: 'Groceries' } },
  other: { icon: Receipt, emoji: '🧾', color: '#64748b', label: { he: 'אחר', en: 'Other' } },
};

export function getCategory(key) {
  return CATEGORIES[key] ?? CATEGORIES.other;
}
