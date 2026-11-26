"use client";
import { api } from "@/lib/api";
import { createSimli, followVideo, holdFace, ignoreClosingSocket, keepSilent } from "@/lib/simliMedia";
import type { EmployeeId } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import type { SimliClient } from "simli-client";

/**
 * Live Simli face for the employee. The voice model stays on OpenAI;
 * its audio is forwarded here so the mouth matches what the manager hears.
 * The call holds that voice by a fixed delay, so a new reading cannot change the pace mid-sentence.
 */
export function EmployeeVideo({ employee, enabled, remoteTrack, onReady }: {
  employee: EmployeeId;
  enabled: boolean;
  remoteTrack: MediaStreamTrack | null;
  onReady: (ready: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clientRef = useRef<SimliClient | null>(null);
  const piped = useRef(false);
  const shown = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;
    // Simli plays the voice back. The call already plays it, and Simli turns its
    // own speaker on again after connecting, which is the second copy.
    keepSilent(video, true);
    keepSilent(audio, false);
    let stopped = false;
    const stopWatch = followVideo(video, (live) => {
      if (stopped) return;
      if (live) {
        shown.current = true;
        setReady(true);
        onReady(true);
        if (video.paused) void video.play().catch(() => {});
        return;
      }
      // A track swap used to drop the live face and leave the still photo on top.
      if (shown.current) return;
      setReady(false);
      onReady(false);
    });

    const release = holdFace(async (isStopped) => {
      try {
        const res = await api("/api/simli/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ setup: { lang: "he", employee, employeeText: "", situation: "performance", situationText: "" } })
        });
        if (!res.ok || isStopped()) return;
        const data = (await res.json()) as { enabled?: boolean; token?: string; iceServers?: RTCIceServer[] };
        if (!data.enabled || !data.token || isStopped()) return;
        const ice = Array.isArray(data.iceServers) ? data.iceServers : [];
        const client = await createSimli(data.token, video, audio, ice);
        if (isStopped()) return async () => { await client.stop().catch(() => {}); };
        client.on("start", () => {
          if (isStopped()) return;
          void video.play().catch(() => {});
        });
        client.on("error", (detail: string) => console.warn("[simli]", detail));
        clientRef.current = client;
        await client.start();
        // The mouth keeps sending audio for a moment after the call ends.
        // Simli throws once the socket is closing; swallow that so it does not cover the screen.
        ignoreClosingSocket(client);
        return async () => { await client.stop().catch(() => {}); };
      } catch (e) {
        if (!isStopped()) console.warn("[simli] unavailable", e);
      }
    });

    return () => {
      stopped = true;
      stopWatch();
      release();
      piped.current = false;
      setReady(false);
      clientRef.current = null;
      if (!shown.current) onReady(false);
    };
  }, [employee, enabled, onReady]);

  useEffect(() => {
    const client = clientRef.current;
    if (!ready || !client || !remoteTrack || piped.current) return;
    try {
      client.listenToMediastreamTrack(remoteTrack);
      piped.current = true;
    } catch (e) {
      console.warn("[simli] audio forward failed", e);
    }
  }, [ready, remoteTrack]);

  return (
    <>
      <video ref={videoRef} className="ex-stage__avatar" autoPlay playsInline muted style={{ opacity: ready ? 1 : 0 }} />
      <audio ref={audioRef} autoPlay playsInline muted style={{ display: "none" }} />
    </>
  );
}
