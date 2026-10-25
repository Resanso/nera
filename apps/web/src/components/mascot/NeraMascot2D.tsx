"use client";

import { useEffect, useId, useRef, useState } from "react";
import { NERA_COLORS as C, type NeraMascotProps } from "./moods";
import "./nera-2d.css";

/**
 * Flat, Duolingo-style Nera. Pure SVG + CSS keyframes.
 * Each limb is two nested groups: `-pose` eases between mood poses with an
 * overshoot curve, `-loop` runs the mood's looping motion on top of it.
 */
export function NeraMascot2D({ mood = "idle", size = 260, trackPointer = true, onPoke }: NeraMascotProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const lookRef = useRef<SVGGElement>(null);
  const [blink, setBlink] = useState(false);
  const [poke, setPoke] = useState(0);

  // Eye tracking, smoothed in rAF and written straight to the DOM.
  useEffect(() => {
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const el = svgRef.current;
      if (!el || !trackPointer) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height * 0.4);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 300);
      target.x = (dx / d) * 10 * k;
      target.y = (dy / d) * 7 * k;
    };
    const tick = () => {
      const thinking = svgRef.current?.dataset.mood === "thinking";
      const tx = thinking ? 9 : target.x;
      const ty = thinking ? -8 : target.y;
      cur.x += (tx - cur.x) * 0.14;
      cur.y += (ty - cur.y) * 0.14;
      lookRef.current?.setAttribute("transform", `translate(${cur.x.toFixed(2)} ${cur.y.toFixed(2)})`);
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [trackPointer]);

  // Random blinks, sometimes a double blink.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const schedule = () =>
      at(2000 + Math.random() * 2800, () => {
        setBlink(true);
        at(110, () => setBlink(false));
        if (Math.random() < 0.3) {
          at(230, () => setBlink(true));
          at(330, () => setBlink(false));
        }
        schedule();
      });
    schedule();
    return () => timers.forEach(clearTimeout);
  }, []);

  const id = (name: string) => `${name}-${uid}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <svg
      ref={svgRef}
      className={`nera2d${blink ? " is-blink" : ""}`}
      data-mood={mood}
      viewBox="0 0 300 340"
      width={size}
      height={(size * 340) / 300}
      role="img"
      aria-label={`Nera sedang ${mood}`}
      onPointerDown={() => {
        setPoke((p) => p + 1);
        onPoke?.();
      }}
    >
            <defs>
        <pattern id={id("led")} width={6} height={6} patternUnits="userSpaceOnUse">
          <rect x={0.6} y={0.6} width={4.8} height={4.8} rx={1.1} fill={C.led} />
        </pattern>
        <filter id={id("glow")} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={4} />
        </filter>
        <clipPath id={id("head")}>
          <ellipse cx={150} cy={134} rx={114} ry={90} />
        </clipPath>
        <clipPath id={id("body")}>
          <path d="M150 204 C178 204 194 228 196 256 C198 284 180 300 150 300 C120 300 102 284 104 256 C106 228 122 204 150 204 Z" />
        </clipPath>
        <clipPath id={id("visor")}>
          <rect x={68} y={84} width={164} height={110} rx={52} />
        </clipPath>
        <symbol id={id("arm")} viewBox="-20 -14 40 80" overflow="visible">
          <rect x={-12} y={-10} width={24} height={52} rx={12} fill={C.yellowShade} />
          <rect x={-12} y={-10} width={17} height={50} rx={10} fill={C.yellow} />
          <circle cx={0} cy={46} r={16} fill={C.yellowShade} />
          <circle cx={-2} cy={44} r={14} fill={C.yellow} />
          <circle cx={-5} cy={39} r={4} fill={C.yellowLight} />
        </symbol>
      </defs>

      <ellipse className="n-shadow" cx={150} cy={326} rx={72} ry={10} fill="#2F240E" opacity={0.16} />

      <g key={poke} className={poke ? "n-poke" : undefined}>
        <g className="n-root">
          {/* legs */}
          <g className="n-legL">
            <rect x={112} y={278} width={26} height={34} rx={12} fill={C.yellowShade} />
            <ellipse cx={120} cy={314} rx={25} ry={14} fill={C.yellowShade} />
            <ellipse cx={117} cy={311} rx={22} ry={11} fill={C.yellow} />
          </g>
          <g className="n-legR">
            <rect x={162} y={278} width={26} height={34} rx={12} fill={C.yellowShade} />
            <ellipse cx={180} cy={314} rx={25} ry={14} fill={C.yellowShade} />
            <ellipse cx={177} cy={311} rx={22} ry={11} fill={C.yellow} />
          </g>

          {/* body: base shade, lit face offset up-left, highlight */}
          <g clipPath={url("body")}>
            <rect x={90} y={200} width={120} height={110} fill={C.yellowShade} />
            <ellipse cx={142} cy={246} rx={48} ry={52} fill={C.yellow} />
            <ellipse cx={130} cy={230} rx={13} ry={8} fill={C.yellowLight} transform="rotate(-25 126 232)" />
          </g>
          {/* chest light */}
          <circle cx={150} cy={262} r={9} fill={C.visor} />
          <circle cx={150} cy={262} r={5} fill={C.led} className="n-chest" />

          {/* head */}
          <g className="n-head-pose">
            <g className="n-head-loop">
              <g className="n-antenna">
                <rect x={144} y={32} width={12} height={22} rx={6} fill={C.yellowShade} />
                <path
                  d="M150 4 C152.5 16 156 20 168 22 C156 24 152.5 28 150 40 C147.5 28 144 24 132 22 C144 20 147.5 16 150 4 Z"
                  fill={C.yellow}
                />
                <path d="M150 4 C152.5 16 156 20 168 22 C156 24 152.5 28 150 40 Z" fill={C.yellowShade} />
              </g>

              <g clipPath={url("head")}>
                <rect x={30} y={40} width={240} height={190} fill={C.yellowShade} />
                <ellipse cx={142} cy={124} rx={112} ry={86} fill={C.yellow} />
                <ellipse cx={98} cy={70} rx={32} ry={12} fill={C.yellowLight} transform="rotate(-22 98 70)" />
              </g>

              {/* ear pods */}
              <ellipse cx={40} cy={138} rx={20} ry={36} fill={C.yellowShade} />
              <ellipse cx={37} cy={134} rx={13} ry={27} fill={C.yellow} />
              <ellipse cx={260} cy={138} rx={20} ry={36} fill={C.yellowShade} />
              <ellipse cx={257} cy={134} rx={13} ry={27} fill={C.yellow} />

              {/* visor with a bezel and a flat diagonal shine */}
              <rect x={62} y={78} width={176} height={122} rx={58} fill={C.yellowDeep} opacity={0.45} />
              <rect x={68} y={84} width={164} height={110} rx={52} fill={C.visor} />
              <g clipPath={url("visor")}>
                <path d="M68 84 L132 84 L92 194 L68 194 Z" fill={C.visorShine} />
                <path d="M146 84 L160 84 L120 194 L106 194 Z" fill={C.visorShine} opacity={0.6} />
              </g>

              {/* LED face */}
              <g ref={lookRef}>
                <g className="n-face">
                  {/* glow pass then pixel pass of the same shapes */}
                  <g filter={url("glow")} opacity={0.65}>
                    <Face fill={C.led} />
                  </g>
                  <Face fill={url("led")} />
                </g>
              </g>

              {/* pixel cheeks */}
              <g className="n-cheeks" fill={C.cheek}>
                {[0, 1, 2].map((i) => (
                  <rect key={`l${i}`} x={80 + i * 8} y={170} width={6} height={6} rx={1.2} />
                ))}
                {[0, 1, 2].map((i) => (
                  <rect key={`r${i}`} x={204 + i * 8} y={170} width={6} height={6} rx={1.2} />
                ))}
              </g>
            </g>
          </g>

          {/* arms drawn last so raised poses read in front of the head */}
          <g className="n-armL-pose">
            <g className="n-armL-loop">
              <use href={`#${id("arm")}`} x={90} y={214} width={40} height={80} />
            </g>
          </g>
          <g className="n-armR-pose">
            <g className="n-armR-loop">
              <use href={`#${id("arm")}`} x={170} y={214} width={40} height={80} transform="translate(380 0) scale(-1 1)" />
            </g>
          </g>
        </g>
      </g>

      {/* mood props */}
      <g className="n-confetti">
        {CONFETTI.map((b, i) => (
          <path
            key={i}
            d={`M${b.x} ${b.y - 8} L${b.x + 3} ${b.y - 3} L${b.x + 8} ${b.y} L${b.x + 3} ${b.y + 3} L${b.x} ${b.y + 8} L${b.x - 3} ${b.y + 3} L${b.x - 8} ${b.y} L${b.x - 3} ${b.y - 3} Z`}
            fill={b.c}
            style={{ animationDelay: `${b.d}s` }}
          />
        ))}
      </g>
      <g className="n-bubble">
        <rect x={214} y={10} width={74} height={38} rx={19} fill="#fff" />
        <circle cx={222} cy={56} r={6} fill="#fff" />
        <circle cx={214} cy={68} r={3.5} fill="#fff" />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={233 + i * 17} cy={29} r={5} fill="#76520E" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </g>
      <g className="n-alert">
        <circle cx={262} cy={42} r={22} fill="#FF4B4B" />
        <circle cx={262} cy={46} r={22} fill="#EA2B2B" opacity={0} />
        <rect x={258} y={28} width={8} height={19} rx={4} fill="#fff" />
        <circle cx={262} cy={54} r={4.2} fill="#fff" />
      </g>
    </svg>
  );
}

const EYE_L = { cx: 118, cy: 136 };
const EYE_R = { cx: 182, cy: 136 };

function Face({ fill }: { fill: string }) {
  return (
    <>
      {/* open eyes: tall capsules leaning outward */}
      <g className="n-eyes-open">
        <g transform={`rotate(-8 ${EYE_L.cx} ${EYE_L.cy})`}>
          <rect className="n-eye" x={EYE_L.cx - 14} y={EYE_L.cy - 26} width={28} height={52} rx={14} fill={fill} />
        </g>
        <g transform={`rotate(8 ${EYE_R.cx} ${EYE_R.cy})`}>
          <rect className="n-eye" x={EYE_R.cx - 14} y={EYE_R.cy - 26} width={28} height={52} rx={14} fill={fill} />
        </g>
      </g>
      {/* happy eyes: ^ ^ */}
      <g className="n-eyes-happy" stroke={fill} strokeWidth={11} strokeLinecap="round" fill="none">
        <path d={`M${EYE_L.cx - 17} ${EYE_L.cy + 6} Q${EYE_L.cx} ${EYE_L.cy - 22} ${EYE_L.cx + 17} ${EYE_L.cy + 6}`} />
        <path d={`M${EYE_R.cx - 17} ${EYE_R.cy + 6} Q${EYE_R.cx} ${EYE_R.cy - 22} ${EYE_R.cx + 17} ${EYE_R.cy + 6}`} />
      </g>
      {/* worried: round eyes + brows lifted in the middle */}
      <g className="n-eyes-alert" fill={fill}>
        <circle className="n-eye" cx={EYE_L.cx} cy={EYE_L.cy + 4} r={16} />
        <circle className="n-eye" cx={EYE_R.cx} cy={EYE_R.cy + 4} r={16} />
        <rect x={EYE_L.cx - 16} y={EYE_L.cy - 30} width={30} height={7} rx={3.5} transform={`rotate(-14 ${EYE_L.cx} ${EYE_L.cy - 26})`} />
        <rect x={EYE_R.cx - 14} y={EYE_R.cy - 30} width={30} height={7} rx={3.5} transform={`rotate(14 ${EYE_R.cx} ${EYE_R.cy - 26})`} />
      </g>

      <path className="n-mouth-smile" d="M134 166 Q150 180 166 166" stroke={fill} strokeWidth={8} strokeLinecap="round" fill="none" />
      <path className="n-mouth-open" d="M130 162 L170 162 Q170 186 150 186 Q130 186 130 162 Z" fill={fill} />
      <ellipse className="n-mouth-o" cx={156} cy={172} rx={8} ry={9} fill={fill} />
      <path
        className="n-mouth-wavy"
        d="M128 174 q5.5 -8 11 0 t11 0 t11 0 t11 0"
        stroke={fill}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  );
}

const CONFETTI = [
  { x: 34, y: 70, c: "#4FE5FF", d: 0 },
  { x: 268, y: 92, c: "#FFC81E", d: 0.2 },
  { x: 22, y: 176, c: "#FF7A59", d: 0.35 },
  { x: 282, y: 190, c: "#58CC02", d: 0.1 },
  { x: 74, y: 22, c: "#FF7A59", d: 0.45 },
  { x: 232, y: 30, c: "#4FE5FF", d: 0.28 },
];

