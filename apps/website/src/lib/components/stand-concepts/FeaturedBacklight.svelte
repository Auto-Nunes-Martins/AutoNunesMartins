<!-- Approved ray angles; termini extend beyond the radial fade, avoiding a rectangular SVG cutoff. -->
<div class="hd-backlight" aria-hidden="true">
  <svg viewBox="0 0 1000 800" preserveAspectRatio="none" focusable="false">
    <defs>
      <radialGradient id="v5-beam-light" gradientUnits="userSpaceOnUse" cx="500" cy="430" r="570">
        <stop stop-color="#fffef3" stop-opacity=".98" />
        <stop offset=".32967" stop-color="#fffae6" stop-opacity=".92" />
        <stop offset=".68132" stop-color="#f6edcb" stop-opacity=".52" />
        <stop offset="1" stop-color="#ebe8d3" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="v5-source-light">
        <stop stop-color="#fffef5" stop-opacity=".9" />
        <stop offset=".55" stop-color="#faf2d5" stop-opacity=".54" />
        <stop offset="1" stop-color="#f3ebcc" stop-opacity="0" />
      </radialGradient>
      <filter id="v5-beam-softness" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="13" />
      </filter>
    </defs>
    <g fill="url(#v5-beam-light)" filter="url(#v5-beam-softness)">
      <!-- Shorten only ray reach; compensated stops retain the approved bright
           core, while the outer filter retains the same physical softness. -->
      <g transform="translate(500 430) scale(0.91) translate(-500 -430)">
        <!-- The upper shafts leave the label/counter in the gaps between beams. -->
        <path d="M500 430 -180 0 -30 0Z" opacity=".95" />
        <path d="M500 430 237.293 -164.546 774.125 -159.369Z" opacity=".9" />
        <path d="M500 430 1000 0 1280 0Z" />
        <path d="M500 430 -101.414 183.42 -148.413 475.389Z" opacity=".8" />
        <path d="M500 430 1122.587 243.224 1111.577 650.168Z" opacity=".9" />
        <path d="M500 430 928.962 918.356 1022.497 816.648Z" opacity=".22" />
      </g>
    </g>
    <ellipse cx="500" cy="430" rx="365" ry="255" fill="url(#v5-source-light)" />
  </svg>
</div>
