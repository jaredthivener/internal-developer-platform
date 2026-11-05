// See package.json. If a dependency starts loading deepmerge, fail loudly
// instead of silently running the vulnerable 4.3.1: remove the override in
// docs/package.json once a patched deepmerge release exists.
throw new Error(
  'deepmerge is not installed: docs/package.json overrides it with a placeholder because @svgr/plugin-svgo never imported it and 4.3.1 is vulnerable (GHSA-gcqx-w48m-w2h4). Something now loads it; install a patched deepmerge and remove the override.'
);
