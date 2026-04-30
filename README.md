# bbop-js-monorepo

Monorepo for BBOP JS packages.

## Prerequisites

- Node.js 24.
  > It is recommended to use [`nvm`](https://github.com/nvm-sh/nvm) to manage Node.js versions. Node.js v24 can be installed with `nvm install 24`. Calling `nvm use` in this directory will switch to the correct version based on the `.nvmrc` file.

## Development

- Install dependencies for all packages and links workspace packages together.

  ```bash
  npm install
  ```

- Run `oxlint` linter on all packages.

  ```bash
  npm run lint
  ```

- Run `oxfmt` formatter on all packages.

  ```bash
  npm run format
  ```

- Increment version(s) of changed packages and publish to npm (requires npm auth and permissions).
  ```bash
  npm run release:version
  npm run release:publish
  ```

## Notes

- Type checking, linting, and formatting are not wired into git hooks or CI. They are available as manual commands to run as needed.
- The TypeScript config enables `allowJs` so packages can contain standard JavaScript.
