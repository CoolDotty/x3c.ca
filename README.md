# x3c.ca

Source for the X3C website at [x3c.ca](https://x3c.ca). The site combines an Astro and React interface with live server telemetry over WebSockets.

## Development

```sh
pnpm install
pnpm dev
```

Run the production checks with:

```sh
pnpm check
pnpm build
pnpm format:check
```

The site deploys to GitHub Pages from the `gh-pages` branch. Its custom domain is defined in `CNAME`.
