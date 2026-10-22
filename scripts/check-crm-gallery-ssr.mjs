// Run after building apps/crm. Verify the actual generated HTML, not source text.
import assert from 'node:assert/strict';
import { render } from 'svelte/server';
import { P as PhotoGallery } from '../apps/crm/.svelte-kit/output/server/chunks/PhotoGallery.js';

const { body } = render(PhotoGallery, {
  props: {
    vehicleId: 'fixture', editable: false,
    photos: [{
      path: 'fixture/a.jpg', url: 'https://fixture.test/original.jpg', width: 2400, height: 1600,
      variants: [
        { width: 320, height: 213, url: 'https://fixture.test/320.webp' },
        { width: 1600, height: 1067, url: 'https://fixture.test/1600.webp' },
      ],
    }],
  },
});
const dialog = body.match(/<dialog\b[\s\S]*?<\/dialog>/)?.[0];
assert.ok(dialog, 'Gallery viewer must exist');
assert.ok(!dialog.includes('<img'), 'Closed viewer must not request a full-size photo');
assert.ok(body.includes('Ampliar fotografia'), 'Preview must remain available before opening the viewer');
assert.ok(body.includes('src="https://fixture.test/1600.webp"'), 'Main preview must use a responsive variant');
console.log('Gallery SSR passed: responsive preview available; closed viewer has no image.');
