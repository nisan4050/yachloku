// Minimal SSE client for tests: collects events until closed.
export function openStream(api, path, token) {
  const events = [];
  const ac = new AbortController();
  fetch(`${api}${path}?token=${token}`, { signal: ac.signal })
    .then(async (res) => {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const raw = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const match = /event: (.*)\ndata: (.*)/s.exec(raw);
          if (match) events.push({ name: match[1], data: JSON.parse(match[2]) });
        }
      }
    })
    .catch(() => {});
  return { events, close: () => ac.abort() };
}
