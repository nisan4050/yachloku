import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as pollsApi from '@/api/polls';

export function usePolls(eventId) {
  return useQuery({
    queryKey: ['polls', eventId],
    queryFn: () => pollsApi.listPolls(eventId),
    enabled: Boolean(eventId),
  });
}

export function useCreatePoll(eventId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pollsApi.createPoll,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['polls', eventId] }),
  });
}

export function useCastVote(eventId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pollsApi.castVote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['polls', eventId] }),
  });
}

export function useDeletePoll(eventId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pollsApi.deletePoll,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['polls', eventId] }),
  });
}

export function useUpdatePoll(eventId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pollsApi.updatePoll,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['polls', eventId] }),
  });
}
