# יחלוקו (Yachloku)

אפליקציית PWA לניהול הוצאות משותפות בטיולים ואירועים קבוצתיים — React + Vite + Tailwind + Supabase.

## הרצה מקומית

1. **צרו פרויקט Supabase** ב-[supabase.com](https://supabase.com).
2. **הריצו את סכמת ה-DB**: פתחו את ה-SQL Editor בפרויקט והדביקו את התוכן של [`supabase/01_schema.sql`](supabase/01_schema.sql), או הריצו `supabase db push` אם מחוברים דרך ה-CLI. הסכמה כוללת את כל הטבלאות, RLS policies, buckets לאחסון (קבלות/תמונות/מדיה), ו-Realtime.
3. הפעילו **Google OAuth** (אופציונלי) תחת Authentication → Providers, אם רוצים כניסה עם Google.
4. **הגדירו משתני סביבה**: העתיקו את `.env.example` ל-`.env` ומלאו:
   ```bash
   cp .env.example .env
   ```
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — מתוך Project Settings → API.
   - `VITE_VAPID_PUBLIC_KEY` — מפתח VAPID ציבורי להתראות Web Push (ייצור זוג מפתחות עם `npx web-push generate-vapid-keys`). ניתן להשאיר ריק אם לא רוצים Push בשלב זה.
5. **התקינו תלויות והריצו**:
   ```bash
   npm install
   npm run dev
   ```

## מבנה הפרויקט

```
src/
  api/          קריאות ל-Supabase (events, expenses, payments)
  components/
    events/     EventCard, GroupChat, EditEventModal, PhotosGallery, EventStats
    expenses/   ExpenseItem, AddExpenseModal
    layout/     AppShell (ניווט, כותרת עליונה, מצב כהה/בהיר, שפה)
    notifications/
    settlements/ BalanceCard, SettlementCard
    ui/         רכיבי shadcn/ui בסיסיים (Button, Card, Dialog, Tabs...)
  hooks/        useLang, useTheme, useEvents, useExpenses
  lib/          settlementEngine, categories, i18n, dateUtils, notificationManager, AuthContext
  pages/        Landing, Login, Signup, Home, CreateEvent, JoinEvent, EventDetail, Settings
supabase/
  01_schema.sql סכמת ה-DB המלאה, כולל RLS ו-Storage buckets
```

## מה כבר עובד

- הרשמה/התחברות (Email+Password, Google OAuth) מול Supabase Auth.
- יצירת אירוע, הצטרפות עם קוד הזמנה, שיתוף קוד (Web Share API).
- הוספת הוצאות עם כמה משלמים, חלוקה שווה/אחוזית, קטגוריות צבעוניות.
- מנוע חישוב יתרות ומזעור העברות (`src/lib/settlementEngine.js`), עם אישור סגירת חוב ואנימציית קונפטי.
- צ׳אט קבוצתי בזמן אמת (Supabase Realtime).
- גלריית תמונות משותפת לאירוע.
- עמוד סטטיסטיקות (פילוח לפי קטגוריה ומשתתף).
- עברית (RTL) / אנגלית (LTR), מצב כהה/בהיר — עם שמירה ב-localStorage.
- PWA: manifest + service worker (cache למעטפת האפליקציה + טיפול בהתראות Push).

## מה עוד חסר / TODO

- אייקוני PWA בפועל (`public/icons/icon-192.png`, `icon-512.png`) — כרגע יש רק favicon SVG.
- צ׳אט פרטי 1:1 בין משתתפים (`chat_messages` כבר מוכן בסכמה, חסר UI).
- מחיקת חשבון בפועל (Edge Function שמסירה מכל האירועים, מעבירה ניהול, שולחת מייל).
- OCR לחילוץ סכום מקבלה.
- ייצוא דוח PDF/Excel.
- Edge Function לשליחת Web Push בפועל בעת הודעה/הוצאה חדשה (הטבלה `push_subscriptions` וה-service worker כבר מוכנים בצד הלקוח).
- בדיקות אמיתיות מול פרויקט Supabase חי (הפיתוח עד כה בוצע מול `.env` עם ערכים פיקטיביים).
# Build Status: CI/CD Active ✅
