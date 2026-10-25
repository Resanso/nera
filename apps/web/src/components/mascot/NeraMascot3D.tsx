"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { NERA_COLORS as C, type NeraMascotProps, type NeraMood } from "./moods";
import "./nera-3d.css";

/**
 * Real-time 3D Nera built from primitives. Glossy clear-coated plastic,
 * a dark visor, and an LED face drawn to a canvas texture so expressions,
 * blinks and eye tracking stay pixel-crisp.
 */
export function NeraMascot3D({ mood = "idle", size = 260, trackPointer = true, onPoke }: NeraMascotProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const moodRef = useRef<NeraMood>(mood);
  const pokeRef = useRef<() => void>(() => {});
  const onPokeRef = useRef(onPoke);
  const trackRef = useRef(trackPointer);
  const [noGL, setNoGL] = useState(false);
  const [pokeKey, setPokeKey] = useState(0);

  moodRef.current = mood;
  onPokeRef.current = onPoke;
  trackRef.current = trackPointer;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const W = size;
    const H = Math.round(size * 1.15);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) {
      setNoGL(true);
      return;
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setNoGL(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.95;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
    camera.position.set(0, 0.2, 10.2);
    camera.lookAt(0, -0.3, 0);

    const key = new THREE.DirectionalLight(0xfff1d6, 1.6);
    key.position.set(3, 5, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfe9ff, 1.1);
    rim.position.set(-4, 2, -4);
    scene.add(rim);
    scene.add(new THREE.HemisphereLight(0xfff6e0, 0x6b4a10, 0.45));

    // Materials: glossy toy plastic with a soft sheen
    const plastic = (color: string) =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.32,
        metalness: 0,
        clearcoat: 0.85,
        clearcoatRoughness: 0.18,
        envMapIntensity: 0.5,
      });
    const yellow = plastic("#FFC62A");
    const yellowDeep = plastic("#F2A516");
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: "#05080f",
      roughness: 0.06,
      metalness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
    });

    // LED face texture
    const faceCanvas = document.createElement("canvas");
    faceCanvas.width = 640;
    faceCanvas.height = 400;
    const fctx = faceCanvas.getContext("2d")!;
    const faceTex = new THREE.CanvasTexture(faceCanvas);
    faceTex.colorSpace = THREE.SRGBColorSpace;
    faceTex.anisotropy = 4;

    const sphere = new THREE.SphereGeometry(1, 64, 48);
    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => new THREE.Mesh(geo, mat);
    const ball = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = mesh(sphere, mat);
      m.scale.setScalar(r);
      m.position.set(x, y, z);
      return m;
    };
    const capsule = (r: number, len: number, mat: THREE.Material, y: number) => {
      const m = mesh(new THREE.CapsuleGeometry(r, len, 10, 32), mat);
      m.position.y = y;
      return m;
    };
    // Disc with rounded edges, axis along Y (lathe profile)
    const disc = (r: number, h: number, bev: number) => {
      const pts: THREE.Vector2[] = [new THREE.Vector2(0, -h / 2)];
      for (let i = 0; i <= 8; i++) {
        const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2);
        pts.push(new THREE.Vector2(r - bev + Math.cos(a) * bev, -h / 2 + bev + Math.sin(a) * bev));
      }
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * (Math.PI / 2);
        pts.push(new THREE.Vector2(r - bev + Math.cos(a) * bev, h / 2 - bev + Math.sin(a) * bev));
      }
      pts.push(new THREE.Vector2(0, h / 2));
      return new THREE.LatheGeometry(pts, 72);
    };

    // Rig
    const root = new THREE.Group();
    root.position.y = -0.2;
    scene.add(root);

    // torso with a moulded panel seam
    // tapered torso like the reference: narrow chest under the head, fuller belly, tucked hips
    const torsoProfile = [
      [0, 0.62], [0.2, 0.6], [0.36, 0.52], [0.47, 0.36], [0.55, 0.14], [0.58, -0.06],
      [0.56, -0.24], [0.5, -0.4], [0.4, -0.52], [0.26, -0.6], [0, -0.63],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const torsoGeo = new THREE.LatheGeometry(new THREE.SplineCurve(torsoProfile).getPoints(48).reverse(), 72);
    torsoGeo.computeVertexNormals();
    const body = mesh(torsoGeo, yellow);
    body.scale.set(1, 1, 0.88);
    body.position.y = -1.42;
    const seam = mesh(new THREE.TorusGeometry(1, 0.02, 12, 120), yellowDeep);
    seam.rotation.x = Math.PI / 2;
    seam.scale.set(0.585, 0.515, 1);
    seam.position.y = -1.5;
    root.add(body, seam);

    const makeLeg = (x: number) => {
      const g = new THREE.Group();
      g.position.set(x, -1.92, 0);
      const hip = ball(0.16, yellowDeep);
      const thigh = capsule(0.17, 0.08, yellow, -0.13);
      const knee = ball(0.13, yellowDeep, 0, -0.27, 0.02);
      const cuff = mesh(new THREE.TorusGeometry(0.17, 0.05, 14, 48), yellowDeep);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.33;
      const boot = mesh(sphere, yellow);
      boot.scale.set(0.3, 0.22, 0.42);
      boot.position.set(x * 0.12, -0.43, 0.1);
      const sole = mesh(disc(1, 0.12, 0.05), yellowDeep);
      sole.scale.set(0.28, 0.5, 0.39);
      sole.position.set(x * 0.12, -0.56, 0.1);
      g.add(hip, thigh, knee, cuff, boot, sole);
      root.add(g);
      return g;
    };
    const legL = makeLeg(-0.3);
    const legR = makeLeg(0.3);

    const makeArm = (side: -1 | 1) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.6 * side, -1.06, 0.1);
      const shoulder = ball(0.18, yellowDeep);
      const upper = capsule(0.145, 0.16, yellow, -0.2);
      const elbow = ball(0.12, yellowDeep, 0, -0.4, 0);
      const fore = capsule(0.135, 0.14, yellow, -0.56);
      // mitten hand: palm, three stubby fingers, thumb
      const hand = new THREE.Group();
      hand.position.y = -0.8;
      const palm = mesh(sphere, yellow);
      palm.scale.set(0.19, 0.18, 0.13);
      hand.add(palm);
      for (let i = -1; i <= 1; i++) {
        const f = capsule(0.055, 0.09, yellow, 0);
        f.position.set(i * 0.085, -0.17 + Math.abs(i) * 0.02, 0.01);
        f.rotation.z = i * -0.18;
        hand.add(f);
      }
      const thumb = capsule(0.058, 0.08, yellow, 0);
      thumb.position.set(-0.17 * side, -0.02, 0.05);
      thumb.rotation.z = 0.9 * side;
      hand.add(thumb);
      pivot.add(shoulder, upper, elbow, fore, hand);
      root.add(pivot);
      return pivot;
    };
    const armL = makeArm(-1);
    const armR = makeArm(1);

    const neck = new THREE.Group();
    neck.position.y = -0.62;
    root.add(neck);
    const head = new THREE.Group();
    head.position.y = 0.66;
    neck.add(head);

    const skull = mesh(sphere, yellow);
    skull.scale.set(1.36, 1.14, 1.1);
    head.add(skull);

    // raised bezel around the visor, then the glass sits inside it
    const bezel = mesh(sphere, yellow);
    bezel.scale.set(1.26, 0.96, 0.54);
    bezel.position.set(0, -0.05, 0.6);
    const groove = mesh(sphere, yellowDeep);
    groove.scale.set(1.19, 0.9, 0.54);
    groove.position.set(0, -0.05, 0.63);
    const visor = mesh(sphere, visorMat);
    visor.scale.set(1.14, 0.84, 0.52);
    visor.position.set(0, -0.05, 0.67);
    head.add(bezel, groove, visor);

    const PHI = 2.1;
    const THETA = 2.0;
    const faceGeo = new THREE.SphereGeometry(1, 64, 40, Math.PI / 2 - PHI / 2, PHI, Math.PI / 2 - THETA / 2, THETA);
    const face = mesh(
      faceGeo,
      new THREE.MeshBasicMaterial({
        map: faceTex,
        transparent: true,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    face.scale.set(1.145, 0.845, 0.525);
    face.position.copy(visor.position);
    head.add(face);

    // glass streak on the visor
    const glintCanvas = document.createElement("canvas");
    glintCanvas.width = 256;
    glintCanvas.height = 160;
    const gctx = glintCanvas.getContext("2d")!;
    const gg = gctx.createLinearGradient(40, 0, 110, 70);
    gg.addColorStop(0, "rgba(255,255,255,0)");
    gg.addColorStop(0.5, "rgba(255,255,255,0.5)");
    gg.addColorStop(1, "rgba(255,255,255,0)");
    gctx.fillStyle = gg;
    gctx.beginPath();
    gctx.ellipse(86, 40, 70, 16, -0.32, 0, Math.PI * 2);
    gctx.fill();
    const glint = mesh(
      faceGeo,
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(glintCanvas),
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glint.scale.set(1.15, 0.85, 0.53);
    glint.position.copy(visor.position);
    head.add(glint);

    // headphone ear pods: shell, groove ring, cap
    for (const side of [-1, 1]) {
      const shell = mesh(disc(0.44, 0.34, 0.12), yellow);
      shell.rotation.z = Math.PI / 2;
      shell.position.set(1.26 * side, -0.02, 0);
      const ring = mesh(disc(0.33, 0.12, 0.04), yellowDeep);
      ring.rotation.z = Math.PI / 2;
      ring.position.set(1.44 * side, -0.02, 0);
      const cap = mesh(disc(0.27, 0.12, 0.06), yellow);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(1.5 * side, -0.02, 0);
      head.add(shell, ring, cap);
    }

    // antenna: dome base, stalk, rounded four-point sparkle
    const antenna = new THREE.Group();
    antenna.position.y = 1.08;
    head.add(antenna);
    const base = mesh(sphere, yellowDeep);
    base.scale.set(0.16, 0.1, 0.16);
    const stalk = mesh(new THREE.CylinderGeometry(0.065, 0.085, 0.3, 24), yellowDeep);
    stalk.position.y = 0.14;
    const starShape = new THREE.Shape();
    const k = 0.16;
    starShape.moveTo(0, 1);
    starShape.quadraticCurveTo(k, k, 1, 0);
    starShape.quadraticCurveTo(k, -k, 0, -1);
    starShape.quadraticCurveTo(-k, -k, -1, 0);
    starShape.quadraticCurveTo(-k, k, 0, 1);
    const starGeo = new THREE.ExtrudeGeometry(starShape, {
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.22,
      bevelSize: 0.16,
      bevelSegments: 8,
      curveSegments: 24,
    });
    starGeo.center();
    const star = mesh(starGeo, yellow);
    star.scale.setScalar(0.27);
    star.position.y = 0.44;
    star.rotation.z = 0.12;
    antenna.add(base, stalk, star);

    // Soft contact shadow
    const shCanvas = document.createElement("canvas");
    shCanvas.width = shCanvas.height = 128;
    const sctx = shCanvas.getContext("2d")!;
    const grad = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(47,36,14,0.42)");
    grad.addColorStop(1, "rgba(47,36,14,0)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    const shadow = mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shCanvas), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -2.58;
    scene.add(shadow);

    // --- LED face drawing -------------------------------------------------
    const CELL = 13;
    const EYE_L = { x: 238, y: 186 };
    const EYE_R = { x: 402, y: 186 };
    let lastFaceKey = "";

    const roundRect = (cx: number, cy: number, w: number, h: number, angle: number) => {
      const p = new Path2D();
      p.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) / 2);
      const out = new Path2D();
      out.addPath(p, new DOMMatrix().translate(cx, cy).rotate(angle));
      return out;
    };

    const drawFace = (m: NeraMood, lx: number, ly: number, blink: boolean, t: number) => {
      const talk = m === "happy" || m === "celebrate" ? Math.round((Math.sin(t * 13) * 0.5 + 0.5) * 2) : 0;
      const k = `${m}|${Math.round(lx)}|${Math.round(ly)}|${blink}|${talk}`;
      if (k === lastFaceKey) return;
      lastFaceKey = k;

      const fills: Path2D[] = [];
      const strokes: { p: Path2D; w: number }[] = [];
      const L = { x: EYE_L.x + lx, y: EYE_L.y + ly };
      const R = { x: EYE_R.x + lx, y: EYE_R.y + ly };
      const happy = m === "happy" || m === "celebrate" || m === "wave";

      if (happy) {
        for (const e of [L, R]) {
          const p = new Path2D();
          p.moveTo(e.x - 38, e.y + 14);
          p.quadraticCurveTo(e.x, e.y - 46, e.x + 38, e.y + 14);
          strokes.push({ p, w: 24 });
        }
      } else if (m === "alert") {
        for (const [e, s] of [[L, -1], [R, 1]] as const) {
          const p = new Path2D();
          p.ellipse(e.x, e.y + 10, 34, blink ? 4 : 34, 0, 0, Math.PI * 2);
          fills.push(p);
          fills.push(roundRect(e.x + 2 * s, e.y - 58, 66, 14, 14 * s));
        }
      } else {
        const h = blink ? 10 : m === "thinking" ? 96 : 112;
        fills.push(roundRect(L.x, L.y, 58, h, -8), roundRect(R.x, R.y, 58, h, 8));
      }

      const mouth = new Path2D();
      const mx = 320 + lx * 0.6;
      const my = 288 + ly * 0.5;
      if (m === "idle" || m === "wave") {
        mouth.moveTo(mx - 42, my - 8);
        mouth.quadraticCurveTo(mx, my + 32, mx + 42, my - 8);
        strokes.push({ p: mouth, w: 17 });
      } else if (happy) {
        const d = 34 + talk * 10;
        mouth.moveTo(mx - 46, my - 14);
        mouth.lineTo(mx + 46, my - 14);
        mouth.quadraticCurveTo(mx + 46, my - 14 + d, mx, my - 14 + d);
        mouth.quadraticCurveTo(mx - 46, my - 14 + d, mx - 46, my - 14);
        fills.push(mouth);
      } else if (m === "thinking") {
        mouth.ellipse(mx + 14, my, 18, 22, 0, 0, Math.PI * 2);
        fills.push(mouth);
      } else {
        mouth.moveTo(mx - 50, my);
        for (let i = 0; i < 4; i++) mouth.quadraticCurveTo(mx - 50 + i * 25 + 12.5, my + (i % 2 ? 16 : -16), mx - 50 + (i + 1) * 25, my);
        strokes.push({ p: mouth, w: 13 });
      }

      fctx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
      const lit = (x: number, y: number) => {
        for (const p of fills) if (fctx.isPointInPath(p, x, y)) return true;
        for (const s of strokes) {
          fctx.lineWidth = s.w;
          fctx.lineCap = "round";
          if (fctx.isPointInStroke(s.p, x, y)) return true;
        }
        return false;
      };
      const cells: [number, number][] = [];
      for (let y = CELL / 2; y < faceCanvas.height; y += CELL)
        for (let x = CELL / 2; x < faceCanvas.width; x += CELL) if (lit(x, y)) cells.push([x, y]);

      // glow pass, then crisp pixels with a hot core
      fctx.fillStyle = "rgba(79,229,255,0.16)";
      for (const [x, y] of cells) fctx.fillRect(x - 11, y - 11, 22, 22);
      fctx.fillStyle = C.led;
      for (const [x, y] of cells) fctx.fillRect(x - 5, y - 5, 10, 10);
      fctx.fillStyle = "rgba(225,252,255,0.75)";
      for (const [x, y] of cells) fctx.fillRect(x - 2, y - 2, 4, 4);

      // pixel cheeks
      fctx.fillStyle = C.cheek;
      for (let i = 0; i < 3; i++) {
        fctx.fillRect(122 + i * CELL * 1.3, 262, 10, 10);
        fctx.fillRect(498 - i * CELL * 1.3, 262, 10, 10);
      }
      faceTex.needsUpdate = true;
    };

    // --- Interaction ------------------------------------------------------
    const look = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      if (!trackRef.current) return;
      const r = renderer.domElement.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height * 0.38);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 320);
      look.tx = (dx / d) * k;
      look.ty = (dy / d) * k;
    };
    window.addEventListener("pointermove", onMove);

    let pokeAt = -10;
    pokeRef.current = () => {
      pokeAt = clock.getElapsedTime();
      onPokeRef.current?.();
    };

    let nextBlink = 2;
    let blinkUntil = 0;

    // Current values chase per-mood targets; damping gives soft transitions.
    const cur = { y: 0, sx: 1, sy: 1, x: 0, headZ: 0, armL: 0.1, armR: -0.1, armRX: 0, ant: 0, legL: 0, legR: 0, lift: 0 };
    const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
    const hop = (t: number, period: number, height: number, land = 0.14) => {
      const p = (t % period) / period;
      const air = 0.62;
      if (p < air) {
        const q = p / air;
        return { y: Math.sin(q * Math.PI) * height, s: -0.06 * Math.sin(q * Math.PI) };
      }
      const q = (p - air) / (1 - air);
      return { y: 0, s: Math.sin(q * Math.PI) * land };
    };

    const clock = new THREE.Clock();
    let raf = 0;
    let prev = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = clock.getElapsedTime();
      const dt = Math.min(0.05, now - prev);
      prev = now;
      const t = reduced ? 0 : now;
      const m = moodRef.current;

      const T = { y: 0, sx: 1, sy: 1, x: 0, headZ: 0, armL: 0.12, armR: -0.12, armRX: 0, ant: 0, legL: 0, legR: 0, lift: 0 };
      if (m === "idle") {
        T.y = Math.sin(t * 2) * 0.04;
        T.headZ = Math.sin(t * 1.4) * 0.05;
        T.ant = Math.sin(t * 1.4 - 0.6) * 0.18;
        T.armL = 0.12 + Math.sin(t * 2) * 0.05;
        T.armR = -0.12 - Math.sin(t * 2) * 0.05;
      } else if (m === "happy") {
        const h = hop(t, 0.8, 0.42);
        T.y = h.y;
        T.sx = 1 + h.s;
        T.sy = 1 - h.s;
        T.headZ = Math.sin(t * 7.8) * 0.08;
        T.ant = Math.sin(t * 7.8 - 0.8) * 0.4;
        T.armL = -0.7 - Math.sin(t * 15.7) * 0.25;
        T.armR = 0.7 + Math.sin(t * 15.7) * 0.25;
      } else if (m === "wave") {
        T.y = Math.sin(t * 5) * 0.04;
        T.headZ = -0.1;
        T.ant = Math.sin(t * 5 - 0.5) * 0.25;
        T.armR = 2.1 + Math.sin(t * 13) * 0.3;
      } else if (m === "celebrate") {
        const h = hop(t, 1.1, 0.95, 0.2);
        T.y = h.y;
        T.sx = 1 + h.s;
        T.sy = 1 - h.s;
        T.ant = Math.sin(t * 11) * 0.45;
        T.armL = -2.15 - Math.sin(t * 22) * 0.2;
        T.armR = 2.15 + Math.sin(t * 22) * 0.2;
        T.legL = h.y > 0.1 ? 0.3 : 0;
        T.legR = h.y > 0.1 ? -0.3 : 0;
      } else if (m === "thinking") {
        T.y = Math.sin(t * 2.4) * 0.03;
        T.headZ = 0.16;
        T.ant = 0.25 + Math.sin(t * 4.8) * 0.1;
        T.armR = -2.15;
        T.armRX = -0.9 + Math.max(0, Math.sin(t * 9)) * 0.08;
      } else {
        const p = t % 2;
        const env = p < 0.5 ? Math.exp(-p * 6) : 0;
        T.x = Math.sin(t * 46) * 0.12 * env;
        T.ant = Math.sin(t * 30) * 0.6 * env;
        T.armL = -0.85;
        T.armR = 0.85;
        T.lift = 0.06;
      }

      const r = 10;
      for (const k of Object.keys(cur) as (keyof typeof cur)[]) cur[k] = damp(cur[k], T[k], k === "y" || k === "sx" || k === "sy" ? 30 : r, dt);

      // poke: damped spring squash
      const pt = now - pokeAt;
      const pk = pt < 1.2 ? Math.exp(-pt * 6) * Math.cos(pt * 24) * 0.16 : 0;

      root.position.set(cur.x, -0.2 + cur.y, 0);
      root.scale.set(cur.sx + pk, cur.sy - pk, cur.sx + pk);
      neck.rotation.z = cur.headZ;
      neck.position.y = -0.62 + cur.lift;
      antenna.rotation.z = cur.ant;
      armL.rotation.z = cur.armL;
      armR.rotation.set(cur.armRX, 0, cur.armR);
      legL.rotation.z = cur.legL;
      legR.rotation.z = cur.legR;

      // Head follows pointer (thinking looks up and away instead)
      const tx = m === "thinking" ? 0.5 : look.tx;
      const ty = m === "thinking" ? -0.6 : look.ty;
      look.x = damp(look.x, tx, 8, dt);
      look.y = damp(look.y, ty, 8, dt);
      head.rotation.y = look.x * 0.42;
      head.rotation.x = look.y * 0.22;

      if (!reduced && now > nextBlink) {
        blinkUntil = now + 0.11;
        nextBlink = now + 2 + Math.random() * 2.8;
        if (Math.random() < 0.3) nextBlink = now + 0.25;
      }
      drawFace(m, look.x * 22, look.y * 14, now < blinkUntil, t);

      shadow.scale.setScalar(1 - Math.min(0.45, cur.y * 0.5));
      (shadow.material as THREE.MeshBasicMaterial).opacity = 1 - Math.min(0.6, cur.y * 0.7);

      renderer.render(scene, camera);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((mm: THREE.Material & { map?: THREE.Texture | null }) => {
            mm.map?.dispose();
            mm.dispose();
          });
        }
      });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [size]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={`Nera 3D sedang ${mood}`}
      onPointerDown={() => {
        if (noGL) {
          setPokeKey((k) => k + 1);
          onPoke?.();
        } else pokeRef.current();
      }}
      className="relative cursor-pointer select-none"
      style={{ width: size, height: Math.round(size * 1.15), touchAction: "manipulation" }}
    >
      {noGL && <ImageFallback mood={mood} pokeKey={pokeKey} />}
      <Overlay mood={mood} />
    </div>
  );
}

/** No WebGL: the rendered 3D mascot, moved with CSS. */
function ImageFallback({ mood, pokeKey }: { mood: NeraMood; pokeKey: number }) {
  return (
    <div key={pokeKey} className={`n3-fallback${pokeKey ? " poke" : ""}`} data-mood={mood}>
      <Image src="/images/nera-home-mascot.png" alt="" width={1688} height={2428} sizes="240px" priority />
    </div>
  );
}

/** DOM props that sit above the canvas: thinking bubble, alert badge, sparkles. */
function Overlay({ mood }: { mood: NeraMood }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
            <div className={`n3-bubble${mood === "thinking" ? " on" : ""}`}>
        <i />
        <i />
        <i />
      </div>
      <div className={`n3-alert${mood === "alert" ? " on" : ""}`}>!</div>
      <div className={`n3-sparkles${mood === "celebrate" ? " on" : ""}`}>
        {["#4FE5FF", "#FFC81E", "#FF7A59", "#58CC02", "#FF7A59", "#4FE5FF"].map((c, i) => (
          <b key={i} style={{ background: c, animationDelay: `${i * 0.17}s` }} />
        ))}
      </div>
    </div>
  );
}
