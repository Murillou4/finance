<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart as ChartJS, ArcElement, Tooltip, Legend, DoughnutController } from 'chart.js';

  ChartJS.register(ArcElement, Tooltip, Legend, DoughnutController);

  interface CategoryData {
    name: string;
    color: string;
    spent: number;
    percentage: number;
  }

  let { categories }: { categories: CategoryData[] } = $props();

  let canvas = $state<HTMLCanvasElement>();
  let chart: ChartJS | null = null;

  function buildChart() {
    if (chart) chart.destroy();
    if (!canvas || categories.length === 0) return;

    chart = new ChartJS(canvas, {
      type: 'doughnut',
      data: {
        labels: categories.map((c) => c.name),
        datasets: [
          {
            data: categories.map((c) => c.spent),
            backgroundColor: categories.map((c) => c.color),
            borderWidth: 3,
            borderColor: '#fff',
            hoverBorderWidth: 2,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 8,
              font: { size: 11, family: 'Inter', weight: 500 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { family: 'Inter', size: 12, weight: 600 },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            boxPadding: 4,
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                const total = categories.reduce((s, c) => s + c.spent, 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: R$ ${val.toFixed(2)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  onMount(() => {
    buildChart();
  });

  $effect(() => {
    categories;
    if (canvas) buildChart();
  });
</script>

{#if categories.length === 0}
  <div class="chart-empty">
    <span class="chart-empty-icon">--</span>
    <p>Nenhum gasto registrado</p>
  </div>
{:else}
  <canvas bind:this={canvas} style="max-height: 220px;"></canvas>
{/if}

<style>
  .chart-empty {
    text-align: center;
    color: var(--text-muted, #94a3b8);
    font-size: 0.85rem;
    padding: 32px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .chart-empty-icon {
    font-size: 1.5rem;
    opacity: 0.4;
  }
</style>
