import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientAddress } from './client-address.mjs';
import { config } from './routing.mjs';
test('Fly runtime selects one proxy-owned address, rejects spoofed fallback and keeps previews noindex', () => {
  const env = {
    WEBSITE_ORIGIN: 'https://fixture.fly.dev',
    FLY_APP_NAME: 'fixture',
    FLY_MACHINE_ID: 'fixture-machine',
  };
  assert.equal(config(env).clientAddressSource, 'fly');
  assert.equal(config(env).noindex, true);
  assert.equal(config({ ...env, FLY_MACHINE_ID: '' }).clientAddressSource, 'unavailable');
  const req = {
    headers: {
      'fly-client-ip': '192.0.2.10',
      'cf-connecting-ip': '203.0.113.1',
      'x-forwarded-for': '203.0.113.2',
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
  assert.equal(clientAddress(req, 'fly'), '192.0.2.10');
  delete req.headers['fly-client-ip'];
  assert.equal(clientAddress(req, 'fly'), null);
  req.headers['fly-client-ip'] = '192.0.2.1, 192.0.2.2';
  assert.equal(clientAddress(req, 'fly'), null);
});
