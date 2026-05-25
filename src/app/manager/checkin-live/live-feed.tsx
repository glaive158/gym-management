"use client";

import { useEffect, useState } from "react";
import { subscribeToGym, type GymCheckInEvent } from "@/lib/pusher-client";
import { CheckinCard } from "@/components/manager/checkin-card";

interface InitialItem {
  id: string;
  status: string;
  source: string;
  createdAt: string;
  member: { name: string; avatar: string | null };
}

export function LiveFeed({ gymId, initial }: { gymId: string; initial: InitialItem[] }) {
  const [items, setItems] = useState<InitialItem[]>(initial);

  useEffect(() => {
    const unsub = subscribeToGym(gymId, (e: GymCheckInEvent) => {
      setItems((prev) =>
        [
          {
            id: e.checkInId,
            status: e.status,
            source: e.source,
            createdAt: e.createdAt,
            member: { name: e.memberName, avatar: e.memberAvatar },
          },
          ...prev,
        ].slice(0, 100)
      );
    });
    return unsub;
  }, [gymId]);

  if (items.length === 0) return <p className="text-slate-500 text-sm">Aucun check-in pour le moment.</p>;
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <CheckinCard
          key={it.id}
          avatar={it.member.avatar}
          name={it.member.name}
          status={it.status}
          time={it.createdAt}
          source={it.source}
        />
      ))}
    </div>
  );
}
