"use client";

import { useEffect, useState } from "react";

/**
 * The explanation for one screen: what to actually do here. It appears beside
 * the navigation item it belongs to, and the person dismisses it.
 *
 * Deliberately dumb. Whether it should be on screen at all belongs to the
 * shell, which knows what this account has already dismissed and whether the
 * information button was just pressed. This only draws it and reports the
 * dismissal.
 */
export default function SectionTip({
  title,
  body,
  anchor,
  onDismiss,
}: {
  title: string;
  body: string;
  anchor: string;
  onDismiss: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; nib: boolean } | null>(null);

  useEffect(() => {
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
    }, 380);
    return () => clearTimeout(t);
  }, [anchor]);

  if (!pos) return null;

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
        <button onClick={onDismiss} className="btn-primary px-3.5 py-1.5 text-[12px]">
          Got it
        </button>
      </div>
    </div>
  );
}
