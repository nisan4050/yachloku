import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as profileApi from '@/api/profile';

export function useProfile(userId) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileApi.getProfile(userId),
    enabled: Boolean(userId),
  });
}

export function useUpdateNotificationPrefs(userId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs) => profileApi.updateNotificationPrefs(userId, prefs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
  });
}

export function useUpdatePhone(userId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (phone) => profileApi.updatePhone(userId, phone),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
  });
}

export function useProfilesByIds(userIds) {
  return useQuery({
    queryKey: ['profiles', [...(userIds ?? [])].sort()],
    queryFn: () => profileApi.getProfilesByIds(userIds),
    enabled: Boolean(userIds && userIds.length > 0),
  });
}
