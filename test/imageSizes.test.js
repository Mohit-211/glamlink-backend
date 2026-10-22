// Smaller copies of uploaded images (core/http/imageSizes.js): /images/<file>?w=<width> answers a WebP at most that
// wide (widths snap up to a short list), made once and kept; anything else answers the original as before.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { startApp } = require('./helpers');
const { UPLOADS_DIR } = require('../src/core/config/paths');
const { widthFor } = require('../src/core/http/imageSizes');

let app;
const file = `sizes-${Date.now()}.png`;

before(async () => {
    app = await startApp();
    fs.mkdirSync(path.join(UPLOADS_DIR, 'images', 'qr'), { recursive: true });
    const picture = sharp({ create: { width: 1000, height: 500, channels: 3, background: { r: 200, g: 120, b: 160 } } }).png();
    await picture.toFile(path.join(UPLOADS_DIR, 'images', file));
    fs.copyFileSync(path.join(UPLOADS_DIR, 'images', file), path.join(UPLOADS_DIR, 'images', 'qr', file));
});
after(() => app.close());

const get = (url) => fetch(`${app.base}${url}`);
const sizeOf = async (res) => sharp(Buffer.from(await res.arrayBuffer())).metadata();

test('?w= answers a smaller WebP, the width snapped up', async () => {
    const res = await get(`/images/${file}?w=350`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/webp');
    assert.match(res.headers.get('cache-control'), /immutable/);
    const meta = await sizeOf(res);
    assert.deepEqual([meta.format, meta.width, meta.height], ['webp', 400, 200]);
    assert.ok(fs.existsSync(path.join(UPLOADS_DIR, 'images', '.sized', '400', `${file}.webp`)), 'the copy is kept');
    assert.equal((await sizeOf(await get(`/images/${file}?w=400`))).width, 400, 'served again from the kept copy');
});

test('an image is never made larger than it is', async () => {
    const meta = await sizeOf(await get(`/images/${file}?w=1600`));
    assert.deepEqual([meta.format, meta.width], ['webp', 1000]);
});

test('without a usable width, in a subfolder, or missing: as before', async () => {
    const original = await get(`/images/${file}?w=wide`);
    assert.equal(original.headers.get('content-type'), 'image/png');
    assert.equal((await sizeOf(original)).width, 1000);
    const qr = await get(`/images/qr/${file}?w=200`);
    assert.equal(qr.headers.get('content-type'), 'image/png', 'QR codes are served as they are');
    assert.equal((await get(`/images/missing-${file}?w=200`)).status, 404);
    assert.equal((await get('/images/.sized/400/x.webp')).status, 404, 'the copies folder is not listed');
});

test('widths snap up to the list', () => {
    assert.deepEqual([1, 200, 201, 799, 1201, 5000].map(widthFor), [200, 200, 400, 800, 1600, 1600]);
    assert.equal(widthFor('x'), null);
    assert.equal(widthFor('-5'), null);
});
