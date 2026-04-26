<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    open: boolean;
    title: string;
    onClose: () => void;
    size?: "sm" | "md" | "lg";
    children: Snippet;
  }

  let { open, title, onClose, size = "md", children }: Props = $props();

  function handleKey(event: KeyboardEvent) {
    if (event.key === "Escape") onClose();
  }
</script>

<svelte:window onkeydown={handleKey} />

{#if open}
  <div class="modal-overlay" onclick={onClose} role="presentation">
    <div
      class="modal modal-{size}"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabindex="-1"
    >
      <div class="modal-header">
        <span>{title}</span>
        <button
          type="button"
          class="btn-icon"
          aria-label="Fechar"
          onclick={onClose}>✕</button
        >
      </div>
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .modal-sm {
    max-width: 420px;
  }
  .modal-md {
    max-width: 560px;
  }
  .modal-lg {
    max-width: 720px;
  }
</style>
