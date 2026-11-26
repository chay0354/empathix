"use client";
import { api } from "@/lib/api";
import { createSimli, followVideo, holdFace, ignoreClosingSocket, keepSilent, measureLag } from "@/lib/simliMedia";
import { useEffect, useRef, useState } from "react";
import type { SimliClient } from "simli-client";

/**
 * The coach's face while she speaks the feedback. Her voice stays the original
 * recording; this only borrows it so the mouth matches.
 */
export function CoachVideo({ track, onStatus, onLag }: {
  track: MediaStreamTrack | null;
  onStatus: (status: "ready" | "unavailable") => void;
  onLag: (seconds: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clientRef = useRef<SimliClient | null>(null);
  const piped = useRef(false);
  const [ready, setReady] = useState(false);
  const [faceAudio, setFaceAudio] = useState<MediaStream | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;
    const grab = (s: MediaStream) => { if (s.getAudioTracks().length) setFaceAudio(new MediaStream(s.getAudioTracks())); };
    keepSilent(video, true, grab);
    keepSilent(audio, false, grab);
    let stopped = false;
    const shown = { current: false };
    const stopWatch = followVideo(video, (live) => {
      if (stopped) return;
      if (live) {
        shown.current = true;
        setReady(true);
        onStatus("ready");
        if (video.paused) void video.play().catch(() => {});
        return;
      }
      if (shown.current) return;
      setReady(false);
      onStatus("unavailable");
    });

    const release = holdFace(async (isStopped) => {
      try {
        const res = await api("/api/simli/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ who: "coach" })
        });
        if (isStopped()) return;
        if (!res.ok) { onStatus("unavailable"); return; }
        const data = (await res.json()) as { enabled?: boolean; token?: string; iceServers?: RTCIceServer[] };
        if (!data.enabled || !data.token) { onStatus("unavailable"); return; }
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
        ignoreClosingSocket(client);
        return async () => { await client.stop().catch(() => {}); };
      } catch (e) {
        if (!isStopped()) {
          console.warn("[simli] coach unavailable", e);
          onStatus("unavailable");
        }
      }
    });

    return () => {
      stopped = true;
      stopWatch();
      release();
      piped.current = false;
      setReady(false);
      setFaceAudio(null);
      clientRef.current = null;
    };
  }, [onStatus]);

  useEffect(() => {
    const client = clientRef.current;
    if (!ready || !client || !track || piped.current) return;
    try {
      client.listenToMediastreamTrack(track);
      piped.current = true;
    } catch (e) {
      console.warn("[simli] coach audio forward failed", e);
    }
  }, [ready, track]);

  useEffect(() => {
    if (!ready || !track || !faceAudio) return;
    return measureLag(track, faceAudio, onLag);
  }, [ready, track, faceAudio, onLag]);

  return (
    <>
      <video ref={videoRef} className="ex-coach__video" autoPlay playsInline muted style={{ opacity: ready ? 1 : 0 }} />
      <audio ref={audioRef} autoPlay playsInline muted style={{ display: "none" }} />
    </>
  );
}
