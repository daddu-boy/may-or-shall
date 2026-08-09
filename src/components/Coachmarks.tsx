"use client";

import { useCallback, useEffect, useState } from "react";

export type Step = {
  /** value of the data-tour attribute on the element to point at */
  anchor: string;
  title: string;
  body: string;
};

/**
 * A once-only guided tour: dims the page, spotlights one element at a time and
 * explains it. Shown to a user once per tour id and never again, and skippable
 * at any point.
 *
 * Steps whose anchor isn't on the page are skipped rather than left pointing at
 * nothing, so the same tour can be mounted on pages that differ slightly.
 */
export default function Coachmarks({ id, steps }: { id: string; steps: Step[] }) {
  const key = `mos.tour.${id}`;
  const [step, setStep] = useState(-1);
  const [box, setBox] = useState<DOMRect | null>(null);

  const find = useCallback(
    (i: number) => document.querySelector<HTMLElement>(`[data-tour="${steps[i]?.anchor}"]`),
    [steps]
  );

  /** first step from `from` whose anchor actually exists */
  const nextAvailable = useCallback(
    (from: number) => {
      for (let i = from; i < steps.length; i++) if (find(i)) return i;
      return -1;
    },
    [steps, find]
  );

  const finish = useCallback(() => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* private mode: the tour simply shows again */
    }
    setStep(-1);
    setBox(null);
  }, [key]);

  // start once, after the page has had a chance to render its content
  useEffect(() => {
    let done = false;
    try {
      done = localStorage.getItem(key) === "1";
    } catch {
      /* ignore */
    }
    if (done) return;
    const t = setTimeout(() => setStep(nextAvailable(0)), 700);
    return () => clearTimeout(t);
  }, [key, nextAvailable]);

  // keep the spotlight on the element as the page moves
  useEffect(() => {
    if (step < 0) return;
    const el = find(step);
    if (!el) {
      setStep(nextAvailable(step + 1));
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => setBox(el.getBoundingClientRect());
    measure();

    // The page is still settling when the tour opens: images load, the
    // extension nudge resolves, data arrives. Re-measure until it stops moving,
    // otherwise the spotlight ends up next to the element instead of on it.
    const timers = [60, 200, 450, 900].map((ms) => setTimeout(measure, ms));
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    ro.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      timers.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, find, nextAvailable]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  if (step < 0 || !box) return null;

  const s = steps[step];
  const pad = 8;
  const below = box.bottom + 190 < window.innerHeight;
  const tipTop = below ? box.bottom + pad + 10 : Math.max(12, box.top - pad - 176);
  const tipLeft = Math.min(Math.max(12, box.left), Math.max(12, window.innerWidth - 340));
  const isLast = nextAvailable(step + 1) === -1;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label={s.title}>
      {/* dim everything except the anchor: one transparent box with a huge shadow */}
      <div
        onClick={finish}
        className="absolute rounded-lg transition-all duration-300 ease-out"
        style={{
          top: box.top - pad,
          left: box.left - pad,
          width: box.width + pad * 2,
          height: box.height + pad * 2,
          boxShadow: "0 0 0 9999px rgba(15,23,42,0.55)",
          outline: "2px solid rgba(99,102,241,0.9)",
          outlineOffset: 2,
        }}
      />
      <div
        className="absolute w-[320px] rounded-xl bg-white p-4 shadow-xl transition-all duration-300 ease-out"
        style={{ top: tipTop, left: tipLeft }}
      >
        <p className="text-sm font-semibold text-slate-900">{s.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{s.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={finish}
            className="text-[11px] text-slate-400 underline hover:text-slate-600"
          >
            Skip
          </button>
          <button
            onClick={() => (isLast ? finish() : setStep(nextAvailable(step + 1)))}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            {isLast ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
