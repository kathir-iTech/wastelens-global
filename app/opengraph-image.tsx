import { ImageResponse } from "next/og";

export const alt = "WasteLens Global — Statutory Waste Compliance";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 88,
          backgroundColor: "#0c120f",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            borderRadius: 9999,
            left: -180,
            top: -180,
            backgroundColor: "rgba(127,209,160,0.16)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 460,
            height: 460,
            borderRadius: 9999,
            right: -120,
            top: 60,
            backgroundColor: "rgba(242,196,111,0.13)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 380,
            height: 380,
            borderRadius: 9999,
            right: 260,
            bottom: -200,
            backgroundColor: "rgba(239,143,143,0.12)",
          }}
        />
        <div
          style={{
            display: "flex",
            fontFamily: "monospace",
            fontSize: 26,
            letterSpacing: 8,
            color: "#f2c46f",
            textTransform: "uppercase",
          }}
        >
          Perception proposes.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 92,
            fontWeight: 700,
            letterSpacing: -2,
            color: "#edf2ec",
            marginTop: 12,
          }}
        >
          WasteLens&nbsp;<span style={{ color: "#7fd1a0" }}>Global</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 40,
            color: "#93a19a",
            marginTop: 12,
          }}
        >
          The law decides.
        </div>
      </div>
    ),
    { ...size }
  );
}