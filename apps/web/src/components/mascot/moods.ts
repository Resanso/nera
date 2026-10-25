export type NeraMood = "idle" | "happy" | "wave" | "celebrate" | "thinking" | "alert";

export type NeraMascotProps = {
  mood?: NeraMood;
  size?: number;
  /** Eyes (and in 3D, the head) follow the pointer anywhere on the page. */
  trackPointer?: boolean;
  onPoke?: () => void;
};

export const NERA_COLORS = {
  yellow: "#FFC81E",
  yellowLight: "#FFE476",
  yellowShade: "#F0A20C",
  yellowDeep: "#C97C06",
  visor: "#151B33",
  visorShine: "#232B4D",
  led: "#4FE5FF",
  cheek: "#FFC93C",
};
