"use client";

import { useState } from "react";

import { withDemoQuery } from "../../lib/route-utils";

interface MatchSignalActionProps {
  targetUserId: string;
  demoMode: boolean;
  relationship: "none" | "incoming";
  className?: string;
  sourcePage: "/card" | "/me";
}

type SignalPayload =
  | {
      status: "ok";
      data: {
        state: "pending" | "mutual";
        sessionId?: string;
      };
    }
  | {
      status: "error";
      error: { message: string };
    };

export function MatchSignalAction({
  targetUserId,
  demoMode,
  relationship,
  className = "cta-link button-link",
  sourcePage,
}: MatchSignalActionProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label =
    relationship === "incoming" ? "回选并开始 A2A" : "发起协作意向";

  async function submit() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(withDemoQuery("/api/match/signal", demoMode), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toUserId: targetUserId,
          sourcePage,
        }),
      });

      const payload = (await response.json()) as SignalPayload;
      if (payload.status === "error") {
        setError(payload.error.message);
        setPending(false);
        return;
      }

      if (payload.data.state === "mutual" && payload.data.sessionId) {
        window.location.assign(withDemoQuery(`/arena/${payload.data.sessionId}`, demoMode));
        return;
      }

      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "发起协作意向失败");
      setPending(false);
    }
  }

  return (
    <div className="stack">
      <button type="button" className={className} disabled={pending} onClick={() => void submit()}>
        {pending ? "正在交给 Agent..." : label}
      </button>
      {error ? <p className="danger helper-text">{error}</p> : null}
    </div>
  );
}
