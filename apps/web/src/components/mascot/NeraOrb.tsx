"use client";

import { useEffect, useId, useRef, useState } from "react";
import { NERA_COLORS as C, type NeraMascotProps } from "./moods";
import "./nera-orb.css";

type Props = NeraMascotProps & {
  /** led: cyan pixel eyes like the brand mascot. white: plain white pills like the sketch. */
  eyes?: "led" | "white";
};

// Gaze travel. The visor slides across the head like a face turning, and the eyes
// slide a bit further inside it. Ears and antenna counter-shift for a hint of depth.
const VISOR_X = 12;
const VISOR_Y = 8;
const EYE_X = 13;
const EYE_Y = 7;

/**
 * Minimal Nera: just the head. A yellow orb with a glass visor, ear pods and the
 * star antenna. Emotion comes from where the eyes sit, their shape, and how the orb squashes.
 */
export function NeraOrb({ mood = "idle", size = 200, trackPointer = true, onPoke, eyes = "led" }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const visorRef = useRef<SVGGElement>(null);
  const earsRef = useRef<SVGGElement>(null);
  const antennaRef = useRef<SVGGElement>(null);
  const [blink, setBlink] = useState(false);
  const [poke, setPoke] = useState(0);
  const eyeFill = eyes === "led" ? `url(#led-${uid})` : "#FFFFFF";

  // Gaze: pointer when it moves, otherwise idle glances around. The head leans a little toward the gaze.
  useEffect(() => {
    const target = { x: 0.35, y: -0.3 };
    const cur = { x: 0.35, y: -0.3 };
    let lastPointer = 0;
    let nextGlance = 0;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const el = svgRef.current;
      if (!el || !trackPointer) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height * 0.55);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 240);
      target.x = (dx / d) * k;
      target.y = (dy / d) * k;
      lastPointer = performance.now();
    };
    const tick = (now: number) => {
      const m = svgRef.current?.dataset.mood;
      let tx = target.x;
      let ty = target.y;
      if (m === "thinking") {
        tx = 0.6;
        ty = -0.8;
      } else if (m === "alert") {
        tx = 0;
        ty = -0.1;
      } else if (m === "happy" || m === "celebrate" || m === "wave") {
        tx = target.x * 0.3;
        ty = -0.2;
      } else if (now - lastPointer > 2500 && now > nextGlance) {
        // idle glance: snap to a new spot, hold
        target.x = (Math.random() * 2 - 1) * 0.85;
        target.y = (Math.random() * 2 - 1) * 0.7 - 0.1;
        nextGlance = now + 1400 + Math.random() * 2200;
      }
      // eyes are quick (saccade-like), the head is slow (follow-through)
      cur.x += (tx - cur.x) * 0.22;
      cur.y += (ty - cur.y) * 0.22;
      const f = (n: number) => n.toFixed(2);
      // turning away foreshortens the visor a little
      const squeeze = 1 - Math.abs(cur.x) * 0.08;
      visorRef.current?.setAttribute(
        "transform",
        `translate(${f(cur.x * VISOR_X)} ${f(cur.y * VISOR_Y)}) translate(100 120) scale(${f(squeeze)} 1) translate(-100 -120)`,
      );
      eyesRef.current?.setAttribute("transform", `translate(${f(cur.x * EYE_X)} ${f(cur.y * EYE_Y)})`);
      earsRef.current?.setAttribute("transform", `translate(${f(-cur.x * 4)} ${f(-cur.y * 2)})`);
      antennaRef.current?.setAttribute("transform", `translate(${f(cur.x * 5)} ${f(Math.min(0, cur.y) * 2)})`);
      bodyRef.current?.setAttribute("transform", `rotate(${(cur.x * 6).toFixed(2)} 100 180)`);
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [trackPointer]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const schedule = () =>
      at(1800 + Math.random() * 2600, () => {
        setBlink(true);
        at(100, () => setBlink(false));
        if (Math.random() < 0.3) {
          at(210, () => setBlink(true));
          at(310, () => setBlink(false));
        }
        schedule();
      });
    schedule();
    return () => timers.forEach(clearTimeout);
  }, []);

  const id = (n: string) => `${n}-${uid}`;

  return (
    <svg
      ref={svgRef}
      className={`nera-orb${blink ? " is-blink" : ""}`}
      data-mood={mood}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={`Nera sedang ${mood}`}
      onPointerDown={() => {
        setPoke((p) => p + 1);
        onPoke?.();
      }}
    >
      <defs>
        <pattern id={id("led")} width={4} height={4} patternUnits="userSpaceOnUse">
          <rect x={0.4} y={0.4} width={3.2} height={3.2} rx={0.8} fill={C.led} />
        </pattern>
        <filter id={id("glow")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={2.6} />
        </filter>
        <clipPath id={id("visor")}>
          <ellipse cx={100} cy={120} rx={50} ry={37} />
        </clipPath>
      </defs>

      <ellipse className="o-shadow" cx={100} cy={188} rx={44} ry={5} fill="#2F240E" opacity={0.08} />

      <g key={poke} className={poke ? "o-poke" : undefined}>
        <g className="o-root">
          <g ref={bodyRef}>
            <g className="o-body">
              {/* star antenna, lags behind the head */}
              <g ref={antennaRef}>
                <g className="o-antenna">
                  <rect x={97} y={34} width={6} height={18} rx={3} fill={C.yellow} />
                  <path d="M100 8 C101.8 17 104 19 113 21 C104 23 101.8 25 100 34 C98.2 25 96 23 87 21 C96 19 98.2 17 100 8 Z" fill={C.yellow} />
                </g>
              </g>

              {/* ear pods */}
              <g ref={earsRef}>
                <ellipse cx={35} cy={116} rx={12} ry={22} fill={C.yellowShade} />
                <ellipse cx={165} cy={116} rx={12} ry={22} fill={C.yellowShade} />
              </g>

              <circle cx={100} cy={114} r={66} fill={C.yellow} />

              {/* visor follows the gaze; the clip moves with it */}
              <g ref={visorRef}>
                <ellipse cx={100} cy={120} rx={50} ry={37} fill={C.visor} />
                <g clipPath={`url(#${id("visor")})`}>

                  {/* eyes slide around behind the glass */}
                  <g ref={eyesRef}>
                    {eyes === "led" && (
                      <g filter={`url(#${id("glow")})`} opacity={0.3}>
                        <Eyes fill={C.led} />
                      </g>
                    )}
                    <Eyes fill={eyeFill} />
                  </g>

                  {/* pixel cheeks */}
                  <g fill={C.cheek}>
                    {[0, 1, 2].map((i) => (
                      <rect key={`l${i}`} x={60 + i * 5} y={136} width={3.6} height={3.6} rx={0.8} />
                    ))}
                    {[0, 1, 2].map((i) => (
                      <rect key={`r${i}`} x={130 + i * 5} y={136} width={3.6} height={3.6} rx={0.8} />
                    ))}
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>

      {/* props */}
      <g className="o-sparks">
        {SPARKS.map((s, i) => (
          <path
            key={i}
            d={`M${s.x} ${s.y - 7} L${s.x + 2.5} ${s.y - 2.5} L${s.x + 7} ${s.y} L${s.x + 2.5} ${s.y + 2.5} L${s.x} ${s.y + 7} L${s.x - 2.5} ${s.y + 2.5} L${s.x - 7} ${s.y} L${s.x - 2.5} ${s.y - 2.5} Z`}
            fill={s.c}
            style={{ animationDelay: `${s.d}s` }}
          />
        ))}
      </g>
      <g className="o-bubble">
        <rect x={140} y={22} width={54} height={28} rx={14} fill="#fff" />
        <circle cx={146} cy={56} r={4} fill="#fff" />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={155 + i * 12} cy={36} r={3.6} fill="#76520E" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </g>
      <g className="o-alert">
        <circle cx={170} cy={50} r={16} fill="#FF4B4B" />
        <rect x={167} y={40} width={6} height={14} rx={3} fill="#fff" />
        <circle cx={170} cy={59} r={3.2} fill="#fff" />
      </g>
    </svg>
  );
}

function Eyes({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      {/* default: pills leaning slightly, like the sketch */}
      <g className="o-eyes-open">
        <g transform="rotate(-12 89 118)">
          <rect className="o-eye" x={83} y={106} width={12} height={24} rx={6} />
        </g>
        <g transform="rotate(-12 111 118)">
          <rect className="o-eye" x={105} y={106} width={12} height={24} rx={6} />
        </g>
      </g>
      {/* happy: upturned arcs */}
      <g className="o-eyes-happy" stroke={fill} strokeWidth={7} strokeLinecap="round" fill="none">
        <path d="M73 124 Q83 110 93 124" />
        <path d="M107 124 Q117 110 127 124" />
      </g>
      {/* alert: wide round eyes */}
      <g className="o-eyes-alert">
        <circle cx={87} cy={119} r={10} />
        <circle cx={113} cy={119} r={10} />
      </g>
    </g>
  );
}

const SPARKS = [
  { x: 22, y: 64, d: 0, c: "#4FE5FF" },
  { x: 180, y: 78, d: 0.2, c: "#FFC81E" },
  { x: 14, y: 146, d: 0.35, c: "#FF7A59" },
  { x: 188, y: 150, d: 0.1, c: "#58CC02" },
  { x: 54, y: 18, d: 0.45, c: "#FF7A59" },
  { x: 150, y: 16, d: 0.28, c: "#4FE5FF" },
];
