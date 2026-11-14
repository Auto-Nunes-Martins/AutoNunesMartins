import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

// Synthetic local fixture only. No personal browser, CRM writes or screenshots.
export async function mobileCampaignEffects(browser, origin) {
  for (const width of [390, 700, 701, 1440]) {
    const mobile = width <= 700;
    const page = await browser.newPage({ viewport: { width, height: 950 }, isMobile: mobile, hasTouch: mobile });
    page.setDefaultTimeout(15000);
    try {
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(origin);
      await page.locator('.design.motion-on').waitFor();
      const photo = page.locator('.hd-photo');
      await expect(photo).toBeVisible();
      // SSR/motion marker precedes hydration; wait for the swipe action itself.
      await page.waitForFunction(() => !!document.querySelector('.hd-photo-stage')?.style.touchAction);
      const hiddenDecor = async () => {
        await expect(page.locator('.hd-feature-light')).toBeHidden();
        assert.equal(await page.locator('.hd-caption-stack').evaluate(n => getComputedStyle(n, '::before').display), 'none');
      };
      if (mobile) {
        await hiddenDecor();
        const before = await photo.getAttribute('href');
        // The action uses Touch Events on mobile (including WebKit), not pointer events.
        const rect = await photo.boundingBox();
        const touch = async (type, x) => photo.evaluate((node, {type,x,y}) => {
          const point = new Touch({ identifier: 1, target: node, clientX:x, clientY:y });
          node.dispatchEvent(new TouchEvent(type, {bubbles:true, cancelable:true, touches:type==='touchend'?[]:[point], changedTouches:[point]}));
        }, {type,x,y:rect.y+rect.height/2});
        await touch('touchstart', rect.x + rect.width * .8);
        await page.waitForTimeout(650);
        await hiddenDecor();
        await touch('touchmove', rect.x + rect.width * .2);
        await touch('touchend', rect.x + rect.width * .2);
        await expect(photo).not.toHaveAttribute('href', before);
        await hiddenDecor();
        await photo.focus();
        await hiddenDecor();
      } else {
        // The approved desktop idle float intentionally never becomes stationary.
        await photo.hover({ force: true });
        await expect(page.locator('.hd-backlight')).toHaveCSS('opacity', '0.35');
        assert.notEqual(await page.locator('.hd-feature-light').evaluate(n => getComputedStyle(n).display), 'none');
      }
      const campaign = page.locator('#campanhas');
      await campaign.scrollIntoViewIfNeeded();
      const ticker = campaign.locator('.ticker-group').first();
      assert.equal(await ticker.locator('.lucide-arrow-up-right').count(), 8);
      assert.equal(await ticker.locator('svg.ticker-dot').count(), 16);
      assert.ok(!(await ticker.textContent()).includes('✳'));
      assert.equal(await ticker.locator('svg.ticker-dot').first().getAttribute('viewBox'), '0 0 16 16');
      const top = await campaign.locator('h2').evaluate(n => n.getBoundingClientRect().top + scrollY);
      const poses = [];
      for (const fraction of [.85, .65, .45, .25, .05, -.1]) {
        await page.evaluate(({top, fraction}) => scrollTo({top: Math.max(0, top - innerHeight * fraction), behavior:'instant'}), {top,fraction});
        await page.waitForTimeout(140);
        poses.push(await campaign.locator('h2').evaluate(n => Number(n.style.getPropertyValue('--line-progress'))));
      }
      assert.ok(poses[0] < poses[2] && poses[2] < poses[4]);
      if (mobile) {
        await expect(campaign.locator('.line-window')).toHaveCSS('opacity', '0');
        await expect(campaign.locator('.line-window')).toHaveCSS('filter', 'none');
        await expect(campaign.locator('h2')).toHaveCSS('--accent-light', '0');
        await expect(campaign.locator('em')).toHaveCSS('text-decoration-line', 'none');
        assert.equal(await campaign.locator('em').evaluate(n => getComputedStyle(n,'::after').content), 'none');
      }
      await page.evaluate(() => scrollTo({top:0,behavior:'instant'}));
      await page.waitForTimeout(180);
      if (mobile) await expect(campaign.locator('.line-window')).toHaveCSS('opacity', '0');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(campaign.locator('.line-window')).toBeHidden();
      console.log(`Effects: ${width}px swipe/hover, ticker SVG, scroll endpoints and reduced motion passed.`);
    } finally { await page.close(); }
  }
}
