"use client";

import { useRef, useState } from "react";

/**
 * The one minute film. Until it is started it shows a still from the film with
 * a play button over it, so the page never opens on a black rectangle.
 */
export default function Film() {
  const [started, setStarted] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  const start = () => {
    setStarted(true);
    video.current?.play().catch(() => {});
  };

  return (
    <div className="lp-film">
      <video
        ref={video}
        src="/landing/explained.mp4"
        poster="/landing/explained-poster.jpg"
        controls={started}
        playsInline
        preload="none"
        aria-label="A one minute film showing how May or Shall works"
      />
      {!started && (
        <button type="button" className="lp-play" onClick={start} aria-label="Play the one minute film">
          <span className="lp-play-in">
            <span className="lp-play-btn" aria-hidden>
              <svg width="20" height="22" viewBox="0 0 30 34">
                <path d="M4 2.5 L27 17 L4 31.5 Z" fill="#1d1d1f" />
              </svg>
            </span>
            <span className="lp-play-label">
              Watch the film
              <small>How May or Shall works, in one minute</small>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
