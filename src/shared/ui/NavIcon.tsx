import type { NavIconName } from "./nav-items";

const shapes: Record<NavIconName, React.ReactNode> = {
  home: (
    <path d="M3 11 12 3.5 21 11v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  ),
  books: (
    <>
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="9.5" y="4" width="5" height="16" rx="1" />
      <rect
        x="16"
        y="4"
        width="4.5"
        height="16"
        rx="1"
        transform="rotate(-10 18 12)"
      />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5.5 5.5" />
    </>
  ),
  chart: (
    <>
      <rect x="3.5" y="13" width="4.5" height="7.5" rx="1" />
      <rect x="9.75" y="8" width="4.5" height="12.5" rx="1" />
      <rect x="16" y="3.5" width="4.5" height="17" rx="1" />
    </>
  ),
  gear: (
    <>
      <circle
        cx="12"
        cy="12"
        r="8.6"
        fill="none"
        strokeWidth="3"
        strokeLinecap="butt"
        strokeDasharray="3.4 3.355"
      />
      <path
        fillRule="evenodd"
        d="M12 5.6a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8zm0 4a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z"
      />
    </>
  ),
};

/** タブのアイコン。選択中は塗りつぶし、非選択は線画にする */
export function NavIcon({
  name,
  filled,
}: {
  name: NavIconName;
  filled: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes[name]}
    </svg>
  );
}
