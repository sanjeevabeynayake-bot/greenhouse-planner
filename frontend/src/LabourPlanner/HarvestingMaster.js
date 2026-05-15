import React from "react";
import { LP } from "./styles";

export default function HarvestingMaster() {
  return (
    <div style={{
      background: LP.white, borderRadius: 12, padding: 40,
      border: `1px solid ${LP.border}`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: 400, gap: 12,
    }}>
      <div style={{ fontSize: 40 }}>🌾</div>
      <h3 style={{ color: LP.forest, margin: 0, fontFamily: "'Palatino Linotype', Georgia, serif", fontSize: 22 }}>
        Harvesting Master
      </h3>
      <p style={{ color: LP.textMid, margin: 0, fontSize: 14, textAlign: "center", maxWidth: 400 }}>
        Step 6 — Time per KG, bell-curve weekly volume generator, and
        calculated time-required row per crop.
        Building after Step 5 is confirmed.
      </p>
    </div>
  );
}
