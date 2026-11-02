// In-memory Server-Sent Events hub. Single replica only; move to Redis pub/sub before scaling out.
const eventClients = new Map(); // eventId -> Set<{ res, userId }>
const userClients = new Map(); // userId -> Set<res>

const frame = (name, payload) => `event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`;

function openStream(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
  return () => clearInterval(heartbeat);
}

export function subscribeToEvent(eventId, userId, res) {
  const stopHeartbeat = openStream(res);
  const client = { res, userId: String(userId) };
  if (!eventClients.has(eventId)) eventClients.set(eventId, new Set());
  eventClients.get(eventId).add(client);
  res.on('close', () => {
    stopHeartbeat();
    eventClients.get(eventId)?.delete(client);
    if (eventClients.get(eventId)?.size === 0) eventClients.delete(eventId);
  });
}

export function subscribeUser(userId, res) {
  const stopHeartbeat = openStream(res);
  const key = String(userId);
  if (!userClients.has(key)) userClients.set(key, new Set());
  userClients.get(key).add(res);
  res.on('close', () => {
    stopHeartbeat();
    userClients.get(key)?.delete(res);
    if (userClients.get(key)?.size === 0) userClients.delete(key);
  });
}

// userIds: optional allow-list (strings); omit to reach every subscriber of the event.
export function emitToEvent(eventId, name, payload, userIds) {
  const allow = userIds ? new Set(userIds.filter(Boolean).map(String)) : null;
  for (const client of eventClients.get(eventId) ?? []) {
    if (!allow || allow.has(client.userId)) client.res.write(frame(name, payload));
  }
}

export function emitToUser(userId, name, payload) {
  for (const res of userClients.get(String(userId)) ?? []) res.write(frame(name, payload));
}
