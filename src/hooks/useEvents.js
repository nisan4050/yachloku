import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as eventsApi from '@/api/events';

export function useMyEvents() {
  return useQuery({ queryKey: ['events'], queryFn: eventsApi.listMyEvents });
}

export function useEvent(eventId) {
  return useQuery({
    queryKey: ['events', eventId],
    queryFn: () => eventsApi.getEvent(eventId),
    enabled: Boolean(eventId),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: eventsApi.createEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useJoinEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ inviteCode, member }) => eventsApi.joinEvent(inviteCode, member),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useUpdateEvent(eventId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch) => eventsApi.updateEvent(eventId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: eventsApi.deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      // The event's own notifications cascade-delete server-side, but the
      // deleting user's own bell has them cached — don't wait for the
      // realtime DELETE event to catch up.
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
