import v13_640_webp from './assets/service-banner-comparison/version-13-640.webp?url&no-inline';
import v13_640_avif from './assets/service-banner-comparison/version-13-640.avif?url&no-inline';
import v13_1080_webp from './assets/service-banner-comparison/version-13-1080.webp?url&no-inline';
import v13_1080_avif from './assets/service-banner-comparison/version-13-1080.avif?url&no-inline';
import v13_1536_webp from './assets/service-banner-comparison/version-13-1536.webp?url&no-inline';
import v13_1536_avif from './assets/service-banner-comparison/version-13-1536.avif?url&no-inline';

/** Owner-selected services banner, version 13. */
export const serviceBannerImage = {
  src: v13_1536_webp,
  srcset: `${v13_640_webp} 640w, ${v13_1080_webp} 1080w, ${v13_1536_webp} 1536w`,
  avif: `${v13_640_avif} 640w, ${v13_1080_avif} 1080w, ${v13_1536_avif} 1536w`,
  width: 1536,
  height: 1024,
  mobileFocus: '50% 50%',
} as const;
