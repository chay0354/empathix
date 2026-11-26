"use client";
import { api } from "@/lib/api";
import { followVideo, holdFace, keepSilent, measureLag, startFace, stopFace } from "@/lib/simliMedia";
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
  const [connected, setConnected] = useState(false);
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
      const getToken = async () => {
        const res = await api("/api/simli/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ who: "coach" })
        }).catch(() => null);
        if (!res?.ok) return null;
        const data = (await res.json()) as { enabled?: boolean; token?: string; iceServers?: RTCIceServer[] };
        if (!data.enabled || !data.token) return null;
        return { token: data.token, ice: Array.isArray(data.iceServers) ? data.iceServers : [] };
      };
      const client = await startFace(getToken, video, audio, isStopped);
      if (!client) { if (!isStopped()) onStatus("unavailable"); return; }
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
      setFaceAudio(null);
      clientRef.current = null;
    };
  }, [onStatus]);

  useEffect(() => {
    const client = clientRef.current;
    if (!ready || !connected || !client || !track || piped.current) return;
    try {
      client.listenToMediastreamTrack(track);
      piped.current = true;
    } catch (e) {
      console.warn("[simli] coach audio forward failed", e);
    }
  }, [ready, connected, track]);

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
