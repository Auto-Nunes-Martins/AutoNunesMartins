import v3d0 from '$lib/assets/images/hero-directions/pine-bends-1280.webp?url&no-inline';
import v3d1 from '$lib/assets/images/hero-directions/pine-bends-1920.webp?url&no-inline';
import v3d2 from '$lib/assets/images/hero-directions/pine-bends-2560.webp?url&no-inline';
import v3d3 from '$lib/assets/images/hero-directions/pine-bends-3840.webp?url&no-inline';
import v3d4 from '$lib/assets/images/hero-directions/pine-bends-5760.webp?url&no-inline';
import v3p0 from '$lib/assets/images/hero-directions/pine-bends-portrait-640.webp?url&no-inline';
import v3p1 from '$lib/assets/images/hero-directions/pine-bends-portrait-1080.webp?url&no-inline';
import v3p2 from '$lib/assets/images/hero-directions/pine-bends-portrait-1920.webp?url&no-inline';
import v4d0 from '$lib/assets/images/hero-directions/green-serpentine-1280.webp?url&no-inline';
import v4d1 from '$lib/assets/images/hero-directions/green-serpentine-1920.webp?url&no-inline';
import v4d2 from '$lib/assets/images/hero-directions/green-serpentine-2560.webp?url&no-inline';
import v4d3 from '$lib/assets/images/hero-directions/green-serpentine-3840.webp?url&no-inline';
import v4d4 from '$lib/assets/images/hero-directions/green-serpentine-5472.webp?url&no-inline';
import v4p0 from '$lib/assets/images/hero-directions/green-serpentine-portrait-640.webp?url&no-inline';
import v4p1 from '$lib/assets/images/hero-directions/green-serpentine-portrait-1080.webp?url&no-inline';
import v4p2 from '$lib/assets/images/hero-directions/green-serpentine-portrait-1920.webp?url&no-inline';
import v5d0 from '$lib/assets/images/hero-directions/forest-ribbon-1280.webp?url&no-inline';
import v5d1 from '$lib/assets/images/hero-directions/forest-ribbon-1920.webp?url&no-inline';
import v5d2 from '$lib/assets/images/hero-directions/forest-ribbon-2560.webp?url&no-inline';
import v5d3 from '$lib/assets/images/hero-directions/forest-ribbon-3840.webp?url&no-inline';
import v5d4 from '$lib/assets/images/hero-directions/forest-ribbon-5472.webp?url&no-inline';
import v5p0 from '$lib/assets/images/hero-directions/forest-ribbon-portrait-640.webp?url&no-inline';
import v5p1 from '$lib/assets/images/hero-directions/forest-ribbon-portrait-1080.webp?url&no-inline';
import v5p2 from '$lib/assets/images/hero-directions/forest-ribbon-portrait-1920.webp?url&no-inline';
import v6d0 from '$lib/assets/images/hero-directions/woodland-curves-1280.webp?url&no-inline';
import v6d1 from '$lib/assets/images/hero-directions/woodland-curves-1920.webp?url&no-inline';
import v6d2 from '$lib/assets/images/hero-directions/woodland-curves-2560.webp?url&no-inline';
import v6d3 from '$lib/assets/images/hero-directions/woodland-curves-3840.webp?url&no-inline';
import v6d4 from '$lib/assets/images/hero-directions/woodland-curves-4150.webp?url&no-inline';
import v6p0 from '$lib/assets/images/hero-directions/woodland-curves-portrait-640.webp?url&no-inline';
import v6p1 from '$lib/assets/images/hero-directions/woodland-curves-portrait-1080.webp?url&no-inline';
import v6p2 from '$lib/assets/images/hero-directions/woodland-curves-portrait-1920.webp?url&no-inline';
import v7d0 from '$lib/assets/images/hero-directions/green-trail-1280.webp?url&no-inline';
import v7d1 from '$lib/assets/images/hero-directions/green-trail-1920.webp?url&no-inline';
import v7d2 from '$lib/assets/images/hero-directions/green-trail-2560.webp?url&no-inline';
import v7d3 from '$lib/assets/images/hero-directions/green-trail-3000.webp?url&no-inline';
import v7p0 from '$lib/assets/images/hero-directions/green-trail-portrait-640.webp?url&no-inline';
import v7p1 from '$lib/assets/images/hero-directions/green-trail-portrait-1080.webp?url&no-inline';
import v7p2 from '$lib/assets/images/hero-directions/green-trail-portrait-1920.webp?url&no-inline';

export const heroBackgrounds: Record<
  number,
  {
    src: string;
    desktop: string;
    portrait: string;
    width: number;
    height: number;
    focus: string;
    mobileFocus: string;
  }
> = {
  3: {
    src: v3d4,
    desktop: `${v3d0} 1280w, ${v3d1} 1920w, ${v3d2} 2560w, ${v3d3} 3840w, ${v3d4} 5760w`,
    portrait: `${v3p0} 640w, ${v3p1} 1080w, ${v3p2} 1920w`,
    width: 8064,
    height: 4536,
    focus: '50% 65%',
    mobileFocus: '50% 50%',
  },
  4: {
    src: v4d4,
    desktop: `${v4d0} 1280w, ${v4d1} 1920w, ${v4d2} 2560w, ${v4d3} 3840w, ${v4d4} 5472w`,
    portrait: `${v4p0} 640w, ${v4p1} 1080w, ${v4p2} 1920w`,
    width: 5472,
    height: 3648,
    focus: '50% 60%',
    mobileFocus: '50% 50%',
  },
  5: {
    src: v5d4,
    desktop: `${v5d0} 1280w, ${v5d1} 1920w, ${v5d2} 2560w, ${v5d3} 3840w, ${v5d4} 5472w`,
    portrait: `${v5p0} 640w, ${v5p1} 1080w, ${v5p2} 1920w`,
    width: 5472,
    height: 3648,
    focus: '50% 70%',
    mobileFocus: '50% 50%',
  },
  6: {
    src: v6d4,
    desktop: `${v6d0} 1280w, ${v6d1} 1920w, ${v6d2} 2560w, ${v6d3} 3840w, ${v6d4} 4150w`,
    portrait: `${v6p0} 640w, ${v6p1} 1080w, ${v6p2} 1920w`,
    width: 4150,
    height: 3320,
    focus: '50% 65%',
    mobileFocus: '50% 50%',
  },
  7: {
    src: v7d3,
    desktop: `${v7d0} 1280w, ${v7d1} 1920w, ${v7d2} 2560w, ${v7d3} 3000w`,
    portrait: `${v7p0} 640w, ${v7p1} 1080w, ${v7p2} 1920w`,
    width: 3000,
    height: 4000,
    focus: '50% 0%',
    mobileFocus: '0% 50%',
  },
};
