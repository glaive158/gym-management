"use client";
import PusherClient from "pusher-js";

let client: PusherClient | null = null;

function getClient(): PusherClient | null {
  if (client) return client;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return null;
  client = new PusherClient(key, { cluster, authEndpoint: "/api/pusher/auth" });
  return client;
}

export interface GymCheckInEvent {
  checkInId: string;
  memberId: string;
  memberName: string;
  memberAvatar: string | null;
  status: "VALID" | "EXPIRED" | "DUPLICATE" | "NO_SUBSCRIPTION";
  createdAt: string;
  expiresAt: string | null;
  source: "QR" | "MANUAL";
}

export function subscribeToGym(gymId: string, onEvent: (e: GymCheckInEvent) => void): () => void {
  const c = getClient();
  if (!c) return () => {};
  const channel = c.subscribe(`private-gym-${gymId}`);
  channel.bind("checkin", onEvent);
  return () => {
    channel.unbind("checkin", onEvent);
    c.unsubscribe(`private-gym-${gymId}`);
  };
}
