export const LANGS = {
  he: { dir: 'rtl', label: 'עברית' },
  en: { dir: 'ltr', label: 'English' },
};

export const DEFAULT_LANG = 'he';

const dict = {
  he: {
    appName: 'יחלוקו',
    tagline: 'לחלק הוצאות בטיול, בלי כאב ראש',
    nav_home: 'הבית',
    nav_stats: 'סטטיסטיקות',
    nav_settings: 'הגדרות',
    action_create_event: 'אירוע חדש',
    action_join_event: 'הצטרפות עם קוד',
    action_add_expense: 'הוצאה חדשה',
    action_save: 'שמירה',
    action_cancel: 'ביטול',
    action_delete: 'מחיקה',
    action_edit: 'עריכה',
    action_share: 'שיתוף',
    action_copy_code: 'העתקת קוד',
    empty_events_title: 'עוד אין לך טיולים',
    empty_events_subtitle: 'צרו אירוע חדש או הצטרפו לאחד עם קוד הזמנה',
    empty_expenses_title: 'עדיין אין הוצאות',
    empty_expenses_subtitle: 'הוסיפו את ההוצאה הראשונה של הטיול',
    balance_settled_up: 'הכל מסודר! 🎉',
    login: 'התחברות',
    signup: 'הרשמה',
    logout: 'התנתקות',
    email: 'אימייל',
    password: 'סיסמה',
    full_name: 'שם מלא',
  },
  en: {
    appName: 'Yachloku',
    tagline: 'Split trip expenses without the headache',
    nav_home: 'Home',
    nav_stats: 'Stats',
    nav_settings: 'Settings',
    action_create_event: 'New Event',
    action_join_event: 'Join with Code',
    action_add_expense: 'Add Expense',
    action_save: 'Save',
    action_cancel: 'Cancel',
    action_delete: 'Delete',
    action_edit: 'Edit',
    action_share: 'Share',
    action_copy_code: 'Copy Code',
    empty_events_title: "You don't have any trips yet",
    empty_events_subtitle: 'Create a new event or join one with an invite code',
    empty_expenses_title: 'No expenses yet',
    empty_expenses_subtitle: "Add the trip's first expense",
    balance_settled_up: "All settled up! 🎉",
    login: 'Log in',
    signup: 'Sign up',
    logout: 'Log out',
    email: 'Email',
    password: 'Password',
    full_name: 'Full name',
  },
};

export function translate(lang, key) {
  return dict[lang]?.[key] ?? dict[DEFAULT_LANG]?.[key] ?? key;
}
