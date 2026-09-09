import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// MD3 role tokens resolve from CSS custom properties holding channel-only RGB
// triplets, which is what keeps Tailwind's `/opacity` modifiers working.
const role = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        primary: role("--md-primary"),
        "on-primary": role("--md-on-primary"),
        "primary-container": role("--md-primary-container"),
        "on-primary-container": role("--md-on-primary-container"),
        "secondary-container": role("--md-secondary-container"),
        "on-secondary-container": role("--md-on-secondary-container"),
        surface: role("--md-surface"),
        "on-surface": role("--md-on-surface"),
        "surface-container-low": role("--md-surface-container-low"),
        "surface-container": role("--md-surface-container"),
        "surface-container-high": role("--md-surface-container-high"),
        "surface-container-highest": role("--md-surface-container-highest"),
        "surface-variant": role("--md-surface-variant"),
        "on-surface-variant": role("--md-on-surface-variant"),
        outline: role("--md-outline"),
        "outline-variant": role("--md-outline-variant"),
        error: role("--md-error"),
        "on-error": role("--md-on-error"),
        "error-container": role("--md-error-container"),
        "on-error-container": role("--md-on-error-container"),
        scrim: role("--md-scrim"),
        "inverse-surface": role("--md-inverse-surface"),
        "inverse-on-surface": role("--md-inverse-on-surface"),
        "inverse-primary": role("--md-inverse-primary"),
      },
      fontFamily: {
        sans: ["var(--font-roboto)", ...defaultTheme.fontFamily.sans],
        symbols: ['"Material Symbols Outlined"'],
      },
      fontSize: {
        "display-large": ["3.5625rem", { lineHeight: "4rem", letterSpacing: "-0.015625rem", fontWeight: "400" }],
        "display-medium": ["2.8125rem", { lineHeight: "3.25rem", letterSpacing: "0", fontWeight: "400" }],
        "display-small": ["2.25rem", { lineHeight: "2.75rem", letterSpacing: "0", fontWeight: "400" }],
        "headline-large": ["2rem", { lineHeight: "2.5rem", letterSpacing: "0", fontWeight: "400" }],
        "headline-medium": ["1.75rem", { lineHeight: "2.25rem", letterSpacing: "0", fontWeight: "400" }],
        "headline-small": ["1.5rem", { lineHeight: "2rem", letterSpacing: "0", fontWeight: "400" }],
        "title-large": ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "0", fontWeight: "400" }],
        "title-medium": ["1rem", { lineHeight: "1.5rem", letterSpacing: "0.009375rem", fontWeight: "500" }],
        "title-small": ["0.875rem", { lineHeight: "1.25rem", letterSpacing: "0.00625rem", fontWeight: "500" }],
        "body-large": ["1rem", { lineHeight: "1.5rem", letterSpacing: "0.03125rem", fontWeight: "400" }],
        "body-medium": ["0.875rem", { lineHeight: "1.25rem", letterSpacing: "0.015625rem", fontWeight: "400" }],
        "body-small": ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.025rem", fontWeight: "400" }],
        "label-large": ["0.875rem", { lineHeight: "1.25rem", letterSpacing: "0.00625rem", fontWeight: "500" }],
        "label-medium": ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.03125rem", fontWeight: "500" }],
        "label-small": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.03125rem", fontWeight: "500" }],
      },
      boxShadow: {
        "elevation-0": "none",
        "elevation-1": "0 1px 2px 0 rgb(0 0 0 / 0.30), 0 1px 3px 1px rgb(0 0 0 / 0.15)",
        "elevation-2": "0 1px 2px 0 rgb(0 0 0 / 0.30), 0 2px 6px 2px rgb(0 0 0 / 0.15)",
        "elevation-3": "0 1px 3px 0 rgb(0 0 0 / 0.30), 0 4px 8px 3px rgb(0 0 0 / 0.15)",
        "elevation-4": "0 2px 3px 0 rgb(0 0 0 / 0.30), 0 6px 10px 4px rgb(0 0 0 / 0.15)",
        "elevation-5": "0 4px 4px 0 rgb(0 0 0 / 0.30), 0 8px 12px 6px rgb(0 0 0 / 0.15)",
      },
      borderRadius: {
        none: "0",
        xs: "4px",
        sm: "8px",
        DEFAULT: "8px",
        md: "12px",
        lg: "16px",
        xl: "28px",
        full: "9999px",
      },
      screens: {
        // MD3 window size classes; deliberately additive so Tailwind's own
        // sm/md/lg keep their documented 640/768/1024 values.
        medium: "600px",
        expanded: "840px",
      },
      transitionTimingFunction: {
        emphasized: "cubic-bezier(0.2, 0, 0, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
