"use client";

import { useEffect } from "react";

export default function ThemeInit() {
  useEffect(() => {
    const btn = document.getElementById("pn-theme-toggle");
    if (!btn) return;
    const html = document.documentElement;
    const handleClick = () => {
      const current = html.getAttribute("data-theme") ?? "light";
      const next = current === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      try { localStorage.setItem("pn-theme", next); } catch (e) {}
    };
    btn.addEventListener("click", handleClick);
    return () => btn.removeEventListener("click", handleClick);
  }, []);
  return null;
}
