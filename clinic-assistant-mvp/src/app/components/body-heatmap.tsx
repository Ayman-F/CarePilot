import type { ReactNode } from "react";

type GravityLevel = "LOW" | "MEDIUM" | "HIGH";

export type BodyRegion =
  | "head"
  | "neck"
  | "chest"
  | "left_arm"
  | "right_arm"
  | "abdomen"
  | "pelvis"
  | "left_leg"
  | "right_leg";

export type BodyHeatmapEntry = {
  region: BodyRegion;
  severity: GravityLevel;
};

type BodyHeatmapProps = {
  entries: BodyHeatmapEntry[];
};

const REGION_LABELS: Record<BodyRegion, string> = {
  head: "Head",
  neck: "Neck",
  chest: "Upper torso",
  left_arm: "Left arm",
  right_arm: "Right arm",
  abdomen: "Belly",
  pelvis: "Lower torso",
  left_leg: "Left leg",
  right_leg: "Right leg",
};

const BASE_FILL = "#d8dee8";
const BASE_SHADE = "#c7cfdb";
const OUTLINE = "#8b98ab";

const getRegionFill = (severity?: GravityLevel) => {
  if (severity === "HIGH") return "#ff4d4f";
  if (severity === "MEDIUM") return "#ff8a3d";
  if (severity === "LOW") return "#ffd24a";
  return BASE_FILL;
};

const getInsetFill = (severity?: GravityLevel) => {
  if (severity === "HIGH") return "#ff7375";
  if (severity === "MEDIUM") return "#ffab72";
  if (severity === "LOW") return "#ffe17b";
  return BASE_SHADE;
};

const part = (
  id: string,
  region: BodyRegion,
  severityByRegion: Map<BodyRegion, GravityLevel>,
  content: ReactNode,
) => (
  <g
    id={id}
    key={id}
    fill={getRegionFill(severityByRegion.get(region))}
    stroke={OUTLINE}
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {content}
  </g>
);

const innerPanel = (
  id: string,
  region: BodyRegion,
  severityByRegion: Map<BodyRegion, GravityLevel>,
  content: ReactNode,
) => (
  <g id={id} key={id} fill={getInsetFill(severityByRegion.get(region))} opacity="0.85">
    {content}
  </g>
);

export function BodyHeatmap({ entries }: BodyHeatmapProps) {
  const severityByRegion = new Map(
    entries.map((entry) => [entry.region, entry.severity] as const),
  );

  const activeLabels = entries.map((entry) => REGION_LABELS[entry.region]);
  const ariaLabel =
    activeLabels.length > 0
      ? `Roblox-style body heatmap highlighting ${activeLabels.join(", ")}`
      : "Roblox-style body heatmap";

  return (
    <div className="mt-4 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 shadow-[0_18px_36px_-28px_rgba(71,85,105,0.35)]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
        <div className="mx-auto w-full max-w-[300px] shrink-0 rounded-[1.5rem] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(241,245,249,0.96)_60%,_rgba(226,232,240,0.92)_100%)] p-3 shadow-inner">
          <svg
            viewBox="0 0 320 620"
            className="h-auto w-full"
            role="img"
            aria-label={ariaLabel}
          >
            <defs>
              <filter id="r15Shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="10"
                  stdDeviation="10"
                  floodColor="#94a3b8"
                  floodOpacity="0.2"
                />
              </filter>
            </defs>

            <rect x="24" y="16" width="272" height="588" rx="28" fill="#f8fafc" />

            <g filter="url(#r15Shadow)">
              {part(
                "head",
                "head",
                severityByRegion,
                <>
                  <rect x="118" y="36" width="84" height="84" rx="28" />
                  {innerPanel(
                    "head_inner",
                    "head",
                    severityByRegion,
                    <rect x="130" y="48" width="60" height="60" rx="20" />,
                  )}
                </>,
              )}

              {part(
                "neck",
                "neck",
                severityByRegion,
                <>
                  <rect x="142" y="120" width="36" height="24" rx="10" />
                  {innerPanel(
                    "neck_inner",
                    "neck",
                    severityByRegion,
                    <rect x="148" y="124" width="24" height="14" rx="6" />,
                  )}
                </>,
              )}

              {part(
                "upper_torso",
                "chest",
                severityByRegion,
                <>
                  <rect x="94" y="144" width="132" height="116" rx="28" />
                  {innerPanel(
                    "upper_torso_inner",
                    "chest",
                    severityByRegion,
                    <rect x="108" y="158" width="104" height="88" rx="20" />,
                  )}
                </>,
              )}

              {part(
                "lower_torso",
                "abdomen",
                severityByRegion,
                <>
                  <rect x="106" y="260" width="108" height="88" rx="24" />
                  {innerPanel(
                    "lower_torso_inner",
                    "abdomen",
                    severityByRegion,
                    <rect x="118" y="272" width="84" height="64" rx="18" />,
                  )}
                </>,
              )}

              {part(
                "pelvis",
                "pelvis",
                severityByRegion,
                <>
                  <rect x="102" y="348" width="116" height="62" rx="22" />
                  {innerPanel(
                    "pelvis_inner",
                    "pelvis",
                    severityByRegion,
                    <rect x="116" y="360" width="88" height="38" rx="14" />,
                  )}
                </>,
              )}

              {part(
                "left_upper_arm",
                "left_arm",
                severityByRegion,
                <>
                  <rect x="56" y="158" width="34" height="108" rx="16" />
                  {innerPanel(
                    "left_upper_arm_inner",
                    "left_arm",
                    severityByRegion,
                    <rect x="62" y="166" width="22" height="92" rx="11" />,
                  )}
                </>,
              )}

              {part(
                "left_lower_arm",
                "left_arm",
                severityByRegion,
                <>
                  <rect x="56" y="270" width="34" height="114" rx="16" />
                  {innerPanel(
                    "left_lower_arm_inner",
                    "left_arm",
                    severityByRegion,
                    <rect x="62" y="278" width="22" height="98" rx="11" />,
                  )}
                </>,
              )}

              {part(
                "left_hand",
                "left_arm",
                severityByRegion,
                <>
                  <rect x="50" y="386" width="46" height="36" rx="14" />
                  {innerPanel(
                    "left_hand_inner",
                    "left_arm",
                    severityByRegion,
                    <rect x="58" y="394" width="30" height="20" rx="8" />,
                  )}
                </>,
              )}

              {part(
                "right_upper_arm",
                "right_arm",
                severityByRegion,
                <>
                  <rect x="230" y="158" width="34" height="108" rx="16" />
                  {innerPanel(
                    "right_upper_arm_inner",
                    "right_arm",
                    severityByRegion,
                    <rect x="236" y="166" width="22" height="92" rx="11" />,
                  )}
                </>,
              )}

              {part(
                "right_lower_arm",
                "right_arm",
                severityByRegion,
                <>
                  <rect x="230" y="270" width="34" height="114" rx="16" />
                  {innerPanel(
                    "right_lower_arm_inner",
                    "right_arm",
                    severityByRegion,
                    <rect x="236" y="278" width="22" height="98" rx="11" />,
                  )}
                </>,
              )}

              {part(
                "right_hand",
                "right_arm",
                severityByRegion,
                <>
                  <rect x="224" y="386" width="46" height="36" rx="14" />
                  {innerPanel(
                    "right_hand_inner",
                    "right_arm",
                    severityByRegion,
                    <rect x="232" y="394" width="30" height="20" rx="8" />,
                  )}
                </>,
              )}

              {part(
                "left_upper_leg",
                "left_leg",
                severityByRegion,
                <>
                  <rect x="106" y="410" width="44" height="98" rx="18" />
                  {innerPanel(
                    "left_upper_leg_inner",
                    "left_leg",
                    severityByRegion,
                    <rect x="114" y="420" width="28" height="78" rx="12" />,
                  )}
                </>,
              )}

              {part(
                "left_lower_leg",
                "left_leg",
                severityByRegion,
                <>
                  <rect x="106" y="512" width="44" height="82" rx="18" />
                  {innerPanel(
                    "left_lower_leg_inner",
                    "left_leg",
                    severityByRegion,
                    <rect x="114" y="522" width="28" height="62" rx="12" />,
                  )}
                </>,
              )}

              {part(
                "left_foot",
                "left_leg",
                severityByRegion,
                <>
                  <rect x="98" y="588" width="60" height="20" rx="10" />
                  {innerPanel(
                    "left_foot_inner",
                    "left_leg",
                    severityByRegion,
                    <rect x="108" y="592" width="40" height="12" rx="6" />,
                  )}
                </>,
              )}

              {part(
                "right_upper_leg",
                "right_leg",
                severityByRegion,
                <>
                  <rect x="170" y="410" width="44" height="98" rx="18" />
                  {innerPanel(
                    "right_upper_leg_inner",
                    "right_leg",
                    severityByRegion,
                    <rect x="178" y="420" width="28" height="78" rx="12" />,
                  )}
                </>,
              )}

              {part(
                "right_lower_leg",
                "right_leg",
                severityByRegion,
                <>
                  <rect x="170" y="512" width="44" height="82" rx="18" />
                  {innerPanel(
                    "right_lower_leg_inner",
                    "right_leg",
                    severityByRegion,
                    <rect x="178" y="522" width="28" height="62" rx="12" />,
                  )}
                </>,
              )}

              {part(
                "right_foot",
                "right_leg",
                severityByRegion,
                <>
                  <rect x="162" y="588" width="60" height="20" rx="10" />
                  {innerPanel(
                    "right_foot_inner",
                    "right_leg",
                    severityByRegion,
                    <rect x="172" y="592" width="40" height="12" rx="6" />,
                  )}
                </>,
              )}
            </g>

            <line
              x1="160"
              y1="154"
              x2="160"
              y2="404"
              stroke="#ffffff"
              strokeOpacity="0.3"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">Affected areas</div>
          <div className="mt-1 text-xs leading-5 text-slate-600">
            
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {entries.map((entry) => (
              <span
                key={entry.region}
                className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
              >
                {REGION_LABELS[entry.region]}
              </span>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-slate-700">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.35)]" />
              Low
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.35)]" />
              Medium
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.35)]" />
              High
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
