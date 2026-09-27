// Module resolution aliases for dependency-cruiser (see /.dependency-cruiser.cjs → options.webpackConfig).
// Keep in sync with `paths` in the apps' tsconfig.json files.
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

module.exports = {
  resolve: {
    // `@/…` in apps/web. Matches only `@` and `@/…`, never scoped packages such as `@repo/…`.
    alias: { '@': path.join(root, 'apps/web/src') },
  },
};
