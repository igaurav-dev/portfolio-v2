import { ImageResponse } from "next/og";
import { getProfile } from "@/lib/content";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Gaurav Kumar — Generative AI & Full Stack Engineer";

export default async function OpengraphImage() {
  const profile = await getProfile();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0b",
          padding: "68px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 10, height: 10, borderRadius: 999, background: "#d8ff3e" }} />
          <div style={{ color: "#d8ff3e", fontSize: 21, letterSpacing: 3, textTransform: "uppercase" }}>
            {profile.role}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ color: "#e8e8ea", fontSize: 78, lineHeight: 1.02, letterSpacing: -2.6, maxWidth: 960 }}>
            {profile.name}
          </div>
          <div style={{ color: "#9a9aa3", fontSize: 30, lineHeight: 1.35, maxWidth: 900 }}>
            {profile.shortStatement}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 14 }}>
            {["RAG", "AI agents", "Vector search", "Azure", "AWS"].map((t) => (
              <div
                key={t}
                style={{
                  color: "#9a9aa3",
                  fontSize: 20,
                  border: "1px solid #2c2c33",
                  borderRadius: 6,
                  padding: "7px 15px",
                }}
              >
                {t}
              </div>
            ))}
          </div>
          <div style={{ color: "#61616b", fontSize: 21 }}>{profile.email}</div>
        </div>
      </div>
    ),
    size,
  );
}
