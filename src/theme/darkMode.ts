import { useEffect, useState } from "react";

import "./darkMode.css";

/*
 * Dark mode for the student dashboard.
 *
 * The choice is saved on this device. While the student dashboard is open,
 * `cs-dark` is put on <html>, and darkMode.css turns the page dark. Other
 * screens (login, staff dashboards) are never affected.
 */

const STORAGE_KEY = "campuserve-theme";
const CHANGE_EVENT = "campuserve-theme-change";

export function isDarkModeSaved(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark";
  } catch {
    return false;
  }
}

export function saveDarkMode(dark: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // Storage unavailable: the choice lasts until the page reloads.
  }

  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: dark }));
}

/** The saved choice, kept in sync with the settings toggle and other tabs. */
export function useDarkMode(): [boolean, (dark: boolean) => void] {
  const [dark, setDark] = useState(isDarkModeSaved);

  useEffect(() => {
    const sync = () => setDark(isDarkModeSaved());

    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return [dark, saveDarkMode];
}

/** Applies dark mode while the calling screen is mounted. */
export function useApplyDarkMode() {
  const [dark] = useDarkMode();

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle("cs-dark", dark);

    return () => root.classList.remove("cs-dark");
  }, [dark]);
}
