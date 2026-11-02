import { getToken } from '@/api/server';

const API_URL = import.meta.env.VITE_API_URL;

// Opens an SSE stream and routes named events to handlers. EventSource reconnects on its own.
// Returns a function that closes the stream.
function openStream(path, handlers) {
  const token = getToken();
  if (!token) return () => {};
  const source = new EventSource(`${API_URL}${path}?token=${encodeURIComponent(token)}`);
  for (const [name, handler] of Object.entries(handlers)) {
    source.addEventListener(name, (e) => {
      try {
        handler(JSON.parse(e.data));
      } catch (err) {
        console.error(`realtime handler for ${name} failed`, err);
      }
    });
  }
  return () => source.close();
}

export const subscribeToEvent = (eventId, handlers) => openStream(`/events/${eventId}/stream`, handlers);
export const subscribeToUser = (handlers) => openStream('/stream', handlers);
