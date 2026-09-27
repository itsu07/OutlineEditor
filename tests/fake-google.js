// Google Identity Services と Drive REST API のテスト用フェイク
// 本物のGoogleには接続せず、Playwrightのルーティングで応答を差し替える

const GIS_STUB = `
window.google = {
    accounts: {
        oauth2: {
            initTokenClient(config) {
                window.__tokenClientReady = true;
                return {
                    requestAccessToken() {
                        window.__tokenRequests = (window.__tokenRequests || 0) + 1;
                        setTimeout(() => config.callback({ access_token: 'fake-token', expires_in: 3600 }), 10);
                    }
                };
            },
            revoke() {}
        }
    }
};
`;

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
};

function manuscript(title, content = '') {
    return {
        data: {
            items: [{ id: 1, title, content, children: [], expanded: true }],
            nextId: 2
        },
        timestamp: '2026/1/1 0:00:00',
        version: '2.2'
    };
}

class FakeDrive {
    constructor() {
        this.files = new Map();
        this.nextId = 1;
        this.requests = [];
    }

    addFile(name, content, modifiedTime = new Date()) {
        const id = `file-${this.nextId++}`;
        this.files.set(id, { name, content, modifiedTime });
        return id;
    }

    patchCount() {
        return this.requests.filter(r => r.method === 'PATCH').length;
    }

    async install(page) {
        await page.route('https://accounts.google.com/gsi/client', route =>
            route.fulfill({ status: 200, contentType: 'application/javascript', body: GIS_STUB }));
        await page.route('https://www.googleapis.com/**', route => this.handle(route));
    }

    json(route, status, body) {
        return route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(body) });
    }

    async handle(route) {
        const request = route.request();
        const method = request.method();
        const url = new URL(request.url());
        this.requests.push({ method, path: url.pathname, search: url.search });

        if (method === 'OPTIONS') {
            return route.fulfill({ status: 204, headers: CORS });
        }
        if (url.pathname === '/oauth2/v2/userinfo') {
            return this.json(route, 200, { email: 'tester@example.com', name: 'Tester' });
        }
        if (url.pathname === '/drive/v3/files' && method === 'GET') {
            const files = [...this.files.entries()].map(([id, f]) => ({
                id, name: f.name, modifiedTime: f.modifiedTime.toISOString()
            }));
            return this.json(route, 200, { files });
        }

        const fileMatch = url.pathname.match(/^\/(upload\/)?drive\/v3\/files\/([^/]+)$/);
        if (fileMatch) {
            const file = this.files.get(fileMatch[2]);
            if (!file) return this.json(route, 404, { error: 'not found' });

            if (method === 'GET' && url.searchParams.get('alt') === 'media') {
                return this.json(route, 200, file.content);
            }
            if (method === 'GET') {
                return this.json(route, 200, { name: file.name, modifiedTime: file.modifiedTime.toISOString() });
            }
            if (method === 'PATCH') {
                file.content = JSON.parse(request.postData());
                file.modifiedTime = new Date();
                return this.json(route, 200, { id: fileMatch[2] });
            }
        }

        if (url.pathname === '/upload/drive/v3/files' && method === 'POST') {
            const { metadata, content } = parseMultipart(request);
            const id = this.addFile(metadata.name, content);
            return this.json(route, 200, { id, name: metadata.name });
        }

        return this.json(route, 500, { error: `unhandled ${method} ${url.pathname}` });
    }
}

function parseMultipart(request) {
    const contentType = request.headers()['content-type'];
    const boundary = contentType.split('boundary=')[1];
    const body = request.postDataBuffer().toString('utf8');
    const parts = body.split(`--${boundary}`)
        .filter(part => part.includes('\r\n\r\n'))
        .map(part => part.slice(part.indexOf('\r\n\r\n') + 4).replace(/\r\n$/, ''));
    return { metadata: JSON.parse(parts[0]), content: JSON.parse(parts[1]) };
}

module.exports = { FakeDrive, manuscript };
