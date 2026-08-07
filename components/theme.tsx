"use client";

import { useEffect, useState } from "react";

// Dark is the design, not a preference. The OS setting is deliberately
// ignored — only an explicit toggle on this site switches it, and that
// choice is remembered. Runs before paint, so there is no flash.
export const themeScript = `
(function(){try{
  var s=localStorage.getItem('theme');
  document.documentElement.setAttribute('data-theme', s === 'light' ? 'light' : 'dark');
}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();
`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode */
    }
    setTheme(next);
  };

  return (
    <button
      onClick={flip}
      className="mono transition-colors hover:opacity-100"
      style={{ color: "var(--faint)" }}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? "light" : "dark"}
    </button>
  );
}
