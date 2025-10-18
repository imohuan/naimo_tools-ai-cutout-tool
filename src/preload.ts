/// <reference path="../typings/naimo.d.ts" />

// 由于用户要求禁止开发 preload，这里只导出一个空对象
const handlers = {};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = handlers;
}
