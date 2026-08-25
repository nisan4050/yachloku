import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { he, enUS } from 'date-fns/locale';

const locales = { he, en: enUS };

export function formatDate(date, lang = 'he', pattern = 'd MMM yyyy') {
  return format(new Date(date), pattern, { locale: locales[lang] ?? he });
}

export function formatRelativeTime(date, lang = 'he') {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: locales[lang] ?? he });
}

export function formatDateTime(date, lang = 'he') {
  return format(new Date(date), 'd MMM yyyy, HH:mm', { locale: locales[lang] ?? he });
}

export function formatChatTimestamp(date, lang = 'he') {
  const d = new Date(date);
  if (isToday(d)) return format(d, 'HH:mm', { locale: locales[lang] ?? he });
  if (isYesterday(d)) return lang === 'he' ? 'אתמול' : 'Yesterday';
  return format(d, 'd MMM', { locale: locales[lang] ?? he });
}
