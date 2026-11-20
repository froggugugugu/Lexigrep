import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        fontSize: 72,
        letterSpacing: "-0.04em",
      }}
    >
      {">_"}
    </div>,
    size,
  );
}
