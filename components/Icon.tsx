export type IconName =
  | "close"
  | "dark_mode"
  | "description"
  | "light_mode"
  | "menu"
  | "person"
  | "progress_activity"
  | "refresh"
  | "send"
  | "smart_toy";

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export default function Icon({ name, size = 24, className = "" }: IconProps) {
  // The stylesheet is requested at opsz 20..48; anything outside clamps anyway.
  const opsz = Math.min(48, Math.max(20, size));

  return (
    <span
      className={`icon ${className}`}
      aria-hidden="true"
      style={{
        fontSize: size,
        width: size,
        height: size,
        fontVariationSettings: `"FILL" 0, "wght" 400, "GRAD" 0, "opsz" ${opsz}`,
      }}
    >
      {name}
    </span>
  );
}
