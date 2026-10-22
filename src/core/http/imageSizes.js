// Smaller copies of uploaded images: /images/<file>?w=400 answers the image at most that wide, as WebP, so lists and
// home tiles load small files. A copy is made on its first request and kept (uploads/images/.sized/<width>/), and
// widths snap up to WIDTHS, so an image has a few copies at most. Without ?w, for a file in a subfolder (QR codes), a
// GIF, or an image sharp cannot read, the original answers as before.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { UPLOADS_DIR } = require('../config/paths');
const logger = require('../logger');

const WIDTHS = [200, 400, 800, 1200, 1600];
const IMAGES_DIR = path.join(UPLOADS_DIR, 'images');
const SIZED_DIR = path.join(IMAGES_DIR, '.sized');
const RESIZABLE = /\.(jpe?g|png|webp|avif)$/i;

// The width to serve for ?w=: the first of WIDTHS at least as wide (the widest for anything wider), or null.
const widthFor = (value) => {
    const asked = Number.parseInt(value, 10);
    if (!Number.isInteger(asked) || asked <= 0) return null;
    return WIDTHS.find((width) => width >= asked) ?? WIDTHS[WIDTHS.length - 1];
};

// The uploaded image a request names, or null: a file right in the images folder, nothing else.
const imageFile = (requestPath) => {
    let file;
    try {
        file = decodeURIComponent(requestPath.replace(/^\//, ''));
    } catch {
        return null;
    }
    if (!file || file !== path.basename(file) || file.startsWith('.') || !RESIZABLE.test(file)) return null;
    return file;
};

const exists = (file) => fs.promises.access(file).then(() => true, () => false);

// One resize per copy at a time; the copy is written beside its place and moved in when complete.
const making = new Map();
const sizedCopy = async (file, width) => {
    const target = path.join(SIZED_DIR, String(width), `${file}.webp`);
    if (await exists(target)) return target;
    if (!making.has(target)) {
        const make = (async () => {
            await fs.promises.mkdir(path.dirname(target), { recursive: true });
            const temp = `${target}.${process.pid}-${Date.now()}.tmp`;
            await sharp(path.join(IMAGES_DIR, file)).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(temp);
            await fs.promises.rename(temp, target);
            return target;
        })();
        making.set(target, make.finally(() => making.delete(target)));
    }
    return making.get(target);
};

// Mounted on /images before the uploaded files are served.
const imageSizes = async (req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.query.w === undefined) return next();
    const width = widthFor(req.query.w);
    const file = width && imageFile(req.path);
    if (!file || !(await exists(path.join(IMAGES_DIR, file)))) return next();
    try {
        const copy = await sizedCopy(file, width);
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        // The copies' folder starts with a dot, which keeps it from being served as uploads; this path is ours.
        return res.type('image/webp').sendFile(copy, { dotfiles: 'allow' });
    } catch (err) {
        logger.warn(`Could not size image ${file} to ${width}px: ${err.message}`);
        return next();
    }
};

module.exports = { imageSizes, WIDTHS, widthFor };
