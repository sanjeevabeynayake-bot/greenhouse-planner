import React from "react";
import { LP } from "./styles";

export default function CropMaster() {
  return (
    <div style={{
      background: LP.white, borderRadius: 12, padding: 40,
      border: `1px solid ${LP.border}`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: 400, gap: 12,
    }}>
      <div style={{ fontSize: 40 }}>📊</div>
      <h3 style={{ color: LP.forest, margin: 0, fontFamily: "'Palatino Linotype', Georgia, serif", fontSize: 22 }}>
        Crop Master
      </h3>
      <p style={{ color: LP.textMid, margin: 0, fontSize: 14, textAlign: "center", maxWidth: 400 }}>
        Step 4 — Crop density, hours-per-sqm and times-per-week per activity per week,
        with auto-fill cascade and standard-week highlighting.
        Building after Step 3 is confirmed.
      </p>
    </div>
  );
}
