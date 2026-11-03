import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Plus, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { useEvent } from '@/hooks/useEvents';
import { useExpenses, usePayments, useCreatePayment, useDeletePayment, useDeleteExpense, getEventBalances } from '@/hooks/useExpenses';
import { useExchangeRates, convertExpensesToBase } from '@/hooks/useExchangeRates';
import { usePendingDeletes } from '@/hooks/usePendingDeletes';
import { confirmSettlement, unconfirmSettlement } from '@/api/payments';
import { notifyEventMembers } from '@/api/notifications';
import { syncSettlementSystemMessages } from '@/api/systemMessages';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { Fab } from '@/components/ui/fab';
import { ExpenseItem } from '@/components/expenses/ExpenseItem';
import { AddExpenseModal } from '@/components/expenses/AddExpenseModal';
import { ExpenseFilterBar, FILTER_ALL_CATEGORIES } from '@/components/expenses/ExpenseFilterBar';
import { BalanceCard } from '@/components/settlements/BalanceCard';
import { SettlementCard } from '@/components/settlements/SettlementCard';
import { EditEventModal } from '@/components/events/EditEventModal';
import { DeleteEventDialog } from '@/components/events/DeleteEventDialog';
import { GroupChat } from '@/components/events/GroupChat';
import { PrivateChatsList } from '@/components/events/PrivateChatsList';
import { PhotosGallery } from '@/components/events/PhotosGallery';
import { TripRecapModal } from '@/components/events/TripRecapModal';

export default function EventDetail() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const { lang, t, dir } = useLang();
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const [searchParams, setSearchParams] = useSearchParams();
  // Captured ONCE on mount into state — reading straight from searchParams
  // instead would go stale the instant the URL is cleared below, before the
  // async message/expense fetches that need these values have even resolved.
  const [deepLink] = useState(() => ({
    tab: searchParams.get('tab'),
    msg: searchParams.get('msg'),
    poll: searchParams.get('poll'),
    expense: searchParams.get('expense'),
    with: searchParams.get('with'),
  }));
  const [fabModalOpen, setFabModalOpen] = useState(false);
  const [deleteEventOpen, setDeleteEventOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [filters, setFilters] = useState({ text: '', category: FILTER_ALL_CATEGORIES });
  const [activeTab, setActiveTab] = useState(deepLink.tab ?? 'expenses');
  const { pendingIds, scheduleDelete } = usePendingDeletes();

  // Deep link from a notification tap — clear the query params once so
  // re-navigating within the page (switching tabs manually) doesn't keep
  // re-triggering the scroll/highlight. The captured `deepLink` state above
  // is unaffected by this, so children can still wait for their own data.
  useEffect(() => {
    if (!deepLink.tab && !deepLink.msg && !deepLink.poll && !deepLink.expense && !deepLink.with) return;
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: event, isLoading: eventLoading } = useEvent(eventId);
  const { data: expenses } = useExpenses(eventId);
  const { data: payments } = usePayments(eventId);
  const createPayment = useCreatePayment(eventId);
  const deletePayment = useDeletePayment(eventId);
  const deleteExpense = useDeleteExpense(eventId);
  const isManager = event?.manager_user_id === user.id;
  const canDeleteEvent = event && (event.created_by === user.id || event.manager_user_id === user.id);
  const isTripClosed = event?.status && event.status !== 'active';

  const hasMixedCurrencies = (expenses ?? []).some((e) => event && e.currency !== event.currency);
  const { data: rates } = useExchangeRates(event?.currency, hasMixedCurrencies);

  const visibleExpenses = useMemo(
    () => (expenses ?? []).filter((e) => !pendingIds.has(e.id)),
    [expenses, pendingIds]
  );

  // Waits for the target expense to actually be in the loaded list before
  // scrolling — a fixed timeout raced against the async fetch and only
  // "sometimes" worked.
  useEffect(() => {
    if (!deepLink.expense || !visibleExpenses.some((e) => e.id === deepLink.expense)) return;
    const timer = setTimeout(() => {
      document.getElementById(`expense-${deepLink.expense}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => clearTimeout(timer);
  }, [visibleExpenses, deepLink.expense]);

  const balanceExpenses = useMemo(
    () => convertExpensesToBase(visibleExpenses, hasMixedCurrencies ? rates : null),
    [visibleExpenses, rates, hasMixedCurrencies]
  );

  const filteredExpenses = useMemo(() => {
    return visibleExpenses.filter((e) => {
      if (filters.category !== FILTER_ALL_CATEGORIES && e.category !== filters.category) return false;
      if (filters.text && !e.description.toLowerCase().includes(filters.text.toLowerCase())) return false;
      return true;
    });
  }, [visibleExpenses, filters]);

  const participantsById = useMemo(
    () => Object.fromEntries((event?.participants ?? []).map((p) => [p.id, p])),
    [event]
  );
  const { balances, settlements } = useMemo(
    () => (event ? getEventBalances(event.participants, balanceExpenses, payments ?? []) : { balances: [], settlements: [] }),
    [event, balanceExpenses, payments]
  );

  // Keep each pending debt reflected as an auto-updating system message in
  // the relevant private chat, so "you owe X to Y" always matches the live balance.
  useEffect(() => {
    if (!event) return;
    syncSettlementSystemMessages({ event, settlements, participantsById, lang });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, JSON.stringify(settlements)]);

  if (eventLoading || !event) {
    return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  }
  const totalExpensesAmount = balanceExpenses.reduce((sum, e) => sum + e.amount, 0);
  const avgPerParticipant = event.participants.length ? totalExpensesAmount / event.participants.length : 0;
  const formatMoney = (amount) =>
    amount.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: event.currency });
  const confirmedSettlements = (payments ?? []).map((p) => ({
    from: p.from_participant_id,
    to: p.to_participant_id,
    amount: p.amount,
    paymentId: p.id,
  }));

  const handleShare = async () => {
    const shareText =
      lang === 'he'
        ? `הצטרפו לטיול "${event.title}" ביחלוקו עם הקוד: ${event.invite_code}`
        : `Join "${event.title}" on Yachloku with code: ${event.invite_code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text: shareText });
      } catch {
        // user cancelled
      }
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success(lang === 'he' ? 'ההזמנה הועתקה — אפשר להדביק ולשלוח לחברים' : 'Invite copied — paste it to send to friends');
    }
  };

  const handleConfirmSettlement = async (settlement) => {
    try {
      await confirmSettlement(event.id, settlement.from, settlement.to);
      await createPayment.mutateAsync({
        event_id: event.id,
        from_participant_id: settlement.from,
        to_participant_id: settlement.to,
        amount: settlement.amount,
        currency: event.currency,
        created_by: user.id,
      });

      const amountLabel = settlement.amount.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', {
        style: 'currency',
        currency: event.currency,
      });
      const fromParticipant = participantsById[settlement.from];
      const toParticipant = participantsById[settlement.to];

      // Send personalized notifications to each person
      if (fromParticipant?.user_id && toParticipant?.user_id) {
        // Notify the debtor: "You owe X to Y"
        await notifyEventMembers({
          event: { ...event, participants: [fromParticipant] },
          type: 'settlement',
          title: lang === 'he' ? `חוב ל${toParticipant.name}` : `Owe ${toParticipant.name}`,
          body:
            lang === 'he'
              ? `אתה חייב ל${toParticipant.name} ${amountLabel}`
              : `You owe ${toParticipant.name} ${amountLabel}`,
          data: {
            tab: 'private-chat',
            with: settlement.to,
            settlement_amount: settlement.amount,
            settlement_currency: event.currency,
          },
        });

        // Notify the creditor: "Y owes you X"
        await notifyEventMembers({
          event: { ...event, participants: [toParticipant] },
          type: 'settlement',
          title: lang === 'he' ? `${fromParticipant.name} חייב לך` : `${fromParticipant.name} owes you`,
          body:
            lang === 'he'
              ? `${fromParticipant.name} חייב לך ${amountLabel}`
              : `${fromParticipant.name} owes you ${amountLabel}`,
          data: {
            tab: 'private-chat',
            with: settlement.from,
            settlement_amount: settlement.amount,
            settlement_currency: event.currency,
          },
        });
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUnconfirmSettlement = async (settlement) => {
    try {
      await unconfirmSettlement(event.id, settlement.from, settlement.to);
      if (settlement.paymentId) {
        await deletePayment.mutateAsync(settlement.paymentId);
      }
      toast.success(lang === 'he' ? 'הסימון בוטל' : 'Undone');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const canManageSettlement = (fromParticipantId) => participantsById[fromParticipantId]?.user_id === user.id || isManager;

  const handleDeleteExpense = (id) => {
    scheduleDelete(id, () => deleteExpense.mutate(id), {
      label: lang === 'he' ? 'ההוצאה נמחקה' : 'Expense deleted',
      undoLabel: lang === 'he' ? 'ביטול' : 'Undo',
      undoneLabel: lang === 'he' ? 'המחיקה בוטלה' : 'Delete undone',
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Link
            to="/home"
            aria-label={lang === 'he' ? 'חזרה לדף הבית' : 'Back to home'}
            className="-ms-2 shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <BackIcon className="h-5 w-5" />
          </Link>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl">{event.icon}</div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-foreground">{event.title}</h1>
            {event.description && <p className="truncate text-sm text-muted-foreground">{event.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <EditEventModal event={event} />
            {canDeleteEvent && (
              <button
                type="button"
                onClick={() => setDeleteEventOpen(true)}
                aria-label={lang === 'he' ? 'מחיקת הטיול' : 'Delete trip'}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-border rounded-2xl border border-border bg-card py-3 rtl:divide-x-reverse">
          <div className="flex min-w-0 flex-col items-center gap-0.5 px-2">
            <span className="text-xs text-muted-foreground">{lang === 'he' ? 'סה״כ הוצאות' : 'Total spent'}</span>
            <span className="truncate text-base font-semibold text-foreground">{formatMoney(totalExpensesAmount)}</span>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-0.5 px-2">
            <span className="text-xs text-muted-foreground">{lang === 'he' ? 'ממוצע לאדם' : 'Avg. per person'}</span>
            <span className="truncate text-base font-semibold text-foreground">{formatMoney(avgPerParticipant)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <TripRecapModal event={event} expenses={visibleExpenses} triggerClassName="min-w-0 px-3 sm:px-5" />
          <Button variant="outline" onClick={handleShare} className="min-w-0 px-3 sm:px-5">
            <Share2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{lang === 'he' ? 'הזמנת חברים' : 'Invite friends'}</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="expenses" value={activeTab} onValueChange={setActiveTab}>
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <TabsList className="w-max justify-start">
            <TabsTrigger value="expenses" className="px-3 sm:px-4">{lang === 'he' ? 'הוצאות' : 'Expenses'}</TabsTrigger>
            <TabsTrigger value="balances" className="px-3 sm:px-4">{lang === 'he' ? 'מי חייב למי' : 'Who owes'}</TabsTrigger>
            <TabsTrigger value="group-chat" className="px-3 sm:px-4">{lang === 'he' ? 'צ׳אט כללי' : 'Group chat'}</TabsTrigger>
            <TabsTrigger value="private-chat" className="px-3 sm:px-4">{lang === 'he' ? 'צ׳אט אישי' : 'Private chat'}</TabsTrigger>
            <TabsTrigger value="photos" className="px-3 sm:px-4">{lang === 'he' ? 'תמונות' : 'Photos'}</TabsTrigger>
          </TabsList>
        </div>

        <AnimatePresence mode="wait">

        <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
        <TabsContent value="expenses">
          {isTripClosed && (
            <p className="mb-3 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
              {lang === 'he'
                ? 'הטיול סגור לעריכה. רק המנהל/ת יכול/ה לפתוח אותו מחדש (מתוך סיכום הטיול).'
                : 'This trip is closed for editing. Only the manager can reopen it (from the trip recap).'}
            </p>
          )}
          <div className="mb-3 flex items-center justify-between gap-2">
            <ExpenseFilterBar filters={filters} onChange={setFilters} />
            {!isTripClosed && (
              <AddExpenseModal
                event={event}
                userId={user.id}
                trigger={
                  <Button className="hidden sm:inline-flex">
                    <Plus className="h-4 w-4" />
                    {t('action_add_expense')}
                  </Button>
                }
              />
            )}
          </div>
          {!expenses || expenses.length === 0 ? (
            <EmptyState icon="🧾" title={t('empty_expenses_title')} subtitle={t('empty_expenses_subtitle')} />
          ) : filteredExpenses.length === 0 ? (
            <EmptyState icon="🔍" title={lang === 'he' ? 'לא נמצאו הוצאות תואמות' : 'No matching expenses'} />
          ) : (
            <div className="flex flex-col gap-2">
              {filteredExpenses.map((expense) => (
                <div
                  key={expense.id}
                  id={`expense-${expense.id}`}
                  className={expense.id === deepLink.expense ? 'rounded-2xl ring-2 ring-primary' : ''}
                >
                <ExpenseItem
                  expense={expense}
                  participantsById={participantsById}
                  canManage={expense.created_by === user.id || event.manager_user_id === user.id}
                  onDelete={handleDeleteExpense}
                  onEdit={setEditingExpense}
                  baseCurrency={event.currency}
                  rates={rates}
                />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="balances">
          <div className="flex flex-col gap-4">
            {hasMixedCurrencies && (
              <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                {lang === 'he'
                  ? `יש הוצאות במטבעות שונים — הכל מומר ל-${event.currency} לפי שער עדכני לצורך החישוב.`
                  : `Some expenses are in other currencies — everything is converted to ${event.currency} at today's rate for this calculation.`}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {event.participants.map((p) => (
                <BalanceCard key={p.id} participant={p} balance={balances[p.id] ?? 0} currency={event.currency} />
              ))}
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-foreground">{lang === 'he' ? 'תשלומים מומלצים' : 'Suggested transfers'}</h3>
              {settlements.length === 0 && confirmedSettlements.length === 0 ? (
                <EmptyState icon="🎉" title={t('balance_settled_up')} />
              ) : (
                <div className="flex flex-col gap-2">
                  {settlements.map((s, i) => (
                    <SettlementCard
                      key={`pending-${s.from}-${s.to}-${i}`}
                      settlement={s}
                      participantsById={participantsById}
                      currency={event.currency}
                      confirmed={false}
                      canManage={canManageSettlement(s.from)}
                      onConfirm={handleConfirmSettlement}
                    />
                  ))}
                  {confirmedSettlements.map((s) => (
                    <SettlementCard
                      key={`confirmed-${s.paymentId}`}
                      settlement={s}
                      participantsById={participantsById}
                      currency={event.currency}
                      confirmed
                      canManage={canManageSettlement(s.from)}
                      onUnconfirm={handleUnconfirmSettlement}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="group-chat">
          <GroupChat event={event} scrollToMessageId={deepLink.msg} scrollToPollId={deepLink.poll} />
        </TabsContent>

        <TabsContent value="private-chat">
          <PrivateChatsList event={event} openWithParticipantId={deepLink.with} scrollToMessageId={deepLink.msg} />
        </TabsContent>

        <TabsContent value="photos">
          <PhotosGallery event={event} />
        </TabsContent>
        </motion.div>
        </AnimatePresence>
      </Tabs>

      {!isTripClosed && (
        <Fab onClick={() => setFabModalOpen(true)} title={t('action_add_expense')}>
          <Plus className="h-6 w-6" />
        </Fab>
      )}
      <AddExpenseModal event={event} userId={user.id} open={fabModalOpen} onOpenChange={setFabModalOpen} />
      <AddExpenseModal
        event={event}
        userId={user.id}
        expense={editingExpense}
        open={Boolean(editingExpense)}
        onOpenChange={(v) => {
          if (!v) setEditingExpense(null);
        }}
      />
      {canDeleteEvent && <DeleteEventDialog event={event} open={deleteEventOpen} onOpenChange={setDeleteEventOpen} />}
    </div>
  );
}
