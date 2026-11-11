// Ensures Bizlano's public surfaces identify Global Webstores as the parent brand.
// This is a marketing navigation link, not an integration dependency or a Timi referral.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const gws='https://www.globalwebstores.com/explore';
const logo='https://www.globalwebstores.com/brand/global-webstores-full.png';

test('marketing homepage displays the official parent logo with an Explore link',()=>{
  const html=source('platform/worker/landing.html');
  assert.match(html,/A Global Webstores brand/);
  assert.match(html,/Powered by Global Webstores/);
  assert.ok(html.includes(gws));
  assert.ok(html.includes(logo));
  assert.match(html,/footer-parent-mark/);
});

test('customer receipt portal co-branding remains separate from receipt contents',()=>{
  const html=source('platform/worker/customer.html');
  assert.match(html,/Powered by Global Webstores/);
  assert.ok(html.includes(logo));
  assert.ok(html.includes(gws));
});

test('authenticated business workspace footer and sign-in show the parent brand',()=>{
  const html=source('platform/worker/index.html');
  const client=source('platform/worker/client.js');
  assert.match(html,/footer-parent-logo/);
  assert.match(client,/Powered by Global Webstores/);
  assert.match(client,/A Global Webstores brand/);
  assert.ok(client.includes(gws));
  assert.ok(client.includes(logo));
  assert.doesNotMatch(client,/href="https:\/\/www\.globalwebstores\.com\/timi"/);
});

test('legal, help and business link pages link to Explore without replacing Bizlano receipt branding',()=>{
  const worker=source('platform/worker/worker.js');
  assert.match(worker,/Powered by Global Webstores/);
  assert.match(worker,/Powered by Bizlano/);
  assert.ok(worker.includes(gws));
  assert.ok(worker.includes(logo));
});
