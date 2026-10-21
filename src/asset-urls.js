// Build-time content hashes keep unchanged artwork at the same URL on Pages.
// Source preview also works directly, without a build or a service worker.
const files = typeof __ASSET_URLS__ === 'undefined' ? {} : __ASSET_URLS__;
export const productionAssets = typeof __ASSET_URLS__ !== 'undefined';
export function assetUrl(name) {
  return new URL(`../assets/${files[name] || name}`, import.meta.url).href;
}
