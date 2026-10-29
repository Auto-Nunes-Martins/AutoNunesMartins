<script lang="ts">
  let { preview }: { preview: HTMLCanvasElement } = $props();
  function paint(node: HTMLCanvasElement, source: HTMLCanvasElement) {
    const draw = (source: HTMLCanvasElement) => {
      node.width = source.width; node.height = source.height;
      node.getContext('2d')?.drawImage(source, 0, 0);
    };
    draw(source);
    return { update: draw };
  }
</script>
<canvas use:paint={preview} aria-hidden="true"></canvas>
<style>canvas { display: block; width: 100%; height: 100%; object-fit: cover; }</style>
