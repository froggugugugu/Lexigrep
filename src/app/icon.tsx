import { ImageResponse } from "next/og";

/** アプリアイコン。manifest と favicon の両方で使う(PNG を ImageResponse で生成) */
export function generateImageMetadata() {
  return [
    { id: "32", size: { width: 32, height: 32 }, contentType: "image/png" },
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png" },
    { id: "512m", size: { width: 512, height: 512 }, contentType: "image/png" },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const iconId = String(await id);
  const maskable = iconId === "512m";
  const size = maskable ? 512 : Number(iconId);
  const fontSize = Math.round(size * (maskable ? 0.34 : 0.46));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0f14",
        color: "#4cc2ff",
        fontFamily: "monospace",
        fontWeight: 700,
        fontSize,
        letterSpacing: "-0.04em",
        borderRadius: maskable ? 0 : Math.round(size * 0.2),
      }}
    >
      {">_"}
    </div>,
    { width: size, height: size },
  );
}
