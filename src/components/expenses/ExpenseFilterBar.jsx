import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useLang } from '@/hooks/useLang';
import { CATEGORIES } from '@/lib/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = '__all__';

export function ExpenseFilterBar({ filters, onChange }) {
  const { lang } = useLang();
  const [expanded, setExpanded] = useState(false);
  const isActive = filters.text || filters.category !== ALL;

  const close = () => {
    setExpanded(false);
    onChange({ text: '', category: ALL });
  };

  if (!expanded && !isActive) {
    return (
      <Button variant="ghost" size="icon" onClick={() => setExpanded(true)} title={lang === 'he' ? 'חיפוש וסינון' : 'Search & filter'}>
        <Search className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, width: 0 }}
        animate={{ opacity: 1, width: 'auto' }}
        exit={{ opacity: 0, width: 0 }}
        className="flex items-center gap-2 overflow-hidden"
      >
        <Input
          autoFocus
          value={filters.text}
          onChange={(e) => onChange({ ...filters, text: e.target.value })}
          placeholder={lang === 'he' ? 'חיפוש הוצאה...' : 'Search expenses...'}
          className="h-9 w-40 sm:w-56"
        />
        <Select value={filters.category} onValueChange={(v) => onChange({ ...filters, category: v })}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{lang === 'he' ? 'כל הקטגוריות' : 'All categories'}</SelectItem>
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <SelectItem key={key} value={key}>
                {cat.label[lang]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={close}>
          <X className="h-4 w-4" />
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}

export { ALL as FILTER_ALL_CATEGORIES };
