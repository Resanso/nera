// Nera icon geometry on a 24 px grid. Mirrors the "NERA · Icon Set" board in pen.dev.
// line: stroked outline, accent: duo fill behind the outline, dot: solid details.

export interface IconGeometry {
  line: string;
  accent?: string;
  dot?: string;
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

const rounded = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

const burst = (cx: number, cy: number, outer: number, inner: number, points: number) => {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}z`;
};

const RING = circle(12, 12, 9);
const SHIELD = "M12 3 4.5 5.8v5.7c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V5.8z";
const BELL = "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z";
const EYE = "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z";
const CALENDAR = rounded(3.5, 5, 17, 16, 3);
const FILE = "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z";
const BADGE = burst(12, 12, 9.5, 7.6, 8);
const STAR = burst(12, 12.6, 9.5, 4.4, 5);
const SPARK = "M10 3.5c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6z";
const BUBBLE = "M12 3.5a8.5 8.5 0 0 1 0 17 8.6 8.6 0 0 1-3.9-.9L3.5 20.5l.9-4.4A8.5 8.5 0 0 1 12 3.5z";
const PIN = "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z";
const PENCIL = "M15.5 4.5a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3L9 19l-4.5 1 1-4.5z";
const TRIANGLE = "M10.3 4.5a2 2 0 0 1 3.4 0l7.4 12.8a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3z";
const OCTAGON = "M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z";
const CLOUD = "M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9a4.8 4.8 0 0 1-.5 9.5";
const RECEIPT = "M5.5 3.5h13v17l-2.2-1.5-2.1 1.5-2.2-1.5-2.2 1.5-2.1-1.5-2.2 1.5z";
const PLANE =
  "M12 2.5c1 0 1.8 1 1.8 2.5v4.5l7.2 4.2v2l-7.2-2.2V18l2.4 1.8v1.7L12 20.5l-4.2 1v-1.7l2.4-1.8v-4.5L3 15.7v-2l7.2-4.2V5c0-1.5.8-2.5 1.8-2.5z";
const ZAP = "M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z";
const SEND = "M21 3l-6.5 18-4-7.5L3 9.5z";

export const ICON_PATHS = {
  // Navigasi
  home: {
    line: "M3.5 11 12 3.8l8.5 7.2 M5.5 9.5v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9 M10 20.5V16a2 2 0 0 1 4 0v4.5",
    accent: "M5.5 9.8 12 4.3l6.5 5.5v8.7a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z",
  },
  wallet: {
    line: `${rounded(3.5, 5.5, 17, 15, 3)} M15.5 11h5v4h-5a2 2 0 0 1 0-4z M6 5.5l9-2.5a1.5 1.5 0 0 1 1.9 1.4v1.1`,
    accent: rounded(3.5, 5.5, 17, 15, 3),
    dot: circle(16, 13, 1),
  },
  "wallet-cards": {
    line: `${rounded(3.5, 8, 17, 12.5, 3)} M3.5 12.5H8l1.5 2h5l1.5-2h4.5 M6 8V6.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V8`,
    accent: rounded(3.5, 8, 17, 12.5, 3),
  },
  users: {
    line: `${circle(9, 8, 3.5)} M2.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5 M16 4.8a3.3 3.3 0 0 1 0 6.4 M18 14.3c2.1.6 3.5 2.4 3.5 5.2`,
    accent: `${circle(9, 8, 3.5)} M2.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5z`,
  },
  "trending-up": {
    line: "M3.5 16.5 9 11l4 4 7.5-7.5 M15 7.5h5.5V13",
    accent: "M3.5 16.5 9 11l4 4 7.5-7.5V19a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z",
  },
  "trending-down": {
    line: "M3.5 7.5 9 13l4-4 7.5 7.5 M15 16.5h5.5V11",
    accent: "M3.5 7.5 9 13l4-4 7.5 7.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z",
  },
  "layout-grid": {
    line:
      rounded(3.5, 3.5, 7, 7, 2) + rounded(13.5, 3.5, 7, 7, 2) + rounded(3.5, 13.5, 7, 7, 2) + rounded(13.5, 13.5, 7, 7, 2),
    accent: rounded(13.5, 3.5, 7, 7, 2),
  },
  "layout-dashboard": {
    line:
      rounded(3.5, 3.5, 7, 9, 2) + rounded(13.5, 3.5, 7, 5, 2) + rounded(13.5, 11.5, 7, 9, 2) + rounded(3.5, 15.5, 7, 5, 2),
    accent: rounded(3.5, 3.5, 7, 9, 2),
  },
  sparkles: {
    line: SPARK,
    accent: SPARK,
    dot: "M18 14c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3z",
  },
  plus: { line: "M12 5v14 M5 12h14" },
  "plus-circle": { line: `${RING} M12 8v8 M8 12h8`, accent: RING },

  // Keuangan
  receipt: { line: `${RECEIPT} M9 8.5h6 M9 12h6 M9 15.5h3.5`, accent: RECEIPT },
  calendar: {
    line: `${CALENDAR} M3.5 10h17 M8 3v4 M16 3v4`,
    accent: "M3.5 8a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v2h-17z",
    dot: circle(8, 14, 1) + circle(12, 14, 1) + circle(16, 14, 1) + circle(8, 17.5, 1) + circle(12, 17.5, 1),
  },
  "calendar-clock": {
    line: `M20.5 10V8a3 3 0 0 0-3-3h-11a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3H10 M3.5 10h17 M8 3v4 M16 3v4 ${circle(17, 17, 4.5)} M17 15v2l1.3 1.3`,
    accent: circle(17, 17, 4.5),
  },
  clock: { line: `${RING} M12 7.5V12l3 2`, accent: RING },
  history: { line: "M4 12a8 8 0 1 0 2.6-5.9L4 8.5 M4 4v4.5h4.5 M12 8v4l3 1.5" },
  building: {
    line: "M5 20.5v-15a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v15 M16 9.5h2a2 2 0 0 1 2 2v9 M3 20.5h18 M8.5 7.5h1 M11.5 7.5h1 M8.5 11h1 M11.5 11h1 M8.5 14.5h1 M11.5 14.5h1",
    accent: "M5 20.5v-15a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v15z",
  },
  landmark: {
    line: "M3 9.5 12 4l9 5.5z M5.5 10v7 M10 10v7 M14 10v7 M18.5 10v7 M4.5 17h15 M3.5 20.5h17",
    accent: "M3 9.5 12 4l9 5.5z",
  },
  store: {
    line: "M3.5 9 5 4.5h14L20.5 9a2.8 2.8 0 0 1-5.6 0 2.8 2.8 0 0 1-5.8 0 2.8 2.8 0 0 1-5.6 0z M5 11.5v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7 M10 20.5V16h4v4.5",
    accent: "M3.5 9 5 4.5h14L20.5 9a2.8 2.8 0 0 1-5.6 0 2.8 2.8 0 0 1-5.8 0 2.8 2.8 0 0 1-5.6 0z",
  },
  "graduation-cap": {
    line: "M12 4 2.5 9l9.5 5 9.5-5z M6.5 11.2V16c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.8 M21.5 9v5",
    accent: "M12 4 2.5 9l9.5 5 9.5-5z",
  },
  banknote: {
    line: `${rounded(2.5, 6, 19, 12, 2.5)} ${circle(12, 12, 2.5)}`,
    accent: rounded(2.5, 6, 19, 12, 2.5),
    dot: circle(6, 12, 1) + circle(18, 12, 1),
  },
  coins: {
    line: `${circle(9, 9, 5.5)} M15.6 9.6a5.5 5.5 0 1 1-6 6 M9 6.8v4.4`,
    accent: circle(9, 9, 5.5),
  },
  "credit-card": {
    line: `${rounded(2.5, 5, 19, 14, 2.5)} M2.5 10h19 M6.5 15h3`,
    accent: "M2.5 7.5A2.5 2.5 0 0 1 5 5h14a2.5 2.5 0 0 1 2.5 2.5V10h-19z",
  },
  "piggy-bank": {
    line: "M5 11.5a7 6 0 0 1 7-5.5h2a6 6 0 0 1 5 2.5h1.5v4l-1.8 1a6 6 0 0 1-2.2 2.6V19h-3v-1.5h-3V19h-3v-2.5A6 6 0 0 1 5 11.5z M3 10.5a2 2 0 0 0 2 2 M10 8.5h3",
    accent:
      "M5 11.5a7 6 0 0 1 7-5.5h2a6 6 0 0 1 5 2.5h1.5v4l-1.8 1a6 6 0 0 1-2.2 2.6V19h-3v-1.5h-3V19h-3v-2.5A6 6 0 0 1 5 11.5z",
    dot: circle(16.5, 10.5, 0.9),
  },
  "pie-chart": {
    line: "M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z M15 3v6h6a6 6 0 0 0-6-6z",
    accent: "M15 3v6h6a6 6 0 0 0-6-6z",
  },
  target: { line: `${RING} ${circle(12, 12, 5)}`, accent: RING, dot: circle(12, 12, 1.5) },
  inbox: {
    line: "M3.5 13.5 6.2 5.6a2 2 0 0 1 1.9-1.1h7.8a2 2 0 0 1 1.9 1.1l2.7 7.9V18a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 3.5 18z M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5",
    accent: "M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5V18a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 3.5 18z",
  },
  "upload-cloud": { line: `${CLOUD} M12 20.5v-8 M8.8 15.3 12 12l3.2 3.3`, accent: `${CLOUD}z` },
  "arrow-up-from-line": { line: "M12 16V4.5 M7 9.5l5-5 5 5 M5 20h14" },
  "arrow-down-to-line": { line: "M12 4v11.5 M7 10.5l5 5 5-5 M5 20h14" },
  "arrow-down-left": { line: "M17.5 6.5l-11 11 M6.5 9v8.5H15" },
  "arrow-down-right": { line: "M7 7l10 10 M17 8.5V17H8.5" },
  "arrow-up-right": { line: "M7 17 17 7 M8.5 7H17v8.5" },
  "qr-code": {
    line: `${rounded(3.5, 3.5, 7, 7, 1.5)}${rounded(13.5, 3.5, 7, 7, 1.5)}${rounded(3.5, 13.5, 7, 7, 1.5)} M13.5 13.5h3v3 M13.5 20.5h3 M20.5 17v3.5h-1`,
    accent: rounded(3.5, 3.5, 7, 7, 1.5),
    dot: circle(7, 7, 1) + circle(17, 7, 1) + circle(7, 17, 1) + circle(20.5, 13.5, 1),
  },

  // Keamanan & status
  "shield-check": { line: `${SHIELD} M8.8 12.2l2.2 2.2 4.4-4.6`, accent: SHIELD },
  "shield-alert": { line: `${SHIELD} M12 8v4.5`, accent: SHIELD, dot: circle(12, 16.2, 1.2) },
  "badge-check": { line: `${BADGE} M8.8 12.2l2.2 2.2 4.4-4.6`, accent: BADGE },
  lock: {
    line: `${rounded(5, 9.5, 14, 11.5, 2.5)} M8 9.5v-2a4 4 0 0 1 8 0v2 M12 14.5v2`,
    accent: rounded(5, 9.5, 14, 11.5, 2.5),
  },
  unlock: {
    line: `${rounded(5, 9.5, 14, 11.5, 2.5)} M8 9.5v-2a4 4 0 0 1 7.8-1.2 M12 14.5v2`,
    accent: rounded(5, 9.5, 14, 11.5, 2.5),
  },
  "key-round": {
    line: `${circle(8, 15.5, 4.5)} M11.2 12.3 19.5 4 M16.5 7l2.5 2.5 M14.5 9l1.8 1.8`,
    accent: circle(8, 15.5, 4.5),
    dot: circle(7.5, 16, 1),
  },
  fingerprint: {
    line: "M5.5 10.5a6.5 6.5 0 0 1 13 0V12 M8.5 20a10 10 0 0 0 1-4.5v-5a2.5 2.5 0 0 1 5 0v3 M12 10.5v5a12 12 0 0 1-1.5 5.5 M18.5 15.5a14 14 0 0 1-1 4 M5.5 14v-1 M14.5 17.5a14 14 0 0 1-.6 3",
  },
  eye: { line: EYE, accent: EYE, dot: circle(12, 12, 2.6) },
  "eye-off": {
    line: "M9.9 5.7A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.4 3.2 M6.4 7.4C3.9 9.1 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.9 0 3.6-.6 5-1.5 M3.5 3.5l17 17 M10 10a2.8 2.8 0 0 0 4 4",
  },
  "check-circle": { line: `${RING} M8 12.3l2.8 2.8 5.2-5.6`, accent: RING },
  info: { line: `${RING} M12 11v5.5`, accent: RING, dot: circle(12, 7.8, 1.25) },
  "help-circle": {
    line: `${RING} M9.5 9.3a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.2-2.5 3.7`,
    accent: RING,
    dot: circle(12, 17, 1.25),
  },
  "alert-circle": { line: `${RING} M12 7.5V13`, accent: RING, dot: circle(12, 16.5, 1.25) },
  "alert-triangle": { line: `${TRIANGLE} M12 9.5V14`, accent: TRIANGLE, dot: circle(12, 17, 1.2) },
  "alert-octagon": { line: `${OCTAGON} M12 7.5V13`, accent: OCTAGON, dot: circle(12, 16.5, 1.25) },
  ban: { line: `${RING} M5.6 5.6l12.8 12.8`, accent: RING },
  siren: {
    line: "M6.5 18v-5.5a5.5 5.5 0 0 1 11 0V18 M4 18h16v2.5H4z M12 3v1.5 M4 6l1.2 1.2 M20 6l-1.2 1.2 M12 10a2.5 2.5 0 0 0-2.5 2.5",
    accent: "M6.5 18v-5.5a5.5 5.5 0 0 1 11 0V18z",
  },
  "life-buoy": {
    line: `${RING} ${circle(12, 12, 4)} M5.6 5.6l3.6 3.6 M14.8 14.8l3.6 3.6 M18.4 5.6l-3.6 3.6 M9.2 14.8l-3.6 3.6`,
    accent: RING,
  },
  "heart-pulse": {
    line: "M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 6.6a4.5 4.5 0 0 1 8 2.9C20 15.4 12 20 12 20z M3.5 12H8l1.5-2.5 2.5 5 1.5-2.5h4",
    accent: "M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 6.6a4.5 4.5 0 0 1 8 2.9C20 15.4 12 20 12 20z",
  },

  // Komunikasi
  bell: { line: `${BELL} M10 21h4`, accent: BELL },
  "bell-ring": {
    line: `${BELL} M10 21h4 M3 6.5a8 8 0 0 1 2.5-3.5 M21 6.5a8 8 0 0 0-2.5-3.5`,
    accent: BELL,
  },
  "bell-off": { line: "M8.4 5.6A6 6 0 0 1 18 11v4 M6 10.5v6l-1.5 2H16 M10 21h4 M3.5 3.5l17 17" },
  mail: { line: `${rounded(3.5, 5, 17, 14, 2.5)} M4 7l8 6 8-6`, accent: rounded(3.5, 5, 17, 14, 2.5) },
  "message-circle": {
    line: BUBBLE,
    accent: BUBBLE,
    dot: circle(8.5, 12, 1.1) + circle(12, 12, 1.1) + circle(15.5, 12, 1.1),
  },
  send: { line: `M21 3 10.5 13.5 ${SEND}`, accent: SEND },
  share: {
    line: "M12 3.5v11 M8 7.5l4-4 4 4 M8 10.5H7A2.5 2.5 0 0 0 4.5 13v5A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-5a2.5 2.5 0 0 0-2.5-2.5h-1",
    accent: rounded(4.5, 10.5, 15, 10, 2.5),
  },
  "share-nodes": {
    line: `${circle(18, 5.5, 2.5)}${circle(6, 12, 2.5)}${circle(18, 18.5, 2.5)} M8.2 10.8l7.6-4 M8.2 13.2l7.6 4`,
    accent: circle(18, 5.5, 2.5) + circle(6, 12, 2.5) + circle(18, 18.5, 2.5),
  },
  copy: {
    line: `${rounded(8.5, 8.5, 12, 12, 2.5)} M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5`,
    accent: rounded(8.5, 8.5, 12, 12, 2.5),
  },
  "map-pin": { line: `${PIN} ${circle(12, 9.5, 2.5)}`, accent: PIN },
  smartphone: { line: `${rounded(6, 2.5, 12, 19, 2.5)} M10.5 18h3`, accent: rounded(6, 2.5, 12, 19, 2.5) },
  laptop: { line: `${rounded(4.5, 4.5, 15, 11, 2)} M2.5 19.5h19`, accent: rounded(4.5, 4.5, 15, 11, 2) },
  camera: {
    line: `M3.5 9A2.5 2.5 0 0 1 6 6.5h2L9.5 4h5L16 6.5h2A2.5 2.5 0 0 1 20.5 9v8.5A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5z ${circle(12, 13, 3.5)}`,
    accent: "M3.5 9A2.5 2.5 0 0 1 6 6.5h2L9.5 4h5L16 6.5h2A2.5 2.5 0 0 1 20.5 9v8.5A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5z",
  },
  images: {
    line: `${rounded(7, 3.5, 14, 12, 2.5)} M3.5 8v9.5a3 3 0 0 0 3 3H16 M7.5 13.5 11 10l3 3 2-2 4.5 4.5`,
    accent: rounded(7, 3.5, 14, 12, 2.5),
    dot: circle(16.5, 7.5, 1.2),
  },
  "file-text": { line: `${FILE} M14 3v5h5 M9 13h6 M9 16.5h4`, accent: FILE },
  "file-check": { line: `${FILE} M14 3v5h5 M9 14.5l2 2 4-4`, accent: FILE },
  "file-spreadsheet": { line: `${FILE} M14 3v5h5 M8.5 12.5h7v5h-7z M12 12.5v5 M8.5 15h7`, accent: FILE },

  // Gaya hidup
  coffee: {
    line: "M4.5 9h12v5.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z M16.5 10.5H18a2.5 2.5 0 0 1 0 5h-1.6 M8 3.5V6 M12 3.5V6",
    accent: "M4.5 9h12v5.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z",
  },
  utensils: {
    line: "M6 3v6a2.5 2.5 0 0 0 5 0V3 M8.5 3v18 M17.5 21V3c-2 1-3 3.5-3 7 0 1.5.8 2.5 3 2.5",
    accent: "M17.5 12.5V3c-2 1-3 3.5-3 7 0 1.5.8 2.5 3 2.5z",
  },
  "shopping-bag": {
    line: "M5.5 7.5h13l-1 11.5a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8z M9 10V7a3 3 0 0 1 6 0v3",
    accent: "M5.5 7.5h13l-1 11.5a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8z",
  },
  bus: {
    line: `${rounded(5, 3.5, 14, 15, 3)} M5 11h14 M7.5 18.5V21 M16.5 18.5V21 M9 6.5h6`,
    accent: rounded(5, 3.5, 14, 15, 3),
    dot: circle(8.5, 15, 1) + circle(15.5, 15, 1),
  },
  plane: { line: PLANE, accent: PLANE },
  gamepad: {
    line: "M7.5 7h9a4.5 4.5 0 0 1 4.4 5.4l-.8 4.1a2.6 2.6 0 0 1-4.5 1.2L14 16h-4l-1.6 1.7a2.6 2.6 0 0 1-4.5-1.2l-.8-4.1A4.5 4.5 0 0 1 7.5 7z M8 10v3 M6.5 11.5h3",
    accent:
      "M7.5 7h9a4.5 4.5 0 0 1 4.4 5.4l-.8 4.1a2.6 2.6 0 0 1-4.5 1.2L14 16h-4l-1.6 1.7a2.6 2.6 0 0 1-4.5-1.2l-.8-4.1A4.5 4.5 0 0 1 7.5 7z",
    dot: circle(15, 10.5, 1) + circle(17, 12.5, 1),
  },
  gift: {
    line: `${rounded(3, 7, 18, 4, 1.5)} M4.5 11v7.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V11 M12 7v13.5 M12 7C10.5 4 7 3.5 7 5.5S10 7 12 7z M12 7c1.5-3 5-3.5 5-1.5S14 7 12 7z`,
    accent: "M4.5 11h15v7.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z",
  },
  umbrella: {
    line: "M2.5 12a9.5 9.5 0 0 1 19 0z M12 12v6.5a2 2 0 0 1-4 0 M12 2.5v0",
    accent: "M2.5 12a9.5 9.5 0 0 1 19 0z",
  },
  trophy: {
    line: "M7 3.5h10v6a5 5 0 0 1-10 0z M7 5.5H4.5V7a3 3 0 0 0 3 3 M17 5.5h2.5V7a3 3 0 0 1-3 3 M12 14.5V18 M8 20.5h8 M9.5 18h5",
    accent: "M7 3.5h10v6a5 5 0 0 1-10 0z",
  },
  star: { line: STAR, accent: STAR },
  zap: { line: ZAP, accent: ZAP },
  "thumbs-up": {
    line: `M7.5 10.5 11 3.5a2.3 2.3 0 0 1 2.8 2.6l-.6 3.4h5.3a2 2 0 0 1 2 2.4l-1.4 7a2 2 0 0 1-2 1.6H7.5z ${rounded(3, 10.5, 4.5, 10, 1.2)}`,
    accent: "M7.5 10.5 11 3.5a2.3 2.3 0 0 1 2.8 2.6l-.6 3.4h5.3a2 2 0 0 1 2 2.4l-1.4 7a2 2 0 0 1-2 1.6H7.5z",
  },
  "thumbs-down": {
    line: `M16.5 13.5 13 20.5a2.3 2.3 0 0 1-2.8-2.6l.6-3.4H5.5a2 2 0 0 1-2-2.4l1.4-7a2 2 0 0 1 2-1.6h9.6z ${rounded(16.5, 3.5, 4.5, 10, 1.2)}`,
    accent: "M16.5 13.5 13 20.5a2.3 2.3 0 0 1-2.8-2.6l.6-3.4H5.5a2 2 0 0 1-2-2.4l1.4-7a2 2 0 0 1 2-1.6h9.6z",
  },

  // Aksi
  pencil: { line: `${PENCIL} M13.5 6.5l4 4`, accent: PENCIL },
  trash: {
    line: "M4 6.5h16 M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5 M5.8 6.5l.9 12.1a2 2 0 0 0 2 1.9h6.6a2 2 0 0 0 2-1.9l.9-12.1 M10 10.5v6 M14 10.5v6",
    accent: "M5.8 6.5h12.4l-.9 12.1a2 2 0 0 1-2 1.9H8.7a2 2 0 0 1-2-1.9z",
  },
  refresh: {
    line: "M19.5 12a7.5 7.5 0 0 1-13.1 5 M4.5 12a7.5 7.5 0 0 1 13.1-5 M17.6 3.3V7h-3.7 M6.4 20.7V17h3.7",
  },
  "rotate-ccw": { line: "M4 12a8 8 0 1 0 2.6-5.9L4 8.5 M4 4v4.5h4.5" },
  sliders: {
    line: `M4 7h9 M17 7h3 M4 17h3 M11 17h9 ${circle(15, 7, 2.2)}${circle(9, 17, 2.2)}`,
    accent: circle(15, 7, 2.2) + circle(9, 17, 2.2),
  },
  "log-out": {
    line: "M9.5 20.5H7A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5h2.5 M10 12h10.5 M16.5 7.5 21 12l-4.5 4.5",
    accent: "M4.5 6A2.5 2.5 0 0 1 7 3.5h2.5v17H7A2.5 2.5 0 0 1 4.5 18z",
  },
  unplug: {
    line: "M6.5 11.5l6 6-2 2a4.3 4.3 0 0 1-6-6z M4.5 19.5l-2 2 M9 11l2-2 M13 15l2-2 M17.5 12.5l-6-6 2-2a4.3 4.3 0 0 1 6 6z M19.5 4.5l2-2",
    accent: "M6.5 11.5l6 6-2 2a4.3 4.3 0 0 1-6-6z",
  },
  "list-checks": { line: "M3.5 6.5l1.8 1.8 3.2-3.3 M3.5 15.5l1.8 1.8 3.2-3.3 M12 7h8.5 M12 16h8.5" },
  maximize: { line: "M14.5 4H20v5.5 M9.5 20H4v-5.5 M20 4l-6.5 6.5 M4 20l6.5-6.5" },
  minimize: { line: "M4.5 14H10v5.5 M19.5 10H14V4.5 M10 14l-6 6 M14 10l6-6" },

  // Dasar
  x: { line: "M6 6l12 12 M18 6 6 18" },
  check: { line: "M4.5 12.5l5 5 10-11" },
  "chevron-left": { line: "M14.5 5.5 8 12l6.5 6.5" },
  "chevron-right": { line: "M9.5 5.5 16 12l-6.5 6.5" },
  "chevron-down": { line: "M5.5 9.5 12 16l6.5-6.5" },
  "arrow-left": { line: "M19.5 12h-15 M10.5 6l-6 6 6 6" },
  "arrow-right": { line: "M4.5 12h15 M13.5 6l6 6-6 6" },
  "arrow-up": { line: "M12 19.5v-15 M6 10.5l6-6 6 6" },
} satisfies Record<string, IconGeometry>;

export type IconName = keyof typeof ICON_PATHS;
