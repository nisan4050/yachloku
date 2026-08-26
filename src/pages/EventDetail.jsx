import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Plus } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { useEvent } from '@/hooks/useEvents';
import { useExpenses, usePayments, useCreatePayment, useDeletePayment, useDeleteExpense, getEventBalances } from '@/hooks/useExpenses';
import { useExchangeRates, convertExpensesToBase } from '@/hooks/useExchangeRates';
import { usePendingDeletes } from '@/hooks/usePendingDeletes';
import { confirmSettlement, unconfirmSettlement } from '@/api/payments';
import { notifyEventMembers } from '@/api/notifications';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Fab } from '@/components/ui/fab';
import { ExpenseItem } from '@/components/expenses/ExpenseItem';
import { AddExpenseModal } from '@/components/expenses/AddExpenseModal';
import { ExpenseFilterBar, FILTER_ALL_CATEGORIES } from '@/components/expenses/ExpenseFilterBar';
import { BalanceCard } from '@/components/settlements/BalanceCard';
import { SettlementCard } from '@/components/settlements/SettlementCard';
import { EditEventModal } from '@/components/events/EditEventModal';
import { GroupChat } from '@/components/events/GroupChat';
import { PrivateChatsList } from '@/components/events/PrivateChatsList';
import { PhotosGallery } from '@/components/events/PhotosGallery';
import { TripRecapModal } from '@/components/events/TripRecapModal';

export default function EventDetail() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const { lang, t } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkTab = searchParams.get('tab');
  const deepLinkMsg = searchParams.get('msg');
  const deepLinkPoll = searchParams.get('poll');
  const deepLinkExpense = searchParams.get('expense');
  const deepLinkWith = searchParams.get('with');
  const [fabModalOpen, setFabModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [filters, setFilters] = useState({ text: '', category: FILTER_ALL_CATEGORIES });
  const [activeTab, setActiveTab] = useState(deepLinkTab ?? 'expenses');
  const { pendingIds, scheduleDelete } = usePendingDeletes();

  // Deep link from a notification tap — consume the query params once so
  // re-navigating within the page (switching tabs manually) doesn't keep
  // re-triggering the scroll/highlight.
  useEffect(() => {
    if (!deepLinkTab && !deepLinkMsg && !deepLinkPoll && !deepLinkExpense && !deepLinkWith) return;
    setSearchParams({}, { replace: true });
    if (deepLinkExpense) {
      setTimeout(() => {
        document.getElementById(`expense-${deepLinkExpense}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: event, isLoading: eventLoading } = useEvent(eventId);
  const { data: expenses } = useExpenses(eventId);
  const { data: payments } = usePayments(eventId);
  const createPayment = useCreatePayment(eventId);
  const deletePayment = useDeletePayment(eventId);
  const deleteExpense = useDeleteExpense(eventId);
  const isManager = event?.manager_user_id === user.id;
  const isTripClosed = event?.status && event.status !== 'active';

  const hasMixedCurrencies = (expenses ?? []).some((e) => event && e.currency !== event.currency);
  const { data: rates } = useExchangeRates(event?.currency, hasMixedCurrencies);

  const visibleExpenses = useMemo(
    () => (expenses ?? []).filter((e) => !pendingIds.has(e.id)),
    [expenses, pendingIds]
  );

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

  if (eventLoading || !event) {
    return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  }

  const participantsById = Object.fromEntries(event.participants.map((p) => [p.id, p]));
  const { balances, settlements } = getEventBalances(event.participants, balanceExpenses, payments ?? []);
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
      notifyEventMembers({
        event,
        excludeUserId: user.id,
        type: 'settlement',
        title: lang === 'he' ? `סגירת חוב ב${event.title}` : `Debt settled in ${event.title}`,
        body:
          lang === 'he'
            ? `${participantsById[settlement.from]?.name} סגר/ה חוב של ${amountLabel} מול ${participantsById[settlement.to]?.name}`
            : `${participantsById[settlement.from]?.name} settled ${amountLabel} with ${participantsById[settlement.to]?.name}`,
        data: { tab: 'balances' },
      });
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl">{event.icon}</div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{event.title}</h1>
              <EditEventModal event={event} />
              <Badge>{event.currency}</Badge>
            </div>
            {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>{lang === 'he' ? `סה״כ הוצאות: ${formatMoney(totalExpensesAmount)}` : `Total spent: ${formatMoney(totalExpensesAmount)}`}</span>
              <span>{lang === 'he' ? `ממוצע לאדם: ${formatMoney(avgPerParticipant)}` : `Avg. per person: ${formatMoney(avgPerParticipant)}`}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TripRecapModal event={event} expenses={visibleExpenses} />
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
            {lang === 'he' ? 'הזמנת חברים' : 'Invite friends'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="expenses" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto w-full flex-wrap justify-center sm:w-auto">
          <TabsTrigger value="expenses">{lang === 'he' ? 'הוצאות' : 'Expenses'}</TabsTrigger>
          <TabsTrigger value="balances">{lang === 'he' ? 'מי חייב למי' : 'Who owes'}</TabsTrigger>
          <TabsTrigger value="group-chat">{lang === 'he' ? 'צ׳אט כללי' : 'Group chat'}</TabsTrigger>
          <TabsTrigger value="private-chat">{lang === 'he' ? 'צ׳אט אישי' : 'Private chat'}</TabsTrigger>
          <TabsTrigger value="photos">{lang === 'he' ? 'תמונות' : 'Photos'}</TabsTrigger>
        </TabsList>

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
                  <Button>
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
                  className={expense.id === deepLinkExpense ? 'rounded-2xl ring-2 ring-primary' : ''}
                >
                <ExpenseItem
                  expense={expense}
                  participantsById={participantsById}
                  canManage={expense.created_by === user.id || event.manager_user_id === user.id}
                  onDelete={handleDeleteExpense}
                  onEdit={setEditingExpense}
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
          <GroupChat event={event} scrollToMessageId={deepLinkMsg} scrollToPollId={deepLinkPoll} />
        </TabsContent>

        <TabsContent value="private-chat">
          <PrivateChatsList event={event} openWithParticipantId={deepLinkWith} scrollToMessageId={deepLinkMsg} />
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
    </div>
  );
}
