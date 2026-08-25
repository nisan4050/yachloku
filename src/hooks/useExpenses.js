import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as expensesApi from '@/api/expenses';
import * as paymentsApi from '@/api/payments';
import { calculateBalances, calculateSettlements } from '@/lib/settlementEngine';

export function useExpenses(eventId) {
  return useQuery({
    queryKey: ['expenses', eventId],
    queryFn: () => expensesApi.listExpenses(eventId),
    enabled: Boolean(eventId),
  });
}

export function usePayments(eventId) {
  return useQuery({
    queryKey: ['payments', eventId],
    queryFn: () => paymentsApi.listPayments(eventId),
    enabled: Boolean(eventId),
  });
}

export function useCreateExpense(eventId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: expensesApi.createExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses', eventId] }),
  });
}

export function useUpdateExpense(eventId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, patch }) => expensesApi.updateExpense(expenseId, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses', eventId] }),
  });
}

export function useDeleteExpense(eventId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: expensesApi.deleteExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses', eventId] }),
  });
}

export function useDeletePayment(eventId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: paymentsApi.deletePayment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments', eventId] }),
  });
}

export function useCreatePayment(eventId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: paymentsApi.createPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', eventId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', eventId] });
    },
  });
}

/** Derives net balances and the minimal settlement plan for an event. Not a hook — safe to call conditionally. */
export function getEventBalances(participants, expenses, payments) {
  if (!participants || !expenses || !payments) {
    return { balances: {}, settlements: [] };
  }
  const balances = calculateBalances(participants, expenses, payments);
  const settlements = calculateSettlements(balances);
  return { balances, settlements };
}
