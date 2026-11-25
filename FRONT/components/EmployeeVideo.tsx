"use client";
import { api } from "@/lib/api";
import { createSimli, ignoreClosingSocket, keepSilent, measureLag } from "@/lib/simliMedia";
import type { EmployeeId } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import type { SimliClient } from "simli-client";

/**
 * Live Simli face for the employee. The voice model stays on OpenAI;
 * its audio is forwarded here so the mouth matches what the manager hears.
 * `onLag` reports how far the face runs behind, so the call can hold the voice back to match.
 */
export function EmployeeVideo({ employee, enabled, remoteTrack, onReady, onLag }: {
  employee: EmployeeId;
  enabled: boolean;
  remoteTrack: MediaStreamTrack | null;
  onReady: (ready: boolean) => void;
  onLag: (seconds: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clientRef = useRef<SimliClient | null>(null);
  const piped = useRef(false);
  const [ready, setReady] = useState(false);
  const [faceAudio, setFaceAudio] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;
    // Simli plays the voice back. The call already plays it, and Simli turns its
    // own speaker on again after connecting, which is the second copy.
    const grab = (s: MediaStream) => { if (s.getAudioTracks().length) setFaceAudio(new MediaStream(s.getAudioTracks())); };
    keepSilent(video, true, grab);
    keepSilent(audio, false, grab);
    let stopped = false;
    let client: SimliClient | null = null;

    (async () => {
      try {
        const res = await api("/api/simli/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ setup: { lang: "he", employee, employeeText: "", situation: "performance", situationText: "" } })
        });
        if (!res.ok || stopped) return;
        const data = (await res.json()) as { enabled?: boolean; token?: string; iceServers?: RTCIceServer[] };
        if (!data.enabled || !data.token || stopped) return;
        const ice = Array.isArray(data.iceServers) ? data.iceServers : [];
        client = await createSimli(data.token, video, audio, ice);
        if (stopped) return;
        client.on("start", () => {
          if (stopped) return;
          setReady(true);
          onReady(true);
          void video.play().catch(() => {});
          const stream = video.srcObject;
          const track = stream instanceof MediaStream ? stream.getVideoTracks()[0] : undefined;
          if (track) track.onended = () => { if (!stopped) { setReady(false); onReady(false); } };
        });
        client.on("error", (detail: string) => console.warn("[simli]", detail));
        clientRef.current = client;
        await client.start();
        // The mouth keeps sending audio for a moment after the call ends.
        // Simli throws once the socket is closing; swallow that so it does not cover the screen.
        ignoreClosingSocket(client);
      } catch (e) {
        if (!stopped) console.warn("[simli] unavailable", e);
      }
    })();

    return () => {
      stopped = true;
      piped.current = false;
      setReady(false);
      setFaceAudio(null);
      onReady(false);
      const current = client ?? clientRef.current;
      clientRef.current = null;
      void current?.stop().catch(() => {});
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

  useEffect(() => {
    if (!ready || !remoteTrack || !faceAudio) return;
    return measureLag(remoteTrack, faceAudio, onLag);
  }, [ready, remoteTrack, faceAudio, onLag]);

  return (
    <>
      <video ref={videoRef} className="ex-stage__avatar" autoPlay playsInline muted style={{ opacity: ready ? 1 : 0 }} />
      <audio ref={audioRef} autoPlay playsInline muted style={{ display: "none" }} />
    </>
  );
}
