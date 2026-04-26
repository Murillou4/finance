# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.12.5 create --template minimal --types ts --install npm finance
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Client-only + GitHub Pages

This app now runs entirely in the browser. Data is stored locally in the current browser and can be moved between browsers with the Backup modal.

The old SQLite data was exported to a private ignored file:

```sh
data/IMPORTAR-MEUS-DADOS-ANTIGOS.json
```

To restore it, open the app, go to Backup, choose that JSON file, check the replace confirmation, and import. Do not move this file to `static/` or commit it, because that would publish your financial data.

For GitHub Pages project deployments, build with the repository name as `BASE_PATH`:

```sh
$env:BASE_PATH='/finance'; npm run build
```
