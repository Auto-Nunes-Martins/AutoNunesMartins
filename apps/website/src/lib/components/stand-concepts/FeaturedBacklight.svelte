<!-- Directional light shafts: individual feathered beams, without an ambient halo. -->
<div class="hd-backlight" aria-hidden="true">
  <svg viewBox="0 0 1000 800" preserveAspectRatio="none" focusable="false">
    <defs>
      <linearGradient id="featured-ray-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="-520">
        <stop stop-color="#fffefa" stop-opacity="0" />
        <stop offset=".22" stop-color="#fffefa" stop-opacity=".9" />
        <stop offset=".43" stop-color="#f4f6ef" stop-opacity=".76" />
        <stop offset=".68" stop-color="#e4ebe0" stop-opacity=".3" />
        <stop offset=".94" stop-color="#dce6d9" stop-opacity="0" />
      </linearGradient>
      <path id="featured-ray-shape" d="M-8 0 C-12 -110 -30 -250 -68 -520 L68 -520 C30 -250 12 -110 8 0Z" />
      <filter id="featured-ray-feather" x="-60%" y="-10%" width="220%" height="120%" color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="9" />
      </filter>
    </defs>
    <g transform="translate(500 400)" fill="url(#featured-ray-fade)" filter="url(#featured-ray-feather)">
      <use href="#featured-ray-shape" transform="rotate(-78) scale(.8 1.2)" opacity=".7" />
      <use href="#featured-ray-shape" transform="rotate(-48) scale(.7 1.08)" opacity=".82" />
      <use href="#featured-ray-shape" transform="rotate(-18) scale(.8 .96)" opacity=".95" />
      <use href="#featured-ray-shape" transform="rotate(17) scale(.6 1.04)" opacity=".85" />
      <use href="#featured-ray-shape" transform="rotate(48) scale(.85 1.08)" opacity=".78" />
      <use href="#featured-ray-shape" transform="rotate(79) scale(.65 1.2)" opacity=".62" />
      <use href="#featured-ray-shape" transform="rotate(137) scale(.65 .9)" opacity=".25" />
    </g>
  </svg>
</div>
