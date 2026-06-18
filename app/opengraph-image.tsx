import { ImageResponse } from "next/og";

export const alt = "EduOps — daily operations for Indian education teams";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 72, background: "#0b2f29", color: "white" }}>
      <div style={{ display: "flex", fontSize: 34, color: "#a7f3d0" }}>EduOps</div>
      <div style={{ display: "flex", marginTop: 28, maxWidth: 950, fontSize: 68, lineHeight: 1.1, fontWeight: 700 }}>Run attendance, fees, admissions and parent communication from one screen.</div>
      <div style={{ display: "flex", marginTop: 28, fontSize: 28, color: "#d1fae5" }}>Built for Indian schools and coaching centres.</div>
    </div>,
    size,
  );
}
