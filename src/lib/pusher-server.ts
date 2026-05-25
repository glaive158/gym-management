import Pusher from "pusher";

let pusher: Pusher | null = null;

function getPusher(): Pusher | null {
  if (pusher) return pusher;
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) return null;
  pusher = new Pusher({
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
    useTLS: true,
  });
  return pusher;
}

export async function pusherTrigger(channel: string, event: string, data: unknown): Promise<void> {
  const p = getPusher();
  if (!p) {
    console.log(`[pusher noop] ${channel} ${event}`, JSON.stringify(data));
    return;
  }
  await p.trigger(channel, event, data);
}

export function pusherAuthorize(channel: string, socketId: string): { auth: string } | null {
  const p = getPusher();
  if (!p) return null;
  return p.authorizeChannel(socketId, channel);
}
