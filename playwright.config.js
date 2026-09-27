// @ts-check
const { defineConfig } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
    testDir: './tests',
    timeout: 30000,
    fullyParallel: true,
    reporter: 'list',
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        // Service Worker はルーティング（Google APIの差し替え）を迂回するため無効化する
        serviceWorkers: 'block',
        browserName: 'chromium'
    },
    webServer: {
        command: `node tests/static-server.js ${PORT}`,
        url: `http://127.0.0.1:${PORT}/index.html`,
        reuseExistingServer: !process.env.CI
    }
});
