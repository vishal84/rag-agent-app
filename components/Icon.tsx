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
  filled?: boolean;
  className?: string;
}

export default function Icon({ name, size = 24, filled = false, className = "" }: IconProps) {
  return (
    <span
      className={`icon ${className}`}
      aria-hidden="true"
      style={{
        fontSize: size,
        width: size,
        height: size,
        fontVariationSettings: `"FILL" ${filled ? 1 : 0}, "wght" 400, "GRAD" 0, "opsz" ${size}`,
      }}
    >
      {name}
    </span>
  );
}
