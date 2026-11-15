import React from "react";

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  tag?: string;
  icon?: React.ReactNode;
  accentColor?: "navy" | "teal" | "gold" | "lavender";
}

// Bold, solid colour tiles - each metric owns one colour of the palette.
const TONES = {
  navy: { a: "#23a07a", b: "#0b5340", ink: "#f4ffe9", mute: "rgb(235 255 225 / 72%)" },
  teal: { a: "#22c0b8", b: "#0a7471", ink: "#effffb", mute: "rgb(225 255 250 / 74%)" },
  gold: { a: "#ffcb52", b: "#e58a00", ink: "#2e1b00", mute: "rgb(46 27 0 / 66%)" },
  lavender: { a: "#f59467", b: "#bf4a26", ink: "#fff3ea", mute: "rgb(255 238 225 / 76%)" },
} as const;

export const MetricCard: React.FC<Props> = ({
  title,
  value,
  subtitle,
  tag,
  icon,
  accentColor = "navy",
}) => {
  const t = TONES[accentColor];

  return (
    <div
      className="fi-kpi"
      style={
        {
          "--k1": t.a,
          "--k2": t.b,
          "--kt": t.ink,
          "--km": t.mute,
        } as React.CSSProperties
      }
    >
      <div className="fi-kpi-top">
        <span className="fi-kpi-label">{title}</span>
        {icon && <span className="fi-kpi-icon">{icon}</span>}
      </div>
      <div className="fi-kpi-value">{value}</div>
      <div className="fi-kpi-foot">
        {tag && <span className="fi-kpi-tag">{tag}</span>}
        {subtitle && <span className="fi-kpi-sub">{subtitle}</span>}
      </div>
    </div>
  );
};
