"use client";
import { api } from "@/lib/api";
import { followVideo, hearMouth, holdFace, keepSilent, startFace, stopFace } from "@/lib/simliMedia";
import type { EmployeeId } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import type { SimliClient } from "simli-client";

/**
 * Live Simli face for the employee. The voice model stays on OpenAI;
 * its audio is forwarded here so the mouth matches what the manager hears.
 * The call holds that voice by a fixed delay, so a new reading cannot change the pace mid-sentence.
 */
export function EmployeeVideo({ employee, enabled, remoteTrack, onReady, onMouth }: {
  employee: EmployeeId;
  enabled: boolean;
  remoteTrack: MediaStreamTrack | null;
  onReady: (ready: boolean) => void;
  /** null: the face element itself is playing. A stream: play this, the element was blocked. */
  onMouth: (voice: MediaStream | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clientRef = useRef<SimliClient | null>(null);
  const piped = useRef(false);
  const shown = useRef(false);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;
    // Simli plays the voice back. The call already plays it, and Simli turns its
    // own speaker on again after connecting, which is the second copy.
    keepSilent(video, true);
    hearMouth(audio, () => onMouth(null), (voice) => onMouth(voice));
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
      const getToken = async () => {
        const res = await api("/api/simli/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ setup: { lang: "he", employee, employeeText: "", situation: "performance", situationText: "" } })
        }).catch(() => null);
        if (!res?.ok) return null;
        const data = (await res.json()) as { enabled?: boolean; token?: string; iceServers?: RTCIceServer[] };
        if (!data.enabled || !data.token) return null;
        return { token: data.token, ice: Array.isArray(data.iceServers) ? data.iceServers : [] };
      };
      const client = await startFace(getToken, video, audio, isStopped);
      if (!client) return;
      if (isStopped()) return () => stopFace(client);
      clientRef.current = client;
      setConnected(true);
      return () => stopFace(client);
    });

    return () => {
      stopped = true;
      stopWatch();
      release();
      piped.current = false;
      setReady(false);
      setConnected(false);
      clientRef.current = null;
      if (!shown.current) onReady(false);
    };
  }, [employee, enabled, onReady, onMouth]);

  useEffect(() => {
    const client = clientRef.current;
    if (!ready || !connected || !client || !remoteTrack || piped.current) return;
    try {
      client.listenToMediastreamTrack(remoteTrack);
      piped.current = true;
    } catch (e) {
      console.warn("[simli] audio forward failed", e);
    }
  }, [ready, connected, remoteTrack]);

  return (
    <>
      <video ref={videoRef} className="ex-stage__avatar" autoPlay playsInline muted style={{ opacity: ready ? 1 : 0 }} />
      <audio ref={audioRef} autoPlay playsInline style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
    </>
  );
}
