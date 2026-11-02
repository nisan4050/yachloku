import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subscribeToUser } from '@/api/realtime';
import * as notificationsApi from '@/api/notifications';

export function useNotifications(userId) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => notificationsApi.listNotifications(userId),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (!userId) return;
    return subscribeToUser({
      notification: () => queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
    });
  }, [userId, queryClient]);

  return query;
}

export function useMarkNotificationRead(userId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
  });
}

export function useMarkAllNotificationsRead(userId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllNotificationsRead(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
  });
}
