// Safely get participant info, with fallback for deleted participants
export function getParticipantName(participantId, participantsById, fallback = 'משתתף שהוסר') {
  return participantsById[participantId]?.name ?? fallback;
}

// Check if participant still exists in event
export function participantExists(participantId, participants) {
  return participants.some((p) => p.id === participantId);
}

// Filter valid participants from array
export function filterValidParticipants(participantIds, participants) {
  return participantIds.filter((id) => participantExists(id, participants));
}
