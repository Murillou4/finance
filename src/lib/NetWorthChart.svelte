<script lang="ts">
  import type { NetWorthPoint } from "$lib/client/finance-metrics";

  interface Props {
    points: NetWorthPoint[];
    height?: number;
    variant?: "spark" | "full";
  }

  let { points, height = 60, variant = "spark" }: Props = $props();

  let svgPath = $derived(buildPath(points));
  let svgArea = $derived(buildArea(points));
  let last = $derived(points[points.length - 1] ?? null);
  let first = $derived(points[0] ?? null);
  let totalGrowth = $derived(last && first ? last.cumulativeNet - first.cumulativeNet : 0);

  function fmt(value: number): string {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function buildPath(pts: NetWorthPoint[]) {
    if (pts.length === 0) return "";
    const range = computeRange(pts);
    return pts
      .map((point, i) => {
        const x = (i / Math.max(1, pts.length - 1)) * 100;
        const y = scaleY(point.cumulativeNet, range);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }

  function buildArea(pts: NetWorthPoint[]) {
    if (pts.length === 0) return "";
    const path = buildPath(pts);
    return `${path} L100 100 L0 100 Z`;
  }

  function computeRange(pts: NetWorthPoint[]) {
    const values = pts.map((p) => p.cumulativeNet);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    if (min === max) return { min: min - 1, max: max + 1 };
    return { min, max };
  }

  function scaleY(value: number, range: { min: number; max: number }) {
    const span = range.max - range.min || 1;
    const ratio = (value - range.min) / span;
    return 100 - ratio * 100;
  }
</script>

<div class="net-worth" class:net-worth-full={variant === "full"}>
  {#if variant === "full"}
    <div class="header">
      <span class="label">Patrimônio acumulado (12m)</span>
      {#if last}
        <span class="value mono" class:positive={last.cumulativeNet >= 0} class:negative={last.cumulativeNet < 0}>
          {fmt(last.cumulativeNet)}
        </span>
      {/if}
    </div>
  {/if}
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="height: {height}px;">
    <defs>
      <linearGradient id="nw-grad" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="var(--success)" stop-opacity="0.3" />
        <stop offset="100%" stop-color="var(--success)" stop-opacity="0" />
      </linearGradient>
    </defs>
    {#if svgArea}
      <path d={svgArea} fill="url(#nw-grad)" />
      <path d={svgPath} fill="none" stroke="var(--success)" stroke-width="1.6" vector-effect="non-scaling-stroke" />
    {/if}
  </svg>
  {#if variant === "full" && points.length > 0}
    <div class="footer">
      <div class="endpoints">
        <span>{points[0]?.label ?? "—"}</span>
        <span>{last?.label ?? "—"}</span>
      </div>
      <div class="growth" class:positive={totalGrowth >= 0} class:negative={totalGrowth < 0}>
        {totalGrowth >= 0 ? "↑" : "↓"} {fmt(Math.abs(totalGrowth))} no período
      </div>
    </div>
  {/if}
</div>

<style>
  .net-worth {
    width: 100%;
  }
  .net-worth-full {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 18px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    color: var(--text-muted);
  }
  .value {
    font-size: 1.1rem;
    font-weight: 700;
  }
  svg {
    display: block;
    width: 100%;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.74rem;
  }
  .endpoints {
    display: flex;
    gap: 8px;
    color: var(--text-muted);
  }
  .endpoints span:first-child::after {
    content: "→";
    margin-left: 8px;
    opacity: 0.5;
  }
  .growth {
    font-weight: 600;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .positive { color: var(--success); }
  .negative { color: var(--danger); }
</style>
