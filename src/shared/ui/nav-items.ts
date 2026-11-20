/** 主要メニュー。どの画面でも BottomNav の同じアイランドとして表示する */
export const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: "home" },
  { href: "/subjects", label: "題材", icon: "books" },
  { href: "/dictionary", label: "辞書", icon: "search" },
  { href: "/dashboard", label: "記録", icon: "chart" },
  { href: "/settings", label: "設定", icon: "gear" },
] as const;

export type NavIconName = (typeof NAV_ITEMS)[number]["icon"];
