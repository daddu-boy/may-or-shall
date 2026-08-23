"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A first visit bubble for one screen. It appears once, beside the navigation
 * item it explains, and never again for that screen. Deliberately not a tour:
 * a tour interrupts you on arrival and covers everything at once, whereas this
 * says one thing at the moment you first walk into the room.
 *
 * The standing one line description under each navigation item is the part
 * that stays. This is the longer version, shown once.
 */
export default function SectionTip({
  id,
  title,
  body,
  anchor,
}: {
  id: string;
  title: string;
  body: string;
  anchor: string;
}) {
  const key = `mos.tip.${id}`;
  const [pos, setPos] = useState<{ top: number; left: number; nib: boolean } | null>(null);
  const shown = useRef(false);

  useEffect(() => {
    if (localStorage.getItem(key) === "1") return;
    // one frame is not enough: the rail animates its width on load
    const t = setTimeout(() => {
      const el = document.querySelector(anchor) as HTMLElement | null;
      const r = el?.getBoundingClientRect();
      if (r && r.width > 8) {
        setPos({
          top: Math.min(r.top - 6, window.innerHeight - 220),
          left: r.right + 14,
          nib: true,
        });
      } else {
        // the rail is folded away, so the bubble sits under the top bar
        setPos({ top: 68, left: 20, nib: false });
      }
      shown.current = true;
    }, 420);
    return () => {
      clearTimeout(t);
      // seen once it has been on screen, whether or not it was acknowledged
      if (shown.current) localStorage.setItem(key, "1");
    };
  }, [key, anchor]);

  if (!pos) return null;

  const dismiss = () => {
    localStorage.setItem(key, "1");
    setPos(null);
  };

  return (
    <div
      className="night tip-card fixed z-[60] w-[19rem] p-4"
      style={{ top: pos.top, left: pos.left }}
      role="note"
    >
      {pos.nib && <span className="tip-nib" />}
      <p className="text-[13.5px] font-semibold">{title}</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {body}
      </p>
      <div className="mt-3 flex justify-end">
        <button onClick={dismiss} className="btn-primary px-3.5 py-1.5 text-[12px]">
          Got it
        </button>
      </div>
    </div>
  );
}
