import { useEffect, useState } from 'react';
import api from './api';

/**
 * Continuous live feed from the weighing scale (Server-Sent Events from /hardware/weight/stream) for as
 * long as `active` is true — reconnects by itself if the stream drops. `state` is one of:
 *   off        not active (scale disabled, not set up, or a keyboard scale that types by itself)
 *   connecting opening the stream
 *   waiting    port/socket open, no reading yet
 *   live       { weight, unit, stable } — the scale is connected and sending
 *   error      { message } — not connected / port missing / scale silent (stale) / overloaded
 * The weight is only ever shown in the `live` state, never a last-seen value from before a disconnect.
 */
export default function useLiveScale(active, configKey = '') {
  const [feed, setFeed] = useState({ state: 'off' });

  useEffect(() => {
    if (!active) {
      setFeed({ state: 'off' });
      return undefined;
    }
    const controller = new AbortController();
    let timer;
    setFeed({ state: 'connecting' });

    const connect = () => {
      api
        .stream(
          '/hardware/weight/stream',
          (r) => {
            if (controller.signal.aborted) return;
            const raw = { bytes: r.bytes, rawLines: r.rawLines, display: r.display };
            if (r.ok) setFeed({ state: 'live', weight: r.weight, unit: r.unit, stable: r.stable, ...raw });
            else setFeed({ state: r.reason === 'NO_READING_YET' ? 'waiting' : 'error', reason: r.reason, message: r.message, ...raw });
          },
          controller.signal
        )
        .then(() => {
          if (!controller.signal.aborted) timer = setTimeout(connect, 1000);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          setFeed({ state: 'error', message: api.message(err, 'Scale is not responding.') });
          timer = setTimeout(connect, 3000);
        });
    };
    connect();

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [active, configKey]); // a new port/host means a new connection — the open stream still holds the old settings

  return feed;
}

/** One-line label + colour for a feed, shared by the Billing header and Settings. */
export function describeFeed(feed) {
  switch (feed.state) {
    case 'live':
      return {
        connected: true,
        text: `${Number(feed.weight).toFixed(3)} ${feed.unit || 'kg'}`,
        sub: feed.stable ? 'Stable' : 'Settling…',
        tone: feed.stable ? 'ok' : 'warn'
      };
    case 'connecting':
      return { connected: false, text: 'Connecting…', sub: '', tone: 'idle' };
    case 'waiting':
      return { connected: false, text: 'Waiting for scale…', sub: feed.message || 'Connected, no reading yet', tone: 'warn' };
    case 'error':
      return { connected: false, text: 'Scale not connected', sub: feed.message || 'Not responding', tone: 'bad' };
    default:
      return { connected: false, text: 'Scale off', sub: '', tone: 'idle' };
  }
}
