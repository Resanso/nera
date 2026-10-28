import React from "react";
import { ICON_PATHS, type IconName } from "./paths";

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  size?: number | string;
  strokeWidth?: number | string;
  /** "duo" fills the main shape behind the outline (Gojek-style); "line" is outline only. */
  variant?: "duo" | "line";
  /** Duo fill color. Defaults to the icon color at low opacity, so it works on any background. */
  accent?: string;
  ref?: React.Ref<SVGSVGElement>;
}

export type NeraIcon = React.FC<IconProps>;

const DEFAULT_ACCENT_OPACITY = 0.2;

export function createIcon(name: IconName, displayName: string): NeraIcon {
  const { line, accent: accentPath, dot } = ICON_PATHS[name] as { line: string; accent?: string; dot?: string };

  const Icon: NeraIcon = ({
    size = 24,
    strokeWidth = 2,
    color = "currentColor",
    variant = "duo",
    accent,
    className,
    ...rest
  }) => {
    const labelled = rest["aria-label"] != null || rest["aria-labelledby"] != null;

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={labelled ? undefined : true}
        className={className ? `nera-icon nera-icon-${name} ${className}` : `nera-icon nera-icon-${name}`}
        {...rest}
      >
        {variant === "duo" && accentPath ? (
          <path
            d={accentPath}
            fill={accent ?? color}
            fillOpacity={accent ? undefined : DEFAULT_ACCENT_OPACITY}
            stroke="none"
          />
        ) : null}
        <path d={line} />
        {dot ? <path d={dot} fill={color} stroke="none" /> : null}
      </svg>
    );
  };

  Icon.displayName = displayName;
  return Icon;
}
