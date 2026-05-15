export const LP = {
  forest:      "#1B4332",
  mid:         "#2D6A4F",
  light:       "#52B788",
  mint:        "#D8F3DC",
  amber:       "#C8870A",
  amberLight:  "#FFF3CD",
  cream:       "#F7F9F7",
  white:       "#FFFFFF",
  border:      "#C8DDD0",
  borderLight: "#E2EFE8",
  textDark:    "#1C2B22",
  textMid:     "#4A6358",
  textLight:   "#8BA89A",
  red:         "#B71C1C",
  redLight:    "#FFEBEE",
  // Cell states (consistent across all masters)
  cellGreen:    "#2D6A4F",   // ticked / standard week
  cellGrey:     "#E0E4E0",   // unticked / not planned
  cellAutoFill: "#EFEFEC",   // auto-filled by system (Phase 2)
  cellManual:   "#FFFFFF",   // manually entered (Phase 2)
  cellAmber:    "#FFF3CD",   // warning / override
};

export const lpBtn = (active, color = "#2D6A4F") => ({
  background: active ? color : "transparent",
  color: active ? "#fff" : color,
  border: `1.5px solid ${color}`,
  borderRadius: 8,
  padding: "9px 18px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  minHeight: 44,
  transition: "all 0.15s",
  whiteSpace: "nowrap",
  fontFamily: "inherit",
});

export const lpInp = {
  padding: "9px 12px",
  border: "1.5px solid #C8DDD0",
  borderRadius: 8,
  fontSize: 13,
  color: "#1C2B22",
  fontFamily: "inherit",
  background: "#fff",
  outline: "none",
  minHeight: 44,
  boxSizing: "border-box",
};
