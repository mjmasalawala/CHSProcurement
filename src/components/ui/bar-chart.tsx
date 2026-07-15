interface BarChartSeries {
  label: string;
  color: string;
  values: number[];
}

interface BarChartProps {
  weekLabels: string[];
  series: BarChartSeries[];
  height?: number;
}

// Small-integer-friendly axis: 4 gridlines above 0, stepping by whole
// numbers — count data (weekly totals) rarely needs fractional ticks.
function computeYAxis(max: number, tickCount = 4): { niceMax: number; ticks: number[] } {
  if (max <= 0) return { niceMax: 1, ticks: [0, 1] };
  if (max <= tickCount) {
    return { niceMax: max, ticks: Array.from({ length: max + 1 }, (_, i) => i) };
  }
  const step = Math.ceil(max / tickCount);
  const niceMax = step * tickCount;
  return { niceMax, ticks: Array.from({ length: tickCount + 1 }, (_, i) => i * step) };
}

/**
 * Minimal grouped-bar SVG chart — no charting library dependency. Renders
 * server-side (no interactivity beyond native <title> hover tooltips), which
 * is enough for the admin dashboard's weekly trend charts. Stretches to the
 * container's width (viewBox + preserveAspectRatio="none") instead of
 * scrolling horizontally.
 */
export function BarChart({ weekLabels, series, height = 200 }: BarChartProps) {
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const { niceMax, ticks } = computeYAxis(max);

  const leftMargin = 28;
  const groupWidth = 70;
  const plotWidth = weekLabels.length * groupWidth;
  const totalWidth = leftMargin + plotWidth;
  const chartHeight = height - 24;
  const barWidth = Math.min(26, (groupWidth - 12) / series.length);

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label="Weekly trend chart"
      >
        {ticks.map((tick) => {
          const y = chartHeight - (tick / niceMax) * chartHeight;
          return (
            <g key={tick}>
              <line
                x1={leftMargin}
                x2={totalWidth}
                y1={y}
                y2={y}
                stroke="var(--color-border-subtle)"
                strokeWidth={1}
              />
              <text x={leftMargin - 6} y={y + 3} textAnchor="end" fontSize={10} fill="var(--color-text-tertiary)">
                {tick}
              </text>
            </g>
          );
        })}

        {weekLabels.map((label, weekIdx) => (
          <g key={label} transform={`translate(${leftMargin + weekIdx * groupWidth}, 0)`}>
            {series.map((s, seriesIdx) => {
              const value = s.values[weekIdx] ?? 0;
              const barHeight = (value / niceMax) * chartHeight;
              return (
                <rect
                  key={s.label}
                  x={6 + seriesIdx * barWidth}
                  y={chartHeight - barHeight}
                  width={barWidth - 4}
                  height={barHeight}
                  rx={3}
                  fill={s.color}
                >
                  <title>{`${s.label} · week of ${label}: ${value}`}</title>
                </rect>
              );
            })}
            <text
              x={groupWidth / 2}
              y={chartHeight + 16}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-text-tertiary)"
            >
              {label}
            </text>
          </g>
        ))}
      </svg>

      <div className="flex flex-wrap gap-4">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[13px] text-text-secondary">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
