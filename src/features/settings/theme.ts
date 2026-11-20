import { themeSchema, type Theme } from "@/shared/content/schema";

export const THEME_COOKIE = "lexigrep-theme";
export const TZ_COOKIE = "lexigrep-tz";
export const DEFAULT_TIME_ZONE = "Asia/Tokyo";

export function parseTheme(value: string | undefined): Theme {
  const r = themeSchema.safeParse(value);
  return r.success ? r.data : "system";
}

/** IANA タイムゾーンとして妥当か(不正値は既定にフォールバック) */
export function parseTimeZone(value: string | undefined): string {
  if (!value) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** system を OS 設定で解決する。SSR では解決できないので属性 "system" のまま出し、クライアントで差し替える */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;if(d.getAttribute('data-theme')==='system'){d.setAttribute('data-theme',window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}}catch(e){}})();`;
