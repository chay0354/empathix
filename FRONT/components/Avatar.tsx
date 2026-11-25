"use client";
import { useState } from "react";

/**
 * Talking avatar placeholder: a calm portrait disc that pulses with the voice level.
 * Drop a licensed portrait at /public/avatars/<id>.jpg to replace the monogram,
 * or swap this component for a video-avatar provider later.
 */
export function Face({ id, name, level = 0, size, fallback }: { id: string; name: string; level?: number; size?: string; fallback?: string }) {
  const [img, setImg] = useState(true);
  return (
    <div className="ex-face" style={{ ["--lvl" as string]: level.toFixed(2), width: size }} role="img" aria-label={name}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/avatars/${id}.jpg`} alt="" onError={() => setImg(false)} />
      ) : fallback ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fallback} alt="" style={{ width: 48, height: "auto", objectFit: "contain" }} />
      ) : (
        <span className="ex-face__mono" aria-hidden>{name.slice(0, 1)}</span>
      )}
    </div>
  );
}

export function TileFace({ id, name }: { id: string; name: string }) {
  const [img, setImg] = useState(true);
  return img ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/avatars/${id}.jpg`} alt="" onError={() => setImg(false)} />
  ) : (
    <span className="ex-avatar-mono" aria-hidden>{name.slice(0, 1)}</span>
  );
}
