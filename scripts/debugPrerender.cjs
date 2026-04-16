const path = require('path');
const Prerenderer = require('@prerenderer/prerenderer');
const PuppeteerRenderer = require('@prerenderer/renderer-puppeteer');

async function main() {
  const modernPuppeteer = require('puppeteer');
  const renderer = new PuppeteerRenderer({
    headless: true,
    executablePath: modernPuppeteer.executablePath(),
    renderAfterElementExists: 'main',
    renderAfterTime: 500,
    navigationOptions: { waitUntil: 'load', timeout: 120000 },
  });
  const prerenderer = new Prerenderer({
    staticDir: path.join(process.cwd(), 'dist'),
    routes: ['/'],
    renderer,
  });
  try {
    await prerenderer.initialize();
    const rendered = await prerenderer.renderRoutes(['/']);
    console.log('rendered ok, length=', rendered?.[0]?.html?.length);
  } catch (e) {
    console.error('render failed:', e);
    process.exitCode = 1;
  } finally {
    try {
      await prerenderer.destroy();
    } catch {}
  }
}

main();

