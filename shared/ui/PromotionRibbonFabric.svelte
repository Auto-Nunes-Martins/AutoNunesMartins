<script lang="ts">
  const id = $props.id();
</script>

<svg class="ribbon-fabric" viewBox="0 0 220 44" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <filter
      id={`ribbon-cloth-${id}`}
      x="-5%"
      y="-15%"
      width="110%"
      height="130%"
      color-interpolation-filters="sRGB"
    >
      <!-- Long, shallow variations form fabric relief; the light follows their normals. -->
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.009 0.065"
        numOctaves="1"
        seed="7"
        result="relief"
      />
      <feGaussianBlur in="relief" stdDeviation="2 0.8" result="soft-relief" />
      <feOffset in="soft-relief" dy="-5" result="placed-relief" />
      <feDiffuseLighting
        in="placed-relief"
        surfaceScale="6"
        diffuseConstant="1.2"
        lighting-color="#fff"
        result="diffuse"
      >
        <feDistantLight azimuth="240" elevation="45" />
      </feDiffuseLighting>
      <feComposite
        in="SourceGraphic"
        in2="diffuse"
        operator="arithmetic"
        k1="1"
        k2="0"
        k3="0"
        k4="0"
        result="matte"
      />
      <feSpecularLighting
        in="placed-relief"
        surfaceScale="6"
        specularConstant="0.07"
        specularExponent="10"
        lighting-color="#ffded5"
        result="light"
      >
        <feDistantLight azimuth="240" elevation="45" />
      </feSpecularLighting>
      <feComposite in="light" in2="SourceAlpha" operator="in" result="soft-light" />
      <feBlend in="matte" in2="soft-light" mode="screen" result="fabric" />
      <feComposite in="fabric" in2="SourceAlpha" operator="in" />
    </filter>
    <radialGradient
      id={`ribbon-print-zone-${id}`}
      gradientUnits="userSpaceOnUse"
      cx="110"
      cy="22"
      r="66"
      gradientTransform="translate(0 14.3) scale(1 0.35)"
    >
      <stop stop-color="#777" />
      <stop offset="0.5" stop-color="#999" />
      <stop offset="1" stop-color="#fff" />
    </radialGradient>
    <mask
      id={`ribbon-print-mask-${id}`}
      maskUnits="userSpaceOnUse"
      x="0"
      y="0"
      width="220"
      height="44"
    >
      <rect width="220" height="44" fill={`url(#ribbon-print-zone-${id})`} />
    </mask>
  </defs>
  <path d="M0 4C45 2 72 6 110 7S178 3 220 5V39C176 37 151 42 110 41S49 36 0 38Z" fill="#d20b20" />
  <path
    d="M0 4C45 2 72 6 110 7S178 3 220 5V39C176 37 151 42 110 41S49 36 0 38Z"
    fill="#f00b22"
    filter={`url(#ribbon-cloth-${id})`}
    mask={`url(#ribbon-print-mask-${id})`}
  />
  <path
    d="M0 5C45 3 72 7 110 8S178 4 220 6"
    fill="none"
    stroke="#ffb5ad"
    stroke-opacity="0.15"
    stroke-width="0.6"
  />
</svg>

<style>
  .ribbon-fabric {
    position: absolute;
    inset: -4px 0;
    width: 100%;
    height: calc(100% + 8px);
    overflow: visible;
    filter: drop-shadow(0 2px 1px #3100083b) drop-shadow(0 5px 4px #00000024);
  }
</style>
