import { useState } from "react";
import { cn } from "cn";
import type { RadarAxis } from "@/shared/schemas/skills";

interface SkillRadarChartProps {
  axes: RadarAxis[];
  size?: number;
  activeSlug?: string | null;
  onSelectAxis?: (slug: string) => void;
  className?: string;
  showLabels?: boolean;
}

export function SkillRadarChart({
  axes,
  size = 380,
  activeSlug,
  onSelectAxis,
  className,
  showLabels = true,
}: SkillRadarChartProps) {
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  if (axes.length < 3) {
    return (
      <div className="flex size-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Radar requires at least 3 skill dimensions.
      </div>
    );
  }

  const center = 200;
  const radius = showLabels ? 120 : 160;
  const levels = [1, 2, 3, 4, 5];
  const angleStep = (Math.PI * 2) / axes.length;

  const getCoordinates = (index: number, val: number, customRadius?: number) => {
    const r = ((val / 5) * (customRadius ?? radius));
    const angle = index * angleStep - Math.PI / 2;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const polygonPoints = axes
    .map((axis, i) => {
      const { x, y } = getCoordinates(i, Math.max(0.2, axis.score));
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className={cn("relative flex items-center justify-center select-none", className)}>
      <svg
        viewBox="0 0 400 400"
        width={size}
        height={size}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.15" />
          </linearGradient>
          <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Concentric Polygonal Background Grids (Levels 1 to 5) */}
        {levels.map((lvl) => {
          const gridPoints = axes
            .map((_, i) => {
              const { x, y } = getCoordinates(i, lvl);
              return `${x},${y}`;
            })
            .join(" ");

          return (
            <g key={lvl}>
              <polygon
                points={gridPoints}
                className={cn(
                  "fill-none transition-colors",
                  lvl === 5
                    ? "stroke-border/70 stroke-[1.5]"
                    : "stroke-border/30 stroke-1 stroke-dashed",
                )}
                strokeDasharray={lvl === 5 ? "none" : "3,3"}
              />
              <text
                x={center + 4}
                y={center - (lvl / 5) * radius + 3}
                className="fill-muted-foreground/50 text-[9px] font-mono select-none"
              >
                L{lvl}
              </text>
            </g>
          );
        })}

        {/* Radial Axis Spokes & Labels */}
        {axes.map((axis, i) => {
          const outer = getCoordinates(i, 5);
          const labelDist = radius + 30;
          const labelPos = getCoordinates(i, 5, labelDist);
          const isHighlighted =
            hoveredSlug === axis.slug || activeSlug === axis.slug;

          return (
            <g
              key={axis.slug}
              className="cursor-pointer group"
              onClick={() => onSelectAxis?.(axis.slug)}
              onMouseEnter={() => setHoveredSlug(axis.slug)}
              onMouseLeave={() => setHoveredSlug(null)}
            >
              <line
                x1={center}
                y1={center}
                x2={outer.x}
                y2={outer.y}
                className={cn(
                  "transition-colors",
                  isHighlighted ? "stroke-primary stroke-2" : "stroke-border/40 stroke-1",
                )}
              />

              {showLabels && (
                <g transform={`translate(${labelPos.x}, ${labelPos.y})`}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={cn(
                      "text-[11px] font-medium transition-all",
                      isHighlighted
                        ? "fill-primary font-semibold text-xs scale-105"
                        : "fill-muted-foreground",
                    )}
                  >
                    {axis.name}
                  </text>
                  <text
                    y={13}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[10px] font-mono fill-muted-foreground/70"
                  >
                    L{axis.score.toFixed(1)} ({axis.evidencesCount} proof)
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Filled Polygon representing user's mastery */}
        <polygon
          points={polygonPoints}
          fill="url(#radarGradient)"
          className="stroke-primary stroke-2 transition-all duration-300 drop-shadow-sm"
        />

        {/* Interactive Data Vertices */}
        {axes.map((axis, i) => {
          const pt = getCoordinates(i, Math.max(0.2, axis.score));
          const isHighlighted =
            hoveredSlug === axis.slug || activeSlug === axis.slug;

          return (
            <circle
              key={`pt-${axis.slug}`}
              cx={pt.x}
              cy={pt.y}
              r={isHighlighted ? 6 : 4}
              className={cn(
                "fill-primary stroke-background stroke-2 transition-all cursor-pointer",
                isHighlighted && "filter-[url(#radarGlow)] scale-125",
              )}
              onClick={() => onSelectAxis?.(axis.slug)}
              onMouseEnter={() => setHoveredSlug(axis.slug)}
              onMouseLeave={() => setHoveredSlug(null)}
            />
          );
        })}
      </svg>
    </div>
  );
}

