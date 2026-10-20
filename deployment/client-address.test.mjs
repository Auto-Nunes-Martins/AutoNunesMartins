import test from 'node:test';
import assert from 'node:assert/strict';
import { clientAddress, normaliseAddress } from './client-address.mjs';
import { config } from './routing.mjs';

test('trust source is runtime Render flag, never hostname or request headers', () => {
  const env = { WEBSITE_ORIGIN: 'https://fixture.onrender.com' };
  assert.equal(config(env).clientAddressSource, 'socket');
  assert.equal(config({ ...env, RENDER: 'true', RENDER_SERVICE_TYPE: 'web' }).clientAddressSource, 'render');
  assert.equal(config({ ...env, RENDER: 'true' }).clientAddressSource, 'unavailable');
  assert.equal(config({ ...env, RENDER: 'true', RENDER_SERVICE_TYPE: 'pserv' }).clientAddressSource, 'unavailable');
  const req = { headers: { 'cf-connecting-ip': '192.0.2.1', 'x-forwarded-for': '203.0.113.1' },
    socket: { remoteAddress: '::ffff:127.0.0.1' } };
  assert.equal(clientAddress(req, 'socket'), '127.0.0.1');
  assert.equal(clientAddress(req, 'render'), '192.0.2.1');
  assert.equal(clientAddress(req, 'unavailable'), null);
  delete req.headers['cf-connecting-ip'];
  assert.equal(clientAddress(req, 'render'), null);
});

test('canonical single IPv4/IPv6 addresses; reject chains, ports and zones', () => {
  assert.equal(normaliseAddress('::ffff:c000:201'), '192.0.2.1');
  assert.equal(normaliseAddress('::ffff:192.0.2.1'), '192.0.2.1');
  assert.equal(normaliseAddress('2001:0DB8:0000:0000:0000:0000:0000:0001'), '2001:db8::1');
  for (const value of [undefined, ['192.0.2.1'], '', ' 192.0.2.1', '192.0.2.1:443',
    '192.0.2.1, 192.0.2.2', 'fe80::1%eth0', 'invalid', '999.0.0.1']) {
    assert.equal(normaliseAddress(value), null);
  }
});
