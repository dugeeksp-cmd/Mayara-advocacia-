import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildClientTokenRelativeHref,
  buildClientTokenUrl,
  cleanPortalPathname,
  resolveInitialPortalRoute,
  resolvePortalBaseUrl,
} from './portalUrl.ts';

test('cleanPortalPathname strips index.html, query/hash, and preserves /portal/', () => {
  assert.equal(cleanPortalPathname('/portal/'), '/portal/');
  assert.equal(cleanPortalPathname('/portal'), '/portal/');
  assert.equal(cleanPortalPathname('/portal/index.html'), '/portal/');
  assert.equal(cleanPortalPathname('/portal/?area=cliente'), '/portal/');
  assert.equal(cleanPortalPathname('/index.html'), '/');
  assert.equal(cleanPortalPathname('/'), '/');
});

test('resolvePortalBaseUrl and buildClientTokenUrl preserve /portal/ subpath', () => {
  assert.equal(
    resolvePortalBaseUrl({
      origin: 'https://my.sabermidia.com.br',
      pathname: '/portal/index.html',
    }),
    'https://my.sabermidia.com.br/portal/'
  );

  assert.equal(
    buildClientTokenUrl('mm_abc123', {
      origin: 'https://my.sabermidia.com.br',
      pathname: '/portal/',
    }),
    'https://my.sabermidia.com.br/portal/?token=mm_abc123'
  );

  assert.equal(
    buildClientTokenUrl('mm_abc123', 'https://my.sabermidia.com.br/portal'),
    'https://my.sabermidia.com.br/portal/?token=mm_abc123'
  );

  assert.equal(buildClientTokenRelativeHref('mm_abc123'), './?token=mm_abc123');
});

test('resolveInitialPortalRoute resolves token, ?area=cliente, ?area=admin, and default home', () => {
  assert.deepEqual(resolveInitialPortalRoute('?token=mm_xyz'), {
    initialToken: 'mm_xyz',
    initialView: 'client',
  });
  assert.deepEqual(resolveInitialPortalRoute('?area=cliente'), {
    initialToken: '',
    initialView: 'client',
  });
  assert.deepEqual(resolveInitialPortalRoute('?area=admin'), {
    initialToken: '',
    initialView: 'admin-auth',
  });
  assert.deepEqual(resolveInitialPortalRoute(''), {
    initialToken: '',
    initialView: 'home',
  });
});
