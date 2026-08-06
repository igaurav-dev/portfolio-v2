"use client";

import { useEffect, useState } from "react";

export const themeScript = `
(function(){try{
  var s=localStorage.getItem('theme');
  var d=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
  document.documentElement.setAttribute('data-theme', s || d);
}catch(e){}})();
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
