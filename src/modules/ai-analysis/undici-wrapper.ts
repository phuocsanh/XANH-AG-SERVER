const { toUSVString } = require('util');
const { Blob, File } = require('buffer');

// Fix cho Node.js v18 - thêm global Blob và File nếu chưa có
if (typeof globalThis.Blob === 'undefined') {
  (globalThis as any).Blob = Blob;
}
if (typeof globalThis.File === 'undefined') {
  (globalThis as any).File = File;
}

// Fix cho String.prototype methods không có trong Node.js v18
if ((String.prototype as any).toWellFormed === undefined) {
    (String.prototype as any).toWellFormed = function () {
        return toUSVString(this);
    }
}

if ((String.prototype as any).isWellFormed === undefined) {
    (String.prototype as any).isWellFormed = function () {
        return toUSVString(this) === this;
    }
}

// Export undici sau khi đã fix các global objects
const undici = require('undici');

export const { fetch } = undici;