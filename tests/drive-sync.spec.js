// @ts-check
// 同期先ファイル (a) と表示中の原稿の出どころ (b) の区別、および上書き防止の確認テスト
const { test, expect } = require('@playwright/test');
const { FakeDrive, manuscript } = require('./fake-google');

// アプリ側 contentFingerprint と同じ計算（シード用）
function fingerprint(data) {
    const strip = (items) => (items || []).map(item => [item.title, item.content, strip(item.children)]);
    const text = JSON.stringify(strip(data.items));
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16) + ':' + text.length;
}

async function boot(page, drive, storage = null) {
    await drive.install(page);
    if (storage) {
        await page.addInitScript((entries) => {
            if (sessionStorage.getItem('__seeded')) return;
            sessionStorage.setItem('__seeded', '1');
            localStorage.clear();
            for (const [key, value] of Object.entries(entries)) {
                localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
            }
        }, storage);
    }
    await page.goto('/index.html');
    await page.waitForFunction(() => window.__tokenClientReady === true);
}

async function openSetup(page) {
    await page.click('#menu-btn');
    await page.click('#drive-setup-mobile');
    await expect(page.locator('#drive-setup-dialog')).toBeVisible();
}

async function signIn(page) {
    await openSetup(page);
    await page.click('#google-signin');
    await expect(page.locator('#auth-status .status-text')).toContainText('ログイン中');
}

async function selectFile(page, name) {
    await page.click('#select-drive-file');
    await page.locator('.generic-dialog-choice', { hasText: name }).click();
    await expect(page.locator('#selected-file-name')).toHaveText(name);
}

async function openSync(page) {
    if (await page.locator('#drive-setup-dialog').isVisible()) {
        await page.click('#close-drive-dialog');
    }
    await page.click('#menu-btn');
    await page.click('#drive-sync-mobile');
    await expect(page.locator('#sync-dialog')).toBeVisible();
}

async function importJson(page, name, title) {
    await page.locator('#load-file-mobile').setInputFiles({
        name,
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(manuscript(title)))
    });
    await expect(firstTitle(page)).toHaveText(title);
}

function firstTitle(page) {
    return page.locator('#outline-tree-mobile .outline-title-mobile').first();
}

const dialog = (page) => page.locator('#generic-dialog');
const dialogMessage = (page) => page.locator('#generic-dialog-message');

test.describe('① 設定完了で同期先ファイル名を上書きしない', () => {
    test('既存ファイルを選んで設定完了しても、同期先の表示と保存値は選んだファイルのまま', async ({ page }) => {
        const drive = new FakeDrive();
        drive.addFile('A.json', manuscript('原稿A'));
        await boot(page, drive);
        await signIn(page);

        await selectFile(page, 'A.json');
        // 入力欄は新規作成用で、既定名のまま
        await expect(page.locator('#drive-file-name')).toHaveValue('OutlineWriter-data.json');
        await page.click('#save-drive-config');

        await openSetup(page);
        await expect(page.locator('#selected-file-name')).toHaveText('A.json');
        await expect(page.locator('#drive-target-label')).toHaveText('同期先: A.json');
        const config = await page.evaluate(() => JSON.parse(localStorage.getItem('outlinewriter-drive-config')));
        expect(config.fileName).toBe('A.json');
    });

    test('入力欄を書き換えてから設定完了しても、同期先ファイル名は変わらない', async ({ page }) => {
        const drive = new FakeDrive();
        drive.addFile('A.json', manuscript('原稿A'));
        await boot(page, drive);
        await signIn(page);
        await selectFile(page, 'A.json');

        await page.fill('#drive-file-name', 'B.json');
        await page.click('#save-drive-config');

        await openSetup(page);
        await expect(page.locator('#selected-file-name')).toHaveText('A.json');
        await expect(page.locator('#drive-target-label')).toHaveText('同期先: A.json');
    });
});

test.describe('(b)/④ 同期先と表示中の原稿を区別して表示する', () => {
    test('別の原稿を表示中に同期先を選ぶと、両者が表示され不一致の警告が出る', async ({ page }) => {
        const drive = new FakeDrive();
        drive.addFile('A.json', manuscript('原稿A'));
        await boot(page, drive);
        await importJson(page, 'local.json', 'ローカル原稿');
        await signIn(page);

        await selectFile(page, 'A.json');
        await expect(page.locator('#toast-message')).toContainText('入れ替わりません');
        await expect(page.locator('#setup-data-source')).toHaveText('ファイル: local.json');
        await expect(page.locator('#setup-source-warning')).toBeVisible();

        await openSync(page);
        await expect(page.locator('#sync-target-name')).toHaveText('A.json');
        await expect(page.locator('#sync-data-source')).toHaveText('ファイル: local.json');
        await expect(page.locator('#sync-source-warning')).toBeVisible();

        // ダウンロードすると表示中の原稿の出どころが同期先と一致し、警告が消える
        await page.click('#download-from-drive');
        await expect(dialogMessage(page)).toContainText('読み込んだものではありません');
        await page.click('#generic-dialog-ok');
        await expect(firstTitle(page)).toHaveText('原稿A');
        await expect(page.locator('#sync-data-source')).toHaveText('Drive: A.json');
        await expect(page.locator('#sync-source-warning')).toBeHidden();
    });

    test('Drive側で名前が変わると同期先の表示が更新される', async ({ page }) => {
        const drive = new FakeDrive();
        const idA = drive.addFile('A.json', manuscript('原稿A'));
        await boot(page, drive);
        await signIn(page);
        await selectFile(page, 'A.json');

        drive.files.get(idA).name = 'A-renamed.json';
        await openSync(page);
        await expect(page.locator('#sync-target-name')).toHaveText('A-renamed.json');
        await expect(page.locator('#drive-target-label')).toHaveText('同期先: A-renamed.json');
    });
});

test.describe('③ アップロード前の確認', () => {
    test('別の原稿で同期先を上書きしようとすると確認が出て、キャンセルならDriveは変わらない', async ({ page }) => {
        const drive = new FakeDrive();
        const idA = drive.addFile('A.json', manuscript('原稿A'));
        await boot(page, drive);
        await importJson(page, 'local.json', 'ローカル原稿');
        await signIn(page);
        await selectFile(page, 'A.json');
        await openSync(page);

        await page.click('#upload-to-drive');
        await expect(dialogMessage(page)).toContainText('ファイル: local.json');
        await expect(dialogMessage(page)).toContainText('別の原稿を上書きするおそれがあります');
        await page.click('#generic-dialog-cancel');
        await expect(page.locator('#toast-message')).toHaveText('アップロードを中止しました');
        expect(drive.patchCount()).toBe(0);
        expect(drive.files.get(idA).content.data.items[0].title).toBe('原稿A');

        // 承認すれば上書きされ、以降は同期先由来として扱われる
        await page.click('#upload-to-drive');
        await page.click('#generic-dialog-ok');
        await expect(page.locator('#toast-message')).toHaveText('Driveにアップロードしました');
        expect(drive.files.get(idA).content.data.items[0].title).toBe('ローカル原稿');
        await expect(page.locator('#sync-data-source')).toHaveText('Drive: A.json');
    });

    test('同期済みで問題がなければ確認なし、Drive側が更新されていれば確認が出る', async ({ page }) => {
        const drive = new FakeDrive();
        const idA = drive.addFile('A.json', manuscript('原稿A'), new Date(Date.now() - 3600 * 1000));
        await boot(page, drive);
        await signIn(page);
        await selectFile(page, 'A.json');
        await openSync(page);
        await page.click('#download-from-drive'); // ローカルは空なので確認なし
        await expect(firstTitle(page)).toHaveText('原稿A');

        await page.click('#upload-to-drive');
        await expect(page.locator('#toast-message')).toHaveText('Driveにアップロードしました');
        await expect(dialog(page)).toBeHidden();
        expect(drive.patchCount()).toBe(1);

        // 他の端末でDriveが更新された状態
        drive.files.get(idA).modifiedTime = new Date(Date.now() + 60 * 1000);
        await page.click('#upload-to-drive');
        await expect(dialogMessage(page)).toContainText('前回の同期後にDrive側で更新されています');
        await page.click('#generic-dialog-cancel');
        expect(drive.patchCount()).toBe(1);
    });

    test('新規作成したファイルは同期済みとして扱われ、すぐアップロードしても確認は出ない', async ({ page }) => {
        const drive = new FakeDrive();
        await boot(page, drive);
        await importJson(page, 'local.json', 'ローカル原稿');
        await signIn(page);

        await page.fill('#drive-file-name', 'New.json');
        await page.click('#create-drive-file');
        await expect(page.locator('#selected-file-name')).toHaveText('New.json');
        await expect(page.locator('#setup-data-source')).toHaveText('Drive: New.json');
        await expect(page.locator('#setup-source-warning')).toBeHidden();

        await openSync(page);
        await page.click('#upload-to-drive');
        await expect(page.locator('#toast-message')).toHaveText('Driveにアップロードしました');
        await expect(dialog(page)).toBeHidden();
    });
});

test.describe('手動ダウンロード前の確認', () => {
    test('同期直後でも未アップロードの編集があれば確認が出て、キャンセルなら編集は残る', async ({ page }) => {
        const drive = new FakeDrive();
        drive.addFile('A.json', manuscript('原稿A'), new Date(Date.now() - 3600 * 1000));
        await boot(page, drive);
        await signIn(page);
        await selectFile(page, 'A.json');
        await openSync(page);
        await page.click('#download-from-drive');
        await expect(firstTitle(page)).toHaveText('原稿A');

        // 編集していなければ確認なしで再ダウンロードできる
        await page.click('#download-from-drive');
        await expect(page.locator('#toast-message')).toHaveText('Driveからダウンロードしました');
        await expect(dialog(page)).toBeHidden();

        await page.click('#close-sync-dialog');
        await firstTitle(page).click();
        await page.fill('#current-title-mobile', '原稿A（編集中）');

        await openSync(page);
        await page.click('#download-from-drive');
        await expect(dialogMessage(page)).toContainText('まだDriveへアップロードしていない編集があります');
        await page.click('#generic-dialog-cancel');
        await expect(firstTitle(page)).toHaveText('原稿A（編集中）');
    });
});

test.describe('② 起動時の自動同期はファイルごとの同期記録で判定する', () => {
    const hourAgo = () => new Date(Date.now() - 3600 * 1000);

    test('同期先を別ファイルに切り替えた後は、確認なしに原稿を置き換えない', async ({ page }) => {
        const drive = new FakeDrive();
        const idB = drive.addFile('B.json', manuscript('原稿B'));
        // 旧実装では、前のファイルの同期時刻より古いので確認なしでダウンロードされていたケース
        const idA = drive.addFile('A.json', manuscript('原稿A'), new Date(Date.now() - 24 * 3600 * 1000));
        const t0 = hourAgo().toISOString();
        const localData = manuscript('原稿B').data;

        await boot(page, drive, {
            'outlinewriter-data': localData,
            'outlinewriter-data-timestamp-iso': t0,
            'outlinewriter-data-source': { kind: 'drive', fileId: idB, fileName: 'B.json' },
            'outlinewriter-drive-sync-state': { fileId: idB, syncedIso: t0, dataHash: fingerprint(localData) },
            'outlinewriter-drive-config': { fileName: 'A.json', fileId: idA, lastSync: null, syncEnabled: true }
        });

        await expect(dialogMessage(page)).toContainText('Drive: B.json', { timeout: 10000 });
        await expect(dialogMessage(page)).toContainText('同期先「A.json」から読み込んだものではありません');
        await page.click('#generic-dialog-cancel');
        await expect(firstTitle(page)).toHaveText('原稿B');
    });

    test('同じファイルで未編集、Drive側が更新済みなら確認なしで取り込む', async ({ page }) => {
        const drive = new FakeDrive();
        const idA = drive.addFile('A.json', manuscript('原稿A（他端末で更新）'), new Date());
        const t0 = hourAgo().toISOString();
        const localData = manuscript('原稿A').data;

        await boot(page, drive, {
            'outlinewriter-data': localData,
            'outlinewriter-data-timestamp-iso': t0,
            'outlinewriter-data-source': { kind: 'drive', fileId: idA, fileName: 'A.json' },
            'outlinewriter-drive-sync-state': { fileId: idA, syncedIso: t0, dataHash: fingerprint(localData) },
            'outlinewriter-drive-config': { fileName: 'A.json', fileId: idA, lastSync: null, syncEnabled: true }
        });

        await expect(firstTitle(page)).toHaveText('原稿A（他端末で更新）', { timeout: 10000 });
        await expect(dialog(page)).toBeHidden();
    });

    test('同じファイルで編集済み、Drive側に変更がなければ取り込まずにスキップする', async ({ page }) => {
        const drive = new FakeDrive();
        const t0 = hourAgo();
        const idA = drive.addFile('A.json', manuscript('原稿A'), new Date(t0.getTime() - 60 * 1000));
        const syncedData = manuscript('原稿A').data;
        const editedData = manuscript('原稿A（編集済み）').data;

        await boot(page, drive, {
            'outlinewriter-data': editedData,
            'outlinewriter-data-timestamp-iso': t0.toISOString(),
            'outlinewriter-data-source': { kind: 'drive', fileId: idA, fileName: 'A.json' },
            'outlinewriter-drive-sync-state': { fileId: idA, syncedIso: t0.toISOString(), dataHash: fingerprint(syncedData) },
            'outlinewriter-drive-config': { fileName: 'A.json', fileId: idA, lastSync: null, syncEnabled: true }
        });

        await expect(page.locator('#toast-message')).toContainText('Drive側に新しい変更はありません', { timeout: 10000 });
        await expect(firstTitle(page)).toHaveText('原稿A（編集済み）');
    });

    test('旧形式の記録のまま同期先を切り替えていても、確認なしに原稿を置き換えない', async ({ page }) => {
        // 修正前はこの状態で起動すると、原稿Bが確認なしに原稿Aへ置き換わっていた
        const drive = new FakeDrive();
        drive.addFile('B.json', manuscript('原稿B'));
        const idA = drive.addFile('A.json', manuscript('原稿A'), new Date(Date.now() - 24 * 3600 * 1000));
        const t0 = hourAgo().toISOString();

        await boot(page, drive, {
            'outlinewriter-data': manuscript('原稿B').data,
            'outlinewriter-data-timestamp-iso': t0,
            'outlinewriter-drive-synced-iso': t0,
            'outlinewriter-drive-config': { fileName: 'A.json', fileId: idA, lastSync: null, syncEnabled: true }
        });

        await expect(page.locator('#toast-message')).toContainText('自動同期をスキップしました', { timeout: 10000 });
        await expect(firstTitle(page)).toHaveText('原稿B');
    });

    test('旧形式の同期時刻は現在の同期先ファイルの記録として引き継がれる', async ({ page }) => {
        const drive = new FakeDrive();
        const idA = drive.addFile('A.json', manuscript('原稿A'));
        const t0 = hourAgo().toISOString();

        await boot(page, drive, {
            'outlinewriter-drive-synced-iso': t0,
            'outlinewriter-drive-config': { fileName: 'A.json', fileId: idA, lastSync: null, syncEnabled: false }
        });

        const stored = await page.evaluate(() => ({
            legacy: localStorage.getItem('outlinewriter-drive-synced-iso'),
            state: JSON.parse(localStorage.getItem('outlinewriter-drive-sync-state'))
        }));
        expect(stored.legacy).toBeNull();
        expect(stored.state).toEqual({ fileId: idA, syncedIso: t0, dataHash: null });
        // 既存利用者の原稿の出どころは「不明」から始まる
        await expect(page.locator('#sync-data-source')).toHaveText('不明（記録なし）');
    });
});

test.describe('(b) Undo/Redo とバックアップも出どころを保持する', () => {
    test('読み込み直後にUndoすると、原稿と出どころの両方が前に戻る', async ({ page }) => {
        const drive = new FakeDrive();
        await boot(page, drive);
        await importJson(page, 'one.json', '原稿1');
        await importJson(page, 'two.json', '原稿2');
        await expect(page.locator('#sync-data-source')).toHaveText('ファイル: two.json');

        await page.click('#menu-btn');
        await page.click('#undo-mobile');
        await expect(firstTitle(page)).toHaveText('原稿1');
        await expect(page.locator('#sync-data-source')).toHaveText('ファイル: one.json');

        await page.click('#redo-mobile');
        await expect(firstTitle(page)).toHaveText('原稿2');
        await expect(page.locator('#sync-data-source')).toHaveText('ファイル: two.json');
    });

    test('バックアップから復元すると、そのときの出どころも戻る', async ({ page }) => {
        const drive = new FakeDrive();
        await boot(page, drive);
        await importJson(page, 'one.json', '原稿1');
        await page.click('#menu-btn');
        await page.click('#backup-mobile');

        await importJson(page, 'two.json', '原稿2');
        await page.click('#menu-btn');
        await page.click('#restore-mobile');
        await page.locator('.generic-dialog-choice').first().click();
        await page.click('#generic-dialog-ok');

        await expect(firstTitle(page)).toHaveText('原稿1');
        await expect(page.locator('#sync-data-source')).toHaveText('ファイル: one.json');
    });
});
