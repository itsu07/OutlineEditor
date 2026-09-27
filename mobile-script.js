class MobileOutlineWriter {
    constructor() {
        this.data = {
            items: [],
            nextId: 1
        };
        this.currentItem = null;
        this.backups = [];
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        this.maxBackups = 10;
        this.hierarchyUpdateNeeded = false;
        this.sidebarOpen = false;
        this.toolbarVisible = true;
        this.autoSaveTimer = null;
        this.historyTimer = null;
        this.toastTimer = null;
        
        // Google Drive integration
        this.driveConfig = {
            fileName: 'OutlineWriter-data.json',
            fileId: '',
            // Claude等から読むためのGoogleドキュメント（Markdownから変換して保存）
            docFileId: '',
            connected: false,
            syncEnabled: false,
            lastSync: null,
            userEmail: ''
        };
        
        // Google API状態
        this.tokenClient = null;
        this.accessToken = null;
        this.tokenExpiresAt = null;
        this.pendingAutoSync = false;
        this.pendingTokenResolve = null;
        this.pendingTokenTimeout = null;
        this.gapiInitialized = false;
        
        this.initializeElements();
        this.bindEvents();
        this.initializeToolbarState();
        this.loadConfig();
        this.loadData();
        this.updateHierarchyPaths();
        this.renderOutline();
        this.updateCharCount();
        this.updateButtonStates();
        this.saveToHistory();
        this.startAutoBackup();
        this.setupPWA();
        
        // Google API初期化は少し遅延させる（リトライ機能付き）
        // DOMが完全に読み込まれてから初期化を開始
        if (document.readyState === 'complete') {
            this.scheduleGoogleAPIInitialization();
        } else {
            window.addEventListener('load', () => {
                this.scheduleGoogleAPIInitialization();
            });
        }
    }
    
    scheduleGoogleAPIInitialization() {
        console.log('Google API初期化をスケジュール中... readyState:', document.readyState);
        setTimeout(() => {
            console.log('Google API初期化を開始...');
            this.initializeGoogleAPIWithRetry();
        }, 1000);
    }


    initializeElements() {
        this.elements = {
            // Header
            sidebarToggle: document.getElementById('sidebar-toggle'),
            searchBtn: document.getElementById('search-btn'),
            menuBtn: document.getElementById('menu-btn'),
            
            // Sidebar
            sidebar: document.getElementById('mobile-sidebar'),
            expandAllBtn: document.getElementById('expand-all-mobile'),
            collapseAllBtn: document.getElementById('collapse-all-mobile'),
            outlineTree: document.getElementById('outline-tree-mobile'),
            
            // Editor
            editor: document.getElementById('mobile-editor'),
            breadcrumb: document.getElementById('breadcrumb'),
            currentTitle: document.getElementById('current-title-mobile'),
            currentContent: document.getElementById('current-content-mobile'),
            charCount: document.getElementById('char-count-mobile'),
            totalCharCount: document.getElementById('total-char-count-mobile'),
            
            // Toolbar
            bottomToolbar: document.getElementById('bottom-toolbar'),
            addItemBtn: document.getElementById('add-item-mobile'),
            moveUpBtn: document.getElementById('move-up-mobile'),
            moveDownBtn: document.getElementById('move-down-mobile'),
            indentBtn: document.getElementById('indent-mobile'),
            outdentBtn: document.getElementById('outdent-mobile'),
            deleteBtn: document.getElementById('delete-mobile'),
            hideToolbarBtn: document.getElementById('hide-toolbar-mobile'),
            showToolbarBtn: document.getElementById('show-toolbar-mobile'),
            
            // Menu
            actionMenu: document.getElementById('action-menu'),
            closeMenu: document.getElementById('close-menu'),
            undoBtn: document.getElementById('undo-mobile'),
            redoBtn: document.getElementById('redo-mobile'),
            backupBtn: document.getElementById('backup-mobile'),
            restoreBtn: document.getElementById('restore-mobile'),
            
            // Drive integration
            driveSetupBtn: document.getElementById('drive-setup-mobile'),
            driveSyncBtn: document.getElementById('drive-sync-mobile'),
            driveStatus: document.querySelector('.drive-status'),
            
            // Local files
            saveBtn: document.getElementById('save-mobile'),
            loadBtn: document.getElementById('load-mobile'),
            loadFileInput: document.getElementById('load-file-mobile'),
            loadMdBtn: document.getElementById('load-md-mobile'),
            loadMarkdownInput: document.getElementById('load-markdown-mobile'),
            exportJsonBtn: document.getElementById('export-json-mobile'),
            exportMdBtn: document.getElementById('export-md-mobile'),
            exportTextBtn: document.getElementById('export-text-mobile'),
            
            // Drive setup dialog
            driveSetupDialog: document.getElementById('drive-setup-dialog'),
            closeDriveDialog: document.getElementById('close-drive-dialog'),
            authStatus: document.getElementById('auth-status'),
            googleSignin: document.getElementById('google-signin'),
            googleSignout: document.getElementById('google-signout'),
            fileSection: document.getElementById('file-section'),
            driveFileName: document.getElementById('drive-file-name'),
            selectedFileName: document.getElementById('selected-file-name'),
            selectedFileModified: document.getElementById('selected-file-modified'),
            selectDriveFile: document.getElementById('select-drive-file'),
            createDriveFile: document.getElementById('create-drive-file'),
            autoSync: document.getElementById('auto-sync'),
            saveDriveConfig: document.getElementById('save-drive-config'),
            diagnoseGoogleApi: document.getElementById('diagnose-google-api'),
            
            // Sync dialog
            syncDialog: document.getElementById('sync-dialog'),
            closeSyncDialog: document.getElementById('close-sync-dialog'),
            localTimestamp: document.getElementById('local-timestamp'),
            driveTimestamp: document.getElementById('drive-timestamp'),
            lastSyncTimestamp: document.getElementById('last-sync-timestamp'),
            uploadToDrive: document.getElementById('upload-to-drive'),
            downloadFromDrive: document.getElementById('download-from-drive'),
            syncProgress: document.getElementById('sync-progress'),
            
            // Search
            searchPanel: document.getElementById('search-panel'),
            searchInput: document.getElementById('search-input'),
            closeSearch: document.getElementById('close-search'),
            searchResults: document.getElementById('search-results'),
            
            // Toast
            toast: document.getElementById('toast'),
            toastMessage: document.getElementById('toast-message')
        };
        
        // Create sidebar overlay
        this.sidebarOverlay = document.createElement('div');
        this.sidebarOverlay.className = 'sidebar-overlay';
        document.body.appendChild(this.sidebarOverlay);
    }

    bindEvents() {
        // Header events
        this.elements.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        this.elements.searchBtn.addEventListener('click', () => this.toggleSearch());
        this.elements.menuBtn.addEventListener('click', () => this.toggleMenu());
        
        // Sidebar events
        this.elements.expandAllBtn.addEventListener('click', () => this.expandAll());
        this.elements.collapseAllBtn.addEventListener('click', () => this.collapseAll());
        this.sidebarOverlay.addEventListener('click', () => this.closeSidebar());
        
        // Editor events
        this.elements.currentTitle.addEventListener('input', () => this.updateCurrentItem());
        this.elements.currentContent.addEventListener('input', () => {
            this.updateCurrentItem();
            this.updateCharCount();
        });
        
        // Toolbar events
        this.elements.addItemBtn.addEventListener('click', () => this.addItemAfterCurrent());
        this.elements.moveUpBtn.addEventListener('click', () => this.moveUp());
        this.elements.moveDownBtn.addEventListener('click', () => this.moveDown());
        this.elements.indentBtn.addEventListener('click', () => this.indentItem());
        this.elements.outdentBtn.addEventListener('click', () => this.outdentItem());
        this.elements.deleteBtn.addEventListener('click', () => this.deleteCurrentItem());
        this.elements.hideToolbarBtn.addEventListener('click', () => this.hideToolbar());
        this.elements.showToolbarBtn.addEventListener('click', () => this.showToolbar());
        
        // Menu events
        this.elements.closeMenu.addEventListener('click', () => this.closeMenu());
        this.elements.actionMenu.querySelector('.menu-backdrop').addEventListener('click', () => this.closeMenu());
        this.elements.undoBtn.addEventListener('click', () => this.undo());
        this.elements.redoBtn.addEventListener('click', () => this.redo());
        this.elements.backupBtn.addEventListener('click', () => this.createBackup());
        this.elements.restoreBtn.addEventListener('click', () => this.showBackupDialog());
        this.elements.saveBtn.addEventListener('click', () => this.saveData());
        this.elements.loadBtn.addEventListener('click', () => this.loadFileFromDialog());
        this.elements.loadFileInput.addEventListener('change', (e) => this.loadFromFile(e));
        this.elements.loadMdBtn.addEventListener('click', () => this.loadMarkdownFromDialog());
        this.elements.loadMarkdownInput.addEventListener('change', (e) => this.loadFromMarkdownFile(e));
        this.elements.exportJsonBtn.addEventListener('click', () => this.exportAsJSON());
        this.elements.exportMdBtn.addEventListener('click', () => this.exportAsMarkdown());
        this.elements.exportTextBtn.addEventListener('click', () => this.exportAsText());
        
        // Drive events
        if (this.elements.driveSetupBtn) {
            this.elements.driveSetupBtn.addEventListener('click', () => this.openDriveSetupDialog());
        }
        this.elements.driveSyncBtn.addEventListener('click', () => this.openSyncDialog());
        this.elements.closeDriveDialog.addEventListener('click', () => this.closeDriveSetupDialog());
        this.elements.closeSyncDialog.addEventListener('click', () => this.closeSyncDialog());
        this.elements.googleSignin.addEventListener('click', () => this.signInToGoogle());
        this.elements.googleSignout.addEventListener('click', () => this.signOutFromGoogle());
        this.elements.selectDriveFile.addEventListener('click', () => this.selectExistingFile());
        this.elements.createDriveFile.addEventListener('click', () => this.createNewFile());
        this.elements.saveDriveConfig.addEventListener('click', () => this.saveDriveConfig());
        this.elements.uploadToDrive.addEventListener('click', () => this.uploadToDrive());
        this.elements.downloadFromDrive.addEventListener('click', () => this.downloadFromDrive());
        this.elements.diagnoseGoogleApi.addEventListener('click', () => {
            const status = this.diagnoseGoogleAPIStatus();
            const ok = (v) => v ? 'OK' : 'NG';
            this.showToast(`GIS:${ok(status.gisLoaded)} 初期化:${ok(status.gapiInitialized)} ログイン:${ok(status.connected)}`);
        });
        
        // Drive dialog backdrop events
        this.elements.driveSetupDialog.querySelector('.dialog-backdrop').addEventListener('click', () => this.closeDriveSetupDialog());
        this.elements.syncDialog.querySelector('.dialog-backdrop').addEventListener('click', () => this.closeSyncDialog());
        
        // Search events
        this.elements.closeSearch.addEventListener('click', () => this.closeSearch());
        this.elements.searchInput.addEventListener('input', (e) => this.performSearch(e.target.value));
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Touch events for gestures
        this.setupTouchGestures();
        
        // Resize events
        window.addEventListener('resize', () => this.handleResize());
    }

    setupTouchGestures() {
        let startX = 0;
        let startY = 0;
        let isSwipe = false;
        
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                isSwipe = false;
            }
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                const deltaX = e.touches[0].clientX - startX;
                const deltaY = e.touches[0].clientY - startY;
                
                if (Math.abs(deltaX) > 30 && Math.abs(deltaY) < 100) {
                    isSwipe = true;
                }
            }
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (isSwipe && e.changedTouches.length === 1) {
                const deltaX = e.changedTouches[0].clientX - startX;
                
                // Swipe right to open sidebar
                if (deltaX > 50 && startX < 50 && !this.sidebarOpen) {
                    this.openSidebar();
                }
                // Swipe left to close sidebar
                else if (deltaX < -50 && this.sidebarOpen) {
                    this.closeSidebar();
                }
            }
        }, { passive: true });
    }

    handleKeyboard(e) {
        // Undo/Redo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            this.redo();
        }
        // Search
        else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            this.toggleSearch();
        }
        // Close panels with Escape
        else if (e.key === 'Escape') {
            if (this.isGenericDialogOpen()) {
                this.cancelGenericDialog();
            } else if (!this.elements.searchPanel.classList.contains('hidden')) {
                this.closeSearch();
            } else if (!this.elements.syncDialog.classList.contains('hidden')) {
                this.closeSyncDialog();
            } else if (!this.elements.driveSetupDialog.classList.contains('hidden')) {
                this.closeDriveSetupDialog();
            } else if (!this.elements.actionMenu.classList.contains('hidden')) {
                this.closeMenu();
            } else if (this.sidebarOpen && window.innerWidth < 768) {
                this.closeSidebar();
            }
        }
    }

    handleResize() {
        // Auto-close sidebar on mobile when resizing to desktop
        if (window.innerWidth >= 768 && this.sidebarOpen) {
            this.sidebarOpen = false;
            this.elements.sidebar.classList.remove('open');
            this.elements.editor.classList.remove('sidebar-open');
            this.sidebarOverlay.classList.remove('show');
        }
    }

    // Sidebar management
    toggleSidebar() {
        if (this.sidebarOpen) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    openSidebar() {
        this.sidebarOpen = true;
        this.elements.sidebar.classList.add('open');
        if (window.innerWidth < 768) {
            this.elements.editor.classList.add('sidebar-open');
            this.sidebarOverlay.classList.add('show');
        }
    }

    closeSidebar() {
        this.sidebarOpen = false;
        this.elements.sidebar.classList.remove('open');
        this.elements.editor.classList.remove('sidebar-open');
        this.sidebarOverlay.classList.remove('show');
    }

    // Menu management
    toggleMenu() {
        if (this.elements.actionMenu.classList.contains('hidden')) {
            this.openMenu();
        } else {
            this.closeMenu();
        }
    }

    openMenu() {
        this.elements.actionMenu.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeMenu() {
        this.elements.actionMenu.classList.add('hidden');
        document.body.style.overflow = '';
    }

    // Search management
    toggleSearch() {
        if (this.elements.searchPanel.classList.contains('hidden')) {
            this.openSearch();
        } else {
            this.closeSearch();
        }
    }

    openSearch() {
        this.elements.searchPanel.classList.remove('hidden');
        setTimeout(() => {
            this.elements.searchInput.focus();
        }, 300);
    }

    closeSearch() {
        this.elements.searchPanel.classList.add('hidden');
        this.elements.searchInput.value = '';
        this.elements.searchResults.innerHTML = '';
    }

    performSearch(query) {
        if (!query.trim()) {
            this.elements.searchResults.innerHTML = '';
            return;
        }

        const results = [];
        if (this.data && this.data.items) {
            this.searchItems(this.data.items, query.toLowerCase(), results);
        }
        this.displaySearchResults(results);
    }

    searchItems(items, query, results) {
        items.forEach(item => {
            const titleMatch = item.title.toLowerCase().includes(query);
            const contentMatch = item.content.toLowerCase().includes(query);
            
            if (titleMatch || contentMatch) {
                results.push(item);
            }
            
            if (item.children) {
                this.searchItems(item.children, query, results);
            }
        });
    }

    displaySearchResults(results) {
        if (results.length === 0) {
            this.elements.searchResults.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">検索結果が見つかりません</div>';
            return;
        }

        const html = results.map(item => `
            <div class="search-result-item" data-id="${item.id}">
                <div class="search-result-title">${this.escapeHtml(item.title || '無題')}</div>
                <div class="search-result-content">${this.escapeHtml(item.content.substring(0, 100))}${item.content.length > 100 ? '...' : ''}</div>
            </div>
        `).join('');
        
        this.elements.searchResults.innerHTML = html;
        
        // Add click events
        this.elements.searchResults.querySelectorAll('.search-result-item').forEach(el => {
            el.addEventListener('click', () => {
                const itemId = parseInt(el.dataset.id);
                this.selectItem(itemId);
                this.closeSearch();
                this.closeSidebar();
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Toast notifications
    showToast(message, duration = 3000) {
        this.elements.toastMessage.textContent = message;
        this.elements.toast.classList.remove('hidden');

        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            this.elements.toast.classList.add('hidden');
        }, duration);
    }

    // ===== Generic in-app dialogs (replace native prompt/confirm) =====
    ensureGenericDialog() {
        if (this.genericDialogEl) return this.genericDialogEl;

        const overlay = document.createElement('div');
        overlay.id = 'generic-dialog';
        overlay.className = 'drive-dialog generic-dialog hidden';
        overlay.innerHTML = `
            <div class="dialog-backdrop"></div>
            <div class="dialog-panel">
                <div class="dialog-header">
                    <h3 id="generic-dialog-title"></h3>
                </div>
                <div class="dialog-content">
                    <p id="generic-dialog-message"></p>
                    <input type="text" id="generic-dialog-input" class="hidden">
                    <div id="generic-dialog-choices" class="generic-dialog-choices hidden"></div>
                </div>
                <div class="dialog-actions" id="generic-dialog-actions">
                    <button id="generic-dialog-cancel" class="btn secondary">キャンセル</button>
                    <button id="generic-dialog-ok" class="btn primary">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const backdrop = overlay.querySelector('.dialog-backdrop');
        const okBtn = overlay.querySelector('#generic-dialog-ok');
        const cancelBtn = overlay.querySelector('#generic-dialog-cancel');
        const input = overlay.querySelector('#generic-dialog-input');

        backdrop.addEventListener('click', () => this.resolveGenericDialog(this.genericDialogCancelValue));
        cancelBtn.addEventListener('click', () => this.resolveGenericDialog(this.genericDialogCancelValue));
        okBtn.addEventListener('click', () => this.resolveGenericDialog(this.readGenericDialogOkValue()));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.resolveGenericDialog(this.readGenericDialogOkValue());
            }
        });

        this.genericDialogEl = overlay;
        return overlay;
    }

    readGenericDialogOkValue() {
        if (this.genericDialogMode === 'prompt') {
            const input = this.genericDialogEl.querySelector('#generic-dialog-input');
            return input.value;
        }
        return true;
    }

    isGenericDialogOpen() {
        return !!(this.genericDialogEl && !this.genericDialogEl.classList.contains('hidden'));
    }

    cancelGenericDialog() {
        if (this.isGenericDialogOpen()) {
            this.resolveGenericDialog(this.genericDialogCancelValue);
        }
    }

    resolveGenericDialog(value) {
        if (!this.genericDialogEl || this.genericDialogEl.classList.contains('hidden')) return;
        this.genericDialogEl.classList.add('hidden');
        const resolve = this.genericDialogResolve;
        this.genericDialogResolve = null;
        this.genericDialogMode = null;
        if (resolve) resolve(value);
    }

    openGenericDialog({ title = '', message = '', mode = 'confirm', okLabel = 'OK', cancelLabel = 'キャンセル', defaultValue = '', choices = [], cancelValue = null }) {
        const overlay = this.ensureGenericDialog();
        const titleEl = overlay.querySelector('#generic-dialog-title');
        const messageEl = overlay.querySelector('#generic-dialog-message');
        const input = overlay.querySelector('#generic-dialog-input');
        const choicesEl = overlay.querySelector('#generic-dialog-choices');
        const okBtn = overlay.querySelector('#generic-dialog-ok');
        const cancelBtn = overlay.querySelector('#generic-dialog-cancel');

        // Cancel any dialog currently open before opening a new one
        this.cancelGenericDialog();

        this.genericDialogMode = mode;
        this.genericDialogCancelValue = cancelValue;

        titleEl.textContent = title;
        titleEl.closest('.dialog-header').classList.toggle('hidden', !title);
        messageEl.textContent = message;
        messageEl.classList.toggle('hidden', !message);

        input.classList.toggle('hidden', mode !== 'prompt');
        choicesEl.classList.toggle('hidden', mode !== 'choice');
        okBtn.classList.toggle('hidden', mode === 'choice');
        cancelBtn.textContent = cancelLabel;
        okBtn.textContent = okLabel;

        choicesEl.innerHTML = '';
        if (mode === 'choice') {
            choices.forEach((label, index) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'generic-dialog-choice';
                item.textContent = label;
                item.addEventListener('click', () => this.resolveGenericDialog(index));
                choicesEl.appendChild(item);
            });
        }

        overlay.classList.remove('hidden');

        if (mode === 'prompt') {
            input.value = defaultValue || '';
            setTimeout(() => {
                input.focus();
                input.select();
            }, 0);
        }

        return new Promise((resolve) => {
            this.genericDialogResolve = resolve;
        });
    }

    async showConfirmDialog(message, { okLabel = 'OK', cancelLabel = 'キャンセル' } = {}) {
        const result = await this.openGenericDialog({
            message,
            mode: 'confirm',
            okLabel,
            cancelLabel,
            cancelValue: false
        });
        return result === true;
    }

    async showPromptDialog(message, defaultValue = '') {
        const result = await this.openGenericDialog({
            message,
            mode: 'prompt',
            defaultValue,
            cancelValue: null
        });
        return result;
    }

    async showChoiceDialog(title, choices) {
        const result = await this.openGenericDialog({
            title,
            mode: 'choice',
            choices,
            cancelValue: null
        });
        return result;
    }

    // Update breadcrumb
    updateBreadcrumb() {
        if (!this.currentItem) {
            this.elements.breadcrumb.innerHTML = '<span class="breadcrumb-item">ホーム</span>';
            return;
        }

        const path = [];
        let item = this.currentItem;
        
        while (item) {
            path.unshift(item);
            item = item.parentId ? this.findItemById(item.parentId) : null;
        }
        
        const breadcrumbHtml = path.map(item =>
            `<span class="breadcrumb-item">${this.escapeHtml(item.title || '無題')}</span>`
        ).join('');
        
        this.elements.breadcrumb.innerHTML = `<span class="breadcrumb-item">ホーム</span>${breadcrumbHtml}`;
    }

    // Core OutlineWriter methods (adapted from main script)
    addItem(parentId = null, index = -1) {
        const newItem = {
            id: this.data.nextId++,
            title: '新しい項目',
            content: '',
            children: [],
            expanded: true,
            parentId: parentId,
            hierarchyPath: '',
            level: 0
        };

        if (parentId === null) {
            if (index === -1) {
                this.data.items.push(newItem);
            } else {
                this.data.items.splice(index, 0, newItem);
            }
        } else {
            const parent = this.findItemById(parentId);
            if (parent) {
                if (index === -1) {
                    parent.children.push(newItem);
                } else {
                    parent.children.splice(index, 0, newItem);
                }
            }
        }

        this.updateHierarchyPaths();
        this.renderOutline();
        this.selectItem(newItem.id);
        this.elements.currentTitle.focus();
        this.elements.currentTitle.select();
        this.saveToHistory();
        this.scheduleAutoSave();
        this.showToast('項目を追加しました');
    }

    findItemById(id, items = this.data.items) {
        for (const item of items) {
            if (item.id === id) {
                return item;
            }
            const found = this.findItemById(id, item.children);
            if (found) {
                return found;
            }
        }
        return null;
    }

    findItemParent(id, items = this.data.items, parent = null) {
        for (const item of items) {
            if (item.id === id) {
                return parent;
            }
            const found = this.findItemParent(id, item.children, item);
            if (found !== null) {
                return found;
            }
        }
        return null;
    }

    selectItem(id) {
        const item = this.findItemById(id);
        if (!item) return;

        this.currentItem = item;
        this.elements.currentTitle.value = item.title;
        this.elements.currentContent.value = item.content;
        
        this.updateCharCount();
        this.updateActiveState();
        this.updateButtonStates();
        this.updateBreadcrumb();
        
        // Auto-close sidebar on mobile after selection
        if (window.innerWidth < 768) {
            this.closeSidebar();
        }
    }

    updateCurrentItem() {
        if (!this.currentItem) return;

        this.currentItem.title = this.elements.currentTitle.value;
        this.currentItem.content = this.elements.currentContent.value;

        this.updateItemElementLight(this.currentItem);
        this.updateBreadcrumb();
        this.scheduleHistorySave();
        this.scheduleAutoSave();
    }

    // サイドバーの該当項目のみを軽量に更新（全体再描画を避ける）
    // 見出し判定: 子要素を持つ項目を見出しとみなす（手動フラグは廃止）
    isHeading(item) {
        return Array.isArray(item.children) && item.children.length > 0;
    }

    updateItemElementLight(item) {
        const contentEl = document.querySelector(`.outline-item-content-mobile[data-id="${item.id}"]`);
        if (!contentEl) return;

        const titleEl = contentEl.querySelector('.outline-title-mobile');
        if (titleEl) {
            titleEl.textContent = item.title || '無題';
            titleEl.classList.toggle('heading', this.isHeading(item));
        }
    }

    updateActiveState() {
        document.querySelectorAll('.outline-item-content-mobile').forEach(el => {
            el.classList.remove('active', 'selected');
        });

        if (this.currentItem) {
            const activeEl = document.querySelector(`.outline-item-content-mobile[data-id="${this.currentItem.id}"]`);
            if (activeEl) {
                activeEl.classList.add('active');
            }
        }
    }

    updateButtonStates() {
        if (!this.currentItem) {
            this.elements.moveUpBtn.disabled = true;
            this.elements.moveDownBtn.disabled = true;
            this.elements.indentBtn.disabled = true;
            this.elements.outdentBtn.disabled = true;
            this.elements.deleteBtn.disabled = true;
            return;
        }

        this.elements.deleteBtn.disabled = false;
        
        const parent = this.findItemParent(this.currentItem.id);
        this.elements.outdentBtn.disabled = parent === null;
        
        const siblings = parent ? parent.children : (this.data && this.data.items ? this.data.items : []);
        const currentIndex = siblings.indexOf(this.currentItem);
        this.elements.indentBtn.disabled = currentIndex === 0;
        
        // Update move button states
        this.elements.moveUpBtn.disabled = currentIndex === 0;
        this.elements.moveDownBtn.disabled = currentIndex === siblings.length - 1;
    }

    renderOutline() {
        if (!this.data || !this.data.items) {
            return;
        }
        this.elements.outlineTree.innerHTML = '';
        this.renderItems(this.data.items, this.elements.outlineTree);
    }

    renderItems(items, container) {
        if (!items || !Array.isArray(items)) {
            return;
        }
        items.forEach(item => {
            const itemEl = this.createItemElement(item);
            container.appendChild(itemEl);
        });
    }

    createItemElement(item) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'outline-item-mobile';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'outline-item-content-mobile';
        contentDiv.setAttribute('data-id', item.id);
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'outline-toggle-mobile';
        toggleBtn.textContent = item.children.length > 0 ? (item.expanded ? '▼' : '▶') : '•';
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpanded(item.id);
        });

        const titleSpan = document.createElement('span');
        titleSpan.className = 'outline-title-mobile';
        if (this.isHeading(item)) {
            titleSpan.classList.add('heading');
        }
        titleSpan.textContent = item.title || '無題';

        contentDiv.appendChild(toggleBtn);
        contentDiv.appendChild(titleSpan);

        contentDiv.addEventListener('click', (e) => {
            this.selectItem(item.id);
        });

        // Add touch gesture for item operations
        this.addItemTouchGestures(contentDiv, item);

        itemDiv.appendChild(contentDiv);

        if (item.children.length > 0) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'outline-children-mobile';
            if (!item.expanded) {
                childrenDiv.classList.add('collapsed');
            }
            this.renderItems(item.children, childrenDiv);
            itemDiv.appendChild(childrenDiv);
        }

        return itemDiv;
    }

    addItemTouchGestures(element, item) {
        let touchStartTime = 0;
        let touchStartPos = { x: 0, y: 0 };
        
        element.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            touchStartPos.x = e.touches[0].clientX;
            touchStartPos.y = e.touches[0].clientY;
        }, { passive: true });
        
        element.addEventListener('touchend', (e) => {
            const touchDuration = Date.now() - touchStartTime;
            const touchEndPos = {
                x: e.changedTouches[0].clientX,
                y: e.changedTouches[0].clientY
            };
            
            const distance = Math.sqrt(
                Math.pow(touchEndPos.x - touchStartPos.x, 2) + 
                Math.pow(touchEndPos.y - touchStartPos.y, 2)
            );
            
            // Long press detection
            if (touchDuration > 500 && distance < 10) {
                e.preventDefault();
                this.showItemContextMenu(item, e.changedTouches[0]);
            }
        }, { passive: false });
    }

    showItemContextMenu(item, touch) {
        // Simple context menu for mobile - could be expanded
        // For now, just select the item on long press
        this.selectItem(item.id);
        this.showToast('長押しで選択しました');
    }

    toggleExpanded(id) {
        const item = this.findItemById(id);
        if (item) {
            item.expanded = !item.expanded;
            this.renderOutline();
            this.updateActiveState();
            this.scheduleAutoSave();
        }
    }

    expandAll() {
        this.setAllExpanded(true);
        this.showToast('全て展開しました');
    }

    collapseAll() {
        this.setAllExpanded(false);
        this.showToast('全て折り畳みました');
    }

    setAllExpanded(expanded, items = this.data.items) {
        items.forEach(item => {
            item.expanded = expanded;
            this.setAllExpanded(expanded, item.children);
        });
        this.renderOutline();
        this.updateActiveState();
        this.scheduleAutoSave();
    }

    updateCharCount() {
        const content = this.elements.currentContent.value;
        const count = content.length;
        this.elements.charCount.textContent = count;
        
        const totalCount = this.getTotalCharCount();
        this.elements.totalCharCount.textContent = totalCount;
    }

    getTotalCharCount() {
        let total = 0;
        if (this.data && this.data.items) {
            this.countChars(this.data.items, (count) => {
                total += count;
            });
        }
        return total;
    }

    // ツールバー表示/非表示機能
    hideToolbar() {
        this.toolbarVisible = false;
        this.elements.bottomToolbar.style.transform = 'translateY(100%)';
        this.elements.bottomToolbar.style.transition = 'transform 0.3s ease';
        
        // メニューのツールバー表示ボタンを有効化
        this.elements.showToolbarBtn.style.display = 'block';
        const showToolbarSection = this.elements.showToolbarBtn.closest('.menu-section');
        if (showToolbarSection) {
            showToolbarSection.style.display = '';
        }

        this.closeMenu();
        localStorage.setItem('toolbar-visible', 'false');
    }

    showToolbar() {
        this.toolbarVisible = true;
        this.elements.bottomToolbar.style.transform = 'translateY(0)';
        this.elements.bottomToolbar.style.transition = 'transform 0.3s ease';
        
        // メニューのツールバー表示ボタンを無効化
        this.elements.showToolbarBtn.style.display = 'none';
        const showToolbarSection = this.elements.showToolbarBtn.closest('.menu-section');
        if (showToolbarSection) {
            showToolbarSection.style.display = 'none';
        }

        this.closeMenu();
        localStorage.setItem('toolbar-visible', 'true');
    }

    // ツールバー状態の初期化
    initializeToolbarState() {
        const saved = localStorage.getItem('toolbar-visible');
        if (saved === 'false') {
            this.hideToolbar();
        } else {
            this.showToolbar();
        }
    }

    countChars(items, callback) {
        items.forEach(item => {
            callback(item.content.length);
            this.countChars(item.children, callback);
        });
    }

    addItemAfterCurrent() {
        if (this.currentItem) {
            this.addItemAfterSpecific(this.currentItem);
        } else {
            this.addItem();
        }
    }

    addItemAfterSpecific(targetItem) {
        const parent = this.findItemParent(targetItem.id);
        const siblings = parent ? parent.children : this.data.items;
        const targetIndex = siblings.indexOf(targetItem);
        
        const newItem = {
            id: this.data.nextId++,
            title: '新しい項目',
            content: '',
            children: [],
            expanded: true,
            parentId: parent ? parent.id : null,
            hierarchyPath: '',
            level: 0
        };

        siblings.splice(targetIndex + 1, 0, newItem);

        this.updateHierarchyPaths();
        this.renderOutline();
        this.selectItem(newItem.id);
        this.elements.currentTitle.focus();
        this.elements.currentTitle.select();
        this.saveToHistory();
        this.scheduleAutoSave();
        this.showToast('項目を追加しました');
    }

    indentItem() {
        if (!this.currentItem) return;
        
        const parent = this.findItemParent(this.currentItem.id);
        const siblings = parent ? parent.children : this.data.items;
        const currentIndex = siblings.indexOf(this.currentItem);
        
        if (currentIndex > 0) {
            const newParent = siblings[currentIndex - 1];
            siblings.splice(currentIndex, 1);
            newParent.children.push(this.currentItem);
            this.currentItem.parentId = newParent.id;
            newParent.expanded = true;
            
            this.updateHierarchyPaths();
            this.renderOutline();
            this.selectItem(this.currentItem.id);
            this.saveToHistory();
            this.scheduleAutoSave();
            this.showToast('インデントしました');
        }
    }

    outdentItem() {
        if (!this.currentItem) return;
        
        const parent = this.findItemParent(this.currentItem.id);
        if (!parent) return;
        
        const grandParent = this.findItemParent(parent.id);
        const parentSiblings = grandParent ? grandParent.children : this.data.items;
        const parentIndex = parentSiblings.indexOf(parent);
        
        parent.children.splice(parent.children.indexOf(this.currentItem), 1);
        parentSiblings.splice(parentIndex + 1, 0, this.currentItem);
        this.currentItem.parentId = grandParent ? grandParent.id : null;
        
        this.updateHierarchyPaths();
        this.renderOutline();
        this.selectItem(this.currentItem.id);
        this.saveToHistory();
        this.scheduleAutoSave();
        this.showToast('アウトデントしました');
    }

    async deleteCurrentItem() {
        if (!this.currentItem) return;

        const ok = await this.showConfirmDialog('この項目を削除しますか？');
        if (!ok) return;
        
        const parent = this.findItemParent(this.currentItem.id);
        const siblings = parent ? parent.children : this.data.items;
        const index = siblings.indexOf(this.currentItem);
        
        siblings.splice(index, 1);
        
        this.currentItem = null;
        this.elements.currentTitle.value = '';
        this.elements.currentContent.value = '';
        
        this.updateHierarchyPaths();
        this.renderOutline();
        this.updateCharCount();
        this.updateButtonStates();
        this.updateBreadcrumb();
        this.saveToHistory();
        this.scheduleAutoSave();
        this.showToast('項目を削除しました');
    }

    moveUp() {
        if (!this.currentItem) return;
        
        const parent = this.findItemParent(this.currentItem.id);
        const siblings = parent ? parent.children : this.data.items;
        const currentIndex = siblings.indexOf(this.currentItem);
        
        if (currentIndex > 0) {
            siblings[currentIndex] = siblings[currentIndex - 1];
            siblings[currentIndex - 1] = this.currentItem;
            
            this.updateHierarchyPaths();
            this.renderOutline();
            this.selectItem(this.currentItem.id);
            this.updateButtonStates();
            this.saveToHistory();
            this.scheduleAutoSave();
            this.showToast('項目を上に移動しました');
        }
    }

    moveDown() {
        if (!this.currentItem) return;
        
        const parent = this.findItemParent(this.currentItem.id);
        const siblings = parent ? parent.children : this.data.items;
        const currentIndex = siblings.indexOf(this.currentItem);
        
        if (currentIndex < siblings.length - 1) {
            siblings[currentIndex] = siblings[currentIndex + 1];
            siblings[currentIndex + 1] = this.currentItem;
            
            this.updateHierarchyPaths();
            this.renderOutline();
            this.selectItem(this.currentItem.id);
            this.updateButtonStates();
            this.saveToHistory();
            this.scheduleAutoSave();
            this.showToast('項目を下に移動しました');
        }
    }

    // Include all hierarchy management methods from main script
    updateHierarchyPaths() {
        if (!this.data || !this.data.items) {
            return;
        }
        this.updateItemHierarchy(this.data.items, '', 0, null);
    }

    updateItemHierarchy(items, parentPath, level, parentId) {
        if (!items || !Array.isArray(items)) {
            return;
        }
        items.forEach((item, index) => {
            const position = index + 1;
            const currentPath = parentPath ? `${parentPath}.${position}` : `${position}`;

            item.hierarchyPath = currentPath;
            item.level = level;
            item.parentId = parentId;

            if (item.children && item.children.length > 0) {
                this.updateItemHierarchy(item.children, currentPath, level + 1, item.id);
            }
        });
    }

    // History management
    saveToHistory() {
        clearTimeout(this.historyTimer);

        const currentState = JSON.parse(JSON.stringify(this.data));
        
        if (this.historyIndex < this.history.length - 1) {
            this.history.splice(this.historyIndex + 1);
        }
        
        this.history.push(currentState);
        
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
        
        this.updateUndoRedoButtons();
    }

    undo() {
        clearTimeout(this.historyTimer);
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.data = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.currentItem = null;
            this.elements.currentTitle.value = '';
            this.elements.currentContent.value = '';
            this.renderOutline();
            this.updateCharCount();
            this.updateButtonStates();
            this.updateBreadcrumb();
            this.updateUndoRedoButtons();
            this.scheduleAutoSave();
            this.showToast('元に戻しました');
        }
    }

    redo() {
        clearTimeout(this.historyTimer);
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.data = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.currentItem = null;
            this.elements.currentTitle.value = '';
            this.elements.currentContent.value = '';
            this.renderOutline();
            this.updateCharCount();
            this.updateButtonStates();
            this.updateBreadcrumb();
            this.updateUndoRedoButtons();
            this.scheduleAutoSave();
            this.showToast('やり直しました');
        }
    }

    updateUndoRedoButtons() {
        if (this.elements.undoBtn) {
            this.elements.undoBtn.disabled = this.historyIndex <= 0;
        }
        if (this.elements.redoBtn) {
            this.elements.redoBtn.disabled = this.historyIndex >= this.history.length - 1;
        }
    }

    // 入力が落ち着いてから履歴に保存する（キー入力ごとの記録を防ぐ）
    scheduleHistorySave() {
        clearTimeout(this.historyTimer);
        this.historyTimer = setTimeout(() => {
            this.saveToHistory();
        }, 500);
    }

    // Data management
    saveData() {
        try {
            localStorage.setItem('outlinewriter-data', JSON.stringify(this.data));
            localStorage.setItem('outlinewriter-data-timestamp', new Date().toLocaleString('ja-JP'));
            localStorage.setItem('outlinewriter-data-timestamp-iso', new Date().toISOString());
            this.showToast('データを保存しました');
        } catch (e) {
            this.showToast('保存に失敗しました');
        }
    }

    // 変更が落ち着いてから静かにローカル保存する（トースト表示なし）
    scheduleAutoSave() {
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            try {
                localStorage.setItem('outlinewriter-data', JSON.stringify(this.data));
                localStorage.setItem('outlinewriter-data-timestamp', new Date().toLocaleString('ja-JP'));
                localStorage.setItem('outlinewriter-data-timestamp-iso', new Date().toISOString());
            } catch (e) {
                console.error('自動保存に失敗しました:', e);
            }
        }, 800);
    }

    loadData() {
        try {
            const saved = localStorage.getItem('outlinewriter-data');
            if (saved) {
                this.data = this.normalizeData(JSON.parse(saved));
                this.currentItem = null;
                this.elements.currentTitle.value = '';
                this.elements.currentContent.value = '';
            }
            this.loadBackups();
        } catch (e) {
            this.showToast('読み込みに失敗しました');
        }
    }

    // 読み込んだデータの構造を検証・修復する
    normalizeData(data) {
        if (!data || typeof data !== 'object') {
            data = {};
        }
        if (!Array.isArray(data.items)) {
            data.items = [];
        }

        let maxId = 0;
        const normalizeItems = (items) => {
            items.forEach(item => {
                if (typeof item.id !== 'number' || isNaN(item.id)) {
                    item.id = ++maxId;
                }
                if (item.id > maxId) {
                    maxId = item.id;
                }
                if (typeof item.title !== 'string') {
                    item.title = item.title != null ? String(item.title) : '';
                }
                if (typeof item.content !== 'string') {
                    item.content = item.content != null ? String(item.content) : '';
                }
                delete item.isHeading; // 旧データの手動フラグは破棄（見出しは子要素の有無で自動判定）
                item.expanded = item.expanded !== false;
                if (!Array.isArray(item.children)) {
                    item.children = [];
                }
                normalizeItems(item.children);
            });
        };
        normalizeItems(data.items);

        if (typeof data.nextId !== 'number' || isNaN(data.nextId) || data.nextId <= maxId) {
            data.nextId = maxId + 1;
        }

        return data;
    }

    // File operations
    loadFileFromDialog() {
        this.elements.loadFileInput.click();
        this.closeMenu();
    }

    loadFromFile(event) {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loadedData = JSON.parse(e.target.result);
                let data;
                
                if (loadedData.data) {
                    data = loadedData.data;
                } else if (loadedData.items) {
                    data = loadedData;
                } else {
                    throw new Error('Invalid data structure');
                }
                
                if (!data.items || !Array.isArray(data.items)) {
                    throw new Error('Invalid items structure');
                }
                
                this.data = this.normalizeData(data);
                this.currentItem = null;
                this.elements.currentTitle.value = '';
                this.elements.currentContent.value = '';
                this.updateHierarchyPaths();
                this.renderOutline();
                this.updateCharCount();
                this.updateButtonStates();
                this.updateBreadcrumb();
                this.scheduleAutoSave();
                this.showToast('ファイルを読み込みました');
            } catch (error) {
                console.error('File load error:', error);
                this.showToast('ファイルの読み込みに失敗しました: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    loadMarkdownFromDialog() {
        this.elements.loadMarkdownInput.click();
        this.closeMenu();
    }

    loadFromMarkdownFile(event) {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const markdownContent = e.target.result;
                const convertedData = this.parseMarkdownToOutlineWriter(markdownContent);
                
                this.data = this.normalizeData(convertedData);
                this.currentItem = null;
                this.elements.currentTitle.value = '';
                this.elements.currentContent.value = '';
                this.updateHierarchyPaths();
                this.renderOutline();
                this.updateCharCount();
                this.updateButtonStates();
                this.updateBreadcrumb();
                this.scheduleAutoSave();
                this.showToast('Markdownファイルを読み込みました');
            } catch (error) {
                this.showToast('Markdownファイルの読み込みに失敗しました');
            }
        };
        reader.readAsText(file);
    }

    exportAsMarkdown() {
        const markdown = this.generateMarkdownExport(this.data.items, 0);
        this.downloadFileWithName(markdown, 'text/markdown', 'outline.md');
        this.closeMenu();
    }

    exportAsText() {
        const text = this.generateTextExport(this.data.items, 0);
        this.downloadFileWithName(text, 'text/plain', 'outline.txt');
        this.closeMenu();
    }

    createExportData() {
        return {
            data: this.data,
            timestamp: new Date().toLocaleString('ja-JP'),
            version: '2.2'
        };
    }

    exportAsJSON() {
        const jsonData = this.createExportData();
        const jsonString = JSON.stringify(jsonData, null, 2);
        this.downloadFileWithName(jsonString, 'application/json', 'outline.json');
        this.closeMenu();
    }

    async downloadFileWithName(content, mimeType, defaultName) {
        let filename = await this.showPromptDialog('ファイル名を入力してください:', defaultName);
        if (filename) {
            filename = filename.trim();
        }
        if (filename) {
            if (filename.indexOf('.') === -1) {
                const dotIndex = defaultName.lastIndexOf('.');
                const ext = dotIndex !== -1 ? defaultName.slice(dotIndex) : '';
                filename += ext;
            }
            this.downloadFile(filename, content, mimeType);
            this.showToast('ファイルをダウンロードしました');
        }
    }

    downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Include markdown parsing methods from main script
    parseMarkdownToOutlineWriter(markdownContent) {
        const data = {
            items: [],
            nextId: 1
        };

        const lines = markdownContent.split('\n');
        
        const hasHierarchyComments = lines.some(line => 
            line.trim().match(/^<!--\s*hierarchy:\s*([\d.]+)\s+level:\s*(\d+)\s*-->$/)
        );

        if (hasHierarchyComments) {
            return this.parseMarkdownWithHierarchy(markdownContent, data);
        } else {
            return this.parseMarkdownTraditional(markdownContent, data);
        }
    }

    parseMarkdownWithHierarchy(markdownContent, data) {
        const lines = markdownContent.split('\n');
        const hierarchyMap = new Map();
        let currentItem = null;
        let currentContent = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            const hierarchyMatch = trimmedLine.match(/^<!--\s*hierarchy:\s*([\d.]+)\s+level:\s*(\d+)\s*-->$/);

            if (hierarchyMatch) {
                if (currentItem && currentContent.length > 0) {
                    currentItem.content = currentContent.join('\n').trim();
                }
                currentContent = [];

                const hierarchyPath = hierarchyMatch[1];
                const level = parseInt(hierarchyMatch[2]);
                
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1].trim();
                    const nextHeadingMatch = nextLine.match(/^(#{1,6})\s+(.+)$/);
                    const nextListMatch = nextLine.match(/^(\s*)-\s+(.+)$/);
                    
                    if (nextHeadingMatch || nextListMatch) {
                        const title = nextHeadingMatch ? nextHeadingMatch[2] : nextListMatch[2];
                        const item = {
                            id: data.nextId++,
                            title: title,
                            content: '',
                            children: [],
                            expanded: true,
                            parentId: null,
                            hierarchyPath: hierarchyPath,
                            level: level
                        };

                        hierarchyMap.set(hierarchyPath, item);
                        currentItem = item;
                        i++; // 次の行をスキップ
                    }
                }
            } else if (trimmedLine === '') {
                if (currentContent.length > 0) {
                    currentContent.push('');
                }
            } else if (trimmedLine && !trimmedLine.startsWith('<!--')) {
                currentContent.push(line.replace(/^\s+/, ''));
            }
        }

        if (currentItem && currentContent.length > 0) {
            currentItem.content = currentContent.join('\n').trim();
        }

        this.reconstructHierarchy(data, hierarchyMap);
        return data;
    }

    parseMarkdownTraditional(markdownContent, data) {
        const lines = markdownContent.split('\n');
        const stack = [];
        let currentContent = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
            const listMatch = trimmedLine.match(/^(\s*)-\s+(.+)$/);

            if (headingMatch) {
                this.addContentToCurrentItem(stack, currentContent);
                currentContent = [];

                const level = headingMatch[1].length;
                const title = headingMatch[2];
                
                const item = {
                    id: data.nextId++,
                    title: title,
                    content: '',
                    _fromHash: true,
                    children: [],
                    expanded: true,
                    parentId: null,
                    hierarchyPath: '',
                    level: level - 1
                };

                while (stack.length >= level) {
                    stack.pop();
                }

                if (stack.length > 0) {
                    item.parentId = stack[stack.length - 1].id;
                    stack[stack.length - 1].children.push(item);
                } else {
                    data.items.push(item);
                }

                stack.push(item);
            } else if (listMatch) {
                this.addContentToCurrentItem(stack, currentContent);
                currentContent = [];

                const indentSpaces = listMatch[1].length;
                const title = listMatch[2];
                const item = {
                    id: data.nextId++,
                    title: title,
                    content: '',
                    children: [],
                    expanded: true,
                    parentId: null,
                    hierarchyPath: '',
                    level: 0
                };

                // リスト項目の階層判定を改善
                while (stack.length > 1 && !stack[stack.length - 1]._fromHash) {
                    const lastItem = stack[stack.length - 1];
                    const lastIndent = lastItem._tempIndent || 0;
                    if (lastIndent >= indentSpaces) {
                        stack.pop();
                    } else {
                        break;
                    }
                }

                if (stack.length > 0) {
                    item.parentId = stack[stack.length - 1].id;
                    stack[stack.length - 1].children.push(item);
                } else {
                    data.items.push(item);
                }

                item._tempIndent = indentSpaces;
                stack.push(item);
            } else if (trimmedLine === '') {
                if (currentContent.length > 0) {
                    currentContent.push('');
                }
            } else if (trimmedLine) {
                currentContent.push(line.replace(/^\s+/, ''));
            }
        }

        this.addContentToCurrentItem(stack, currentContent);
        
        // 一時的なインデント情報を削除
        this.cleanupTempData(data.items);

        return data;
    }

    cleanupTempData(items) {
        items.forEach(item => {
            delete item._tempIndent;
            delete item._fromHash;
            if (item.children) {
                this.cleanupTempData(item.children);
            }
        });
    }

    reconstructHierarchy(data, hierarchyMap) {
        // 階層パスでソート
        const sortedPaths = Array.from(hierarchyMap.keys()).sort((a, b) => {
            const pathA = a.split('.').map(n => parseInt(n));
            const pathB = b.split('.').map(n => parseInt(n));
            
            for (let i = 0; i < Math.max(pathA.length, pathB.length); i++) {
                const numA = pathA[i] || 0;
                const numB = pathB[i] || 0;
                if (numA !== numB) {
                    return numA - numB;
                }
            }
            return 0;
        });

        // 親子関係を再構築
        sortedPaths.forEach(path => {
            const item = hierarchyMap.get(path);
            const pathParts = path.split('.');
            
            if (pathParts.length === 1) {
                // トップレベル項目
                data.items.push(item);
            } else {
                // 子項目 - 親のパスを計算
                const parentPath = pathParts.slice(0, -1).join('.');
                const parent = hierarchyMap.get(parentPath);
                
                if (parent) {
                    item.parentId = parent.id;
                    parent.children.push(item);
                } else {
                    // 親が見つからない場合はトップレベルに追加
                    data.items.push(item);
                }
            }
        });
    }

    addContentToCurrentItem(stack, currentContent) {
        if (currentContent.length > 0 && stack.length > 0) {
            const currentItem = stack[stack.length - 1];
            const contentText = currentContent.join('\n').trim();
            if (contentText) {
                if (currentItem.content) {
                    currentItem.content += '\n\n' + contentText;
                } else {
                    currentItem.content = contentText;
                }
            }
        }
    }

    // includeMeta=false で階層コメントを省いた閲覧用Markdownを生成する
    generateMarkdownExport(items, level, includeMeta = true, parentTitle = null) {
        let result = '';
        let afterHeading = false;
        items.forEach(item => {
            if (includeMeta) {
                result += `<!-- hierarchy: ${item.hierarchyPath} level: ${item.level} -->\n`;
            }
            
            if (this.isHeading(item)) {
                const headingLevel = Math.min(level + 1, 6);
                const hashes = '#'.repeat(headingLevel);
                // 閲覧用: 直前がリストの場合に見出しが結合されないよう空行を挟む
                if (!includeMeta && result && !result.endsWith('\n\n')) result += '\n';
                result += `${hashes} ${item.title}\n\n`;
                
                if (item.content.trim()) {
                    // 閲覧用は行末の2スペース（改行）で行を保つ。Googleドキュメント変換時に1段落へ結合されるのを防ぐ
                    const contentLines = item.content.split('\n').filter(line => line.trim());
                    const lineEnd = includeMeta ? '\n' : '  \n';
                    result += contentLines.join(lineEnd) + '\n\n';
                }
                
                if (item.children.length > 0) {
                    result += this.generateMarkdownExport(item.children, level + 1, includeMeta, item.title);
                }
                afterHeading = true;
            } else {
                // 閲覧用: 下位見出しの後に続く項目が下位見出しに属して見えないよう、親見出しを「続き」として再掲する
                if (!includeMeta && afterHeading) {
                    if (!result.endsWith('\n\n')) result += '\n';
                    result += parentTitle !== null
                        ? `${'#'.repeat(Math.min(level, 6))} ${parentTitle}（続き）\n\n`
                        : '---\n\n';
                    afterHeading = false;
                }
                // 閲覧用: 葉は常に見出し直下のリストなので字下げしない（4スペース以上だとコードブロック扱いになる）
                const indent = includeMeta ? '  '.repeat(level) : '';
                const contentLines = item.content.split('\n').filter(line => line.trim());
                // 閲覧用は行末の2スペースで項目名と本文を別の行に保つ
                const lineEnd = includeMeta ? '\n' : '  \n';
                result += `${indent}- ${item.title}${contentLines.length ? lineEnd : '\n'}`;
                result += contentLines.map(line => `${indent}  ${line}`).join(lineEnd);
                if (contentLines.length) result += '\n';
                
                if (item.children.length > 0) {
                    result += this.generateMarkdownExport(item.children, level + 1, includeMeta, item.title);
                }
            }
        });
        return result;
    }

    generateTextExport(items, level) {
        let result = '';
        items.forEach(item => {
            const indent = '  '.repeat(level);
            const prefix = this.isHeading(item) ? '■ ' : '・ ';
            result += `${indent}${prefix}${item.title}\n`;
            if (item.content.trim()) {
                const contentLines = item.content.split('\n');
                contentLines.forEach(line => {
                    if (line.trim()) {
                        result += `${indent}  ${line}\n`;
                    }
                });
            }
            if (item.children.length > 0) {
                result += this.generateTextExport(item.children, level + 1);
            }
        });
        return result;
    }

    // Backup management
    createBackup() {
        const timestamp = new Date().toLocaleString('ja-JP');
        const backup = {
            timestamp: timestamp,
            data: JSON.parse(JSON.stringify(this.data))
        };
        
        this.backups.push(backup);

        this.trimBackups();

        try {
            localStorage.setItem('outlinewriter-backups', JSON.stringify(this.backups));
            this.showToast(`バックアップを作成しました`);
        } catch (e) {
            this.showToast('バックアップの作成に失敗しました');
        }
        this.closeMenu();
    }

    // 上限を超えた場合、自動バックアップを優先的に削除して手動バックアップを守る
    trimBackups() {
        while (this.backups.length > this.maxBackups) {
            const autoIndex = this.backups.findIndex(b => typeof b.timestamp === 'string' && b.timestamp.startsWith('自動バックアップ'));
            if (autoIndex !== -1) {
                this.backups.splice(autoIndex, 1);
            } else {
                this.backups.shift();
            }
        }
    }

    async showBackupDialog() {
        if (this.backups.length === 0) {
            this.showToast('利用可能なバックアップがありません');
            return;
        }

        // Newest first
        const orderedIndexes = this.backups.map((_, i) => i).reverse();
        const labels = orderedIndexes.map((originalIndex, displayIndex) =>
            `${displayIndex + 1}. ${this.backups[originalIndex].timestamp}`
        );

        const choice = await this.showChoiceDialog('復元するバックアップを選択', labels);
        this.closeMenu();

        if (choice !== null) {
            const originalIndex = orderedIndexes[choice];
            await this.restoreFromBackup(originalIndex);
        }
    }

    async restoreFromBackup(index) {
        if (index < 0 || index >= this.backups.length) return;

        const ok = await this.showConfirmDialog('現在のデータは失われます。本当に復元しますか？');
        if (!ok) return;
        
        this.data = this.normalizeData(JSON.parse(JSON.stringify(this.backups[index].data)));
        this.currentItem = null;
        this.elements.currentTitle.value = '';
        this.elements.currentContent.value = '';
        this.renderOutline();
        this.updateCharCount();
        this.updateButtonStates();
        this.updateBreadcrumb();
        this.saveToHistory();
        this.scheduleAutoSave();

        this.showToast('バックアップから復元しました');
    }

    loadBackups() {
        try {
            const saved = localStorage.getItem('outlinewriter-backups');
            if (saved) {
                this.backups = JSON.parse(saved);
            }
        } catch (e) {
            console.error('バックアップの読み込みに失敗しました:', e);
        }
    }

    startAutoBackup() {
        setInterval(() => {
            this.createAutoBackup();
        }, 5 * 60 * 1000);
    }

    createAutoBackup() {
        if (!this.data || !this.data.items || this.data.items.length === 0) return;
        
        const timestamp = new Date().toLocaleString('ja-JP');
        const backup = {
            timestamp: `自動バックアップ - ${timestamp}`,
            data: JSON.parse(JSON.stringify(this.data))
        };
        
        this.backups.push(backup);

        this.trimBackups();

        try {
            localStorage.setItem('outlinewriter-backups', JSON.stringify(this.backups));
        } catch (e) {
            console.error('自動バックアップに失敗しました:', e);
        }
    }

    // Google API initialization
    async initializeGoogleAPI() {
        console.log('Google API初期化処理を開始...');

        try {
            if (typeof GOOGLE_CONFIG === 'undefined') {
                console.error('GOOGLE_CONFIG が定義されていません。config.jsが読み込まれているか確認してください。');
                return;
            }

            if (!validateGoogleConfig()) {
                console.warn('Google Drive機能は利用できません。config.jsを設定してください。');
                console.log(SETUP_INSTRUCTIONS);
                return;
            }

            // Google Identity Services (GIS) が読み込まれるのを待つ
            await this.waitForGoogleAPIs();

            // Google Identity Services を初期化（Drive REST呼び出しは fetch を直接使用するため gapi クライアントは不要）
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CONFIG.CLIENT_ID,
                scope: GOOGLE_CONFIG.SCOPES,
                callback: async (response) => {
                    if (response.error) {
                        console.error('OAuth エラー:', response.error);
                        if (this.pendingTokenResolve) {
                            const resolve = this.pendingTokenResolve;
                            this.pendingTokenResolve = null;
                            clearTimeout(this.pendingTokenTimeout);
                            resolve(false);
                            return;
                        }
                        if (this.pendingAutoSync) {
                            this.pendingAutoSync = false;
                            console.log('自動同期用のサイレントトークン取得に失敗しました（ユーザー操作が必要です）');
                            return;
                        }
                        this.showToast(`認証に失敗しました: ${response.error}`);
                        return;
                    }

                    this.accessToken = response.access_token;
                    this.tokenExpiresAt = Date.now() + (response.expires_in ? (response.expires_in - 60) * 1000 : 55 * 60 * 1000);

                    if (this.pendingTokenResolve) {
                        const resolve = this.pendingTokenResolve;
                        this.pendingTokenResolve = null;
                        clearTimeout(this.pendingTokenTimeout);
                        resolve(true);
                        return;
                    }

                    if (this.pendingAutoSync) {
                        this.pendingAutoSync = false;
                        // サイレント同期でもログイン状態としてUIに反映する（トーストは出さない）
                        await this.onSignInSuccess(true);
                        this.autoSyncFromDrive();
                        return;
                    }

                    this.onSignInSuccess();
                },
                error_callback: () => {
                    if (this.pendingTokenResolve) {
                        const resolve = this.pendingTokenResolve;
                        this.pendingTokenResolve = null;
                        clearTimeout(this.pendingTokenTimeout);
                        resolve(false);
                        return;
                    }
                    if (this.pendingAutoSync) {
                        this.pendingAutoSync = false;
                        console.log('自動同期用のサイレントトークン取得に失敗しました');
                    }
                }
            });

            this.gapiInitialized = true;
            console.log('Google API初期化が完全に完了しました');

            // 自動同期設定が有効な場合、サイレントにトークンを取得してDriveと同期する
            if (this.driveConfig.syncEnabled && this.driveConfig.fileId) {
                try {
                    this.pendingAutoSync = true;
                    this.tokenClient.requestAccessToken({ prompt: '' });
                } catch (autoSyncError) {
                    this.pendingAutoSync = false;
                    console.log('自動同期の開始に失敗しました:', autoSyncError);
                }
            }

        } catch (error) {
            console.error('Google API初期化エラー:', error);
            this.gapiInitialized = false;
        }
    }

    async initializeGoogleAPIWithRetry(maxRetries = 3, retryDelay = 2000) {
        let attempt = 1;

        while (attempt <= maxRetries) {
            try {
                console.log(`Google API 初期化試行 ${attempt}/${maxRetries}`);
                await this.initializeGoogleAPI();

                // 成功した場合は終了
                if (this.gapiInitialized) {
                    console.log('Google API 初期化が成功しました');
                    return;
                }

                // gapiInitialized が false の場合は失敗と判断
                throw new Error('初期化は完了したが、gapiInitialized が false です');

            } catch (error) {
                console.error(`Google API 初期化試行 ${attempt} 失敗:`, error.message);

                if (attempt === maxRetries) {
                    console.error('Google API 初期化の最大試行回数に達しました。Google Drive機能は利用できません。');
                    return;
                }

                console.log(`${retryDelay}ms 後に再試行します...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));

                // 次の試行では待機時間を増加
                retryDelay = Math.min(retryDelay * 1.5, 10000);
                attempt++;
            }
        }
    }

    async waitForGoogleAPIs() {
        // google.accounts (GIS) の読み込みを待つ
        let attempts = 0;
        const maxAttempts = 100; // 10秒まで待機

        while (attempts < maxAttempts) {
            // 詳細なステータスを20回ごとに表示
            if (attempts % 20 === 0) {
                const tokenClientStatus = typeof google !== 'undefined' && google.accounts && google.accounts.oauth2 &&
                                          typeof google.accounts.oauth2.initTokenClient === 'function' ? 'loaded' : 'not loaded';
                console.log(`Google API 読み込み状況 (${attempts + 1}/${maxAttempts}): initTokenClient=${tokenClientStatus}`);
            }

            if (typeof google !== 'undefined' &&
                google.accounts &&
                google.accounts.oauth2 &&
                typeof google.accounts.oauth2.initTokenClient === 'function') {
                console.log('Google API libraries loaded successfully');
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        throw new Error('Google API libraries failed to load after 10 seconds');
    }

    // Google Drive integration
    loadConfig() {
        try {
            const saved = localStorage.getItem('outlinewriter-drive-config');
            if (saved) {
                const savedConfig = JSON.parse(saved);
                // ファイル関連の設定のみを読み込み（API設定は不要）
                this.driveConfig.fileName = savedConfig.fileName || this.driveConfig.fileName;
                this.driveConfig.fileId = savedConfig.fileId || this.driveConfig.fileId;
                this.driveConfig.docFileId = savedConfig.docFileId || '';
                this.driveConfig.lastSync = savedConfig.lastSync || this.driveConfig.lastSync;
                this.driveConfig.syncEnabled = savedConfig.syncEnabled || false;
                this.updateDriveStatus();
            }
        } catch (e) {
            console.error('Drive設定の読み込みに失敗しました:', e);
        }
    }

    saveConfig() {
        try {
            // ファイル関連の設定のみを保存（API設定は不要）
            const configToSave = {
                fileName: this.driveConfig.fileName,
                fileId: this.driveConfig.fileId,
                docFileId: this.driveConfig.docFileId,
                lastSync: this.driveConfig.lastSync,
                syncEnabled: this.driveConfig.syncEnabled
            };
            localStorage.setItem('outlinewriter-drive-config', JSON.stringify(configToSave));
        } catch (e) {
            console.error('Drive設定の保存に失敗しました:', e);
        }
    }

    // アクセストークンが有効かどうか
    isTokenValid() {
        return !!this.accessToken && !!this.tokenExpiresAt && Date.now() < this.tokenExpiresAt;
    }

    // トークンが有効ならそのまま、期限切れならサイレント更新を試みる（ユーザー操作なしで解決するPromiseを返す）
    ensureToken() {
        return new Promise((resolve) => {
            if (this.isTokenValid()) {
                resolve(true);
                return;
            }
            if (!this.tokenClient) {
                resolve(false);
                return;
            }
            this.pendingTokenResolve = resolve;
            this.pendingTokenTimeout = setTimeout(() => {
                this.pendingTokenResolve = null;
                resolve(false);
            }, 10000);
            this.tokenClient.requestAccessToken({ prompt: '' });
        });
    }

    // 再ログインを促すトースト表示と認証状態のクリア
    handleAuthExpired() {
        this.accessToken = null;
        this.tokenExpiresAt = null;
        this.driveConfig.connected = false;
        this.updateAuthStatus();
        this.updateDriveStatus();
        this.showToast('認証の有効期限が切れました。再ログインしてください');
        // 同期ダイアログが開いていれば閉じ、ログインボタンのあるDrive設定ダイアログへ遷移する
        this.closeSyncDialog();
        if (this.elements.driveSetupDialog.classList.contains('hidden')) {
            this.openDriveSetupDialog();
        }
    }

    // Drive REST API呼び出し用の共通ヘルパー（fetchのラッパー）
    async driveFetch(url, options = {}) {
        const headers = Object.assign({}, options.headers, {
            'Authorization': `Bearer ${this.accessToken}`
        });

        const response = await fetch(url, Object.assign({}, options, { headers }));

        if (response.status === 401) {
            this.handleAuthExpired();
            throw new Error('認証の有効期限が切れました。再ログインしてください');
        }

        return response;
    }

    // Google 認証関連
    async signInToGoogle() {
        if (!this.gapiInitialized) {
            console.error('Google APIが初期化されていません');
            this.showToast('Google APIが初期化されていません');
            return;
        }

        if (!this.tokenClient) {
            console.error('tokenClientが初期化されていません');
            this.showToast('認証クライアントが初期化されていません');
            return;
        }

        try {
            // Google Identity Services を使用してトークンを取得
            this.tokenClient.requestAccessToken();
        } catch (error) {
            console.error('Google ログインエラー:', error);
            this.showToast(`Googleログインに失敗しました: ${error.message}`);
        }
    }

    async signOutFromGoogle() {
        if (!this.gapiInitialized) return;

        try {
            // アクセストークンを無効化
            if (this.accessToken) {
                google.accounts.oauth2.revoke(this.accessToken);
                this.accessToken = null;
            }
            this.onSignOutSuccess();
        } catch (error) {
            console.error('Google ログアウトエラー:', error);
            this.showToast('ログアウトに失敗しました');
        }
    }

    async onSignInSuccess(silent = false) {
        try {
            // ユーザー情報を直接APIで取得
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.ok) {
                const userInfo = await response.json();
                this.driveConfig.connected = true;
                this.driveConfig.userEmail = userInfo.email;
                this.driveConfig.userName = userInfo.name;
                if (!silent) this.showToast(`${userInfo.name}としてログインしました`);
            } else {
                // ユーザー情報取得に失敗した場合のフォールバック
                this.driveConfig.connected = true;
                this.driveConfig.userEmail = '';
                this.driveConfig.userName = '';
                if (!silent) this.showToast('ログインしました');
            }

            this.updateAuthStatus();
            this.updateDriveStatus();

        } catch (error) {
            console.error('ユーザー情報取得エラー:', error);
            this.driveConfig.connected = true;
            this.driveConfig.userEmail = '';
            this.driveConfig.userName = '';
            this.updateAuthStatus();
            this.updateDriveStatus();
            if (!silent) this.showToast('ログインしました');
        }
    }

    onSignOutSuccess() {
        this.driveConfig.connected = false;
        this.driveConfig.userEmail = '';
        this.driveConfig.fileId = '';
        this.driveConfig.docFileId = '';
        this.driveConfig.syncEnabled = false;
        this.tokenExpiresAt = null;

        this.saveConfig();
        this.updateAuthStatus();
        this.updateDriveStatus();
        this.showToast('ログアウトしました');
    }

    updateAuthStatus() {
        const indicator = this.elements.authStatus.querySelector('.status-indicator');
        const text = this.elements.authStatus.querySelector('.status-text');
        
        if (this.driveConfig.connected) {
            indicator.classList.remove('offline');
            indicator.classList.add('online');
            text.textContent = this.driveConfig.userEmail ? `ログイン中: ${this.driveConfig.userEmail}` : 'ログイン中';
            
            this.elements.googleSignin.classList.add('hidden');
            this.elements.googleSignout.classList.remove('hidden');
            this.elements.fileSection.style.display = 'block';
        } else {
            indicator.classList.remove('online');
            indicator.classList.add('offline');
            text.textContent = 'Googleアカウント未ログイン';
            
            this.elements.googleSignin.classList.remove('hidden');
            this.elements.googleSignout.classList.add('hidden');
            this.elements.fileSection.style.display = 'none';
        }
        
        this.updateSaveButtonState();
    }

    updateDriveStatus() {
        const statusElement = this.elements.driveStatus;
        const syncButton = this.elements.driveSyncBtn;
        
        if (this.driveConfig.connected && this.driveConfig.fileId) {
            statusElement.classList.add('connected');
            syncButton.disabled = false;
        } else {
            statusElement.classList.remove('connected');
            syncButton.disabled = true;
        }
    }

    updateSaveButtonState() {
        const saveButton = this.elements.saveDriveConfig;
        const canSave = this.driveConfig.connected && this.driveConfig.fileId;
        
        saveButton.disabled = !canSave;
    }

    // ダイアログ管理
    openDriveSetupDialog() {
        if (!this.elements.driveSetupDialog) {
            console.error('Drive setup dialog element not found');
            this.showToast('ダイアログ要素が見つかりません');
            return;
        }

        if (!this.gapiInitialized) {
            this.showToast('Google APIを初期化中、または初期化に失敗しています');
        }

        try {
            this.elements.driveFileName.value = this.driveConfig.fileName || 'OutlineWriter-data.json';
            this.elements.autoSync.checked = this.driveConfig.syncEnabled || false;

            this.updateAuthStatus();
            this.updateFileInfo();

            this.elements.driveSetupDialog.classList.remove('hidden');

            // Force display to ensure visibility - ポップアップとして最前面に表示
            this.elements.driveSetupDialog.style.position = 'fixed';
            this.elements.driveSetupDialog.style.top = '0';
            this.elements.driveSetupDialog.style.left = '0';
            this.elements.driveSetupDialog.style.right = '0';
            this.elements.driveSetupDialog.style.bottom = '0';
            this.elements.driveSetupDialog.style.zIndex = '9999';
            this.elements.driveSetupDialog.style.display = 'block';
            this.elements.driveSetupDialog.style.opacity = '1';
            this.elements.driveSetupDialog.style.pointerEvents = 'auto';

            this.closeMenu();
        } catch (error) {
            console.error('Error opening drive setup dialog:', error);
            this.showToast('ダイアログを開く際にエラーが発生しました');
        }
    }

    closeDriveSetupDialog() {
        this.elements.driveSetupDialog.classList.add('hidden');
        
        // Remove all forced styles to let CSS take over
        this.elements.driveSetupDialog.style.position = '';
        this.elements.driveSetupDialog.style.top = '';
        this.elements.driveSetupDialog.style.left = '';
        this.elements.driveSetupDialog.style.right = '';
        this.elements.driveSetupDialog.style.bottom = '';
        this.elements.driveSetupDialog.style.zIndex = '';
        this.elements.driveSetupDialog.style.display = '';
        this.elements.driveSetupDialog.style.opacity = '';
        this.elements.driveSetupDialog.style.pointerEvents = '';
    }

    openSyncDialog() {
        this.updateSyncInfo();
        this.elements.syncDialog.classList.remove('hidden');
        this.closeMenu();
    }

    closeSyncDialog() {
        this.elements.syncDialog.classList.add('hidden');
    }

    updateFileInfo() {
        if (this.driveConfig.fileId) {
            this.elements.selectedFileName.textContent = this.driveConfig.fileName || '設定済み';
            this.elements.selectedFileModified.textContent = this.driveConfig.lastSync || '不明';
        } else {
            this.elements.selectedFileName.textContent = '未選択';
            this.elements.selectedFileModified.textContent = '-';
        }
    }

    // ファイル操作
    async selectExistingFile() {
        if (!this.driveConfig.connected) {
            this.showToast('まずGoogleアカウントにログインしてください');
            return;
        }
        if (!(await this.ensureToken())) {
            this.handleAuthExpired();
            return;
        }

        try {
            // Drive内のJSONファイルを検索
            const query = "name contains '.json' and mimeType='application/json' and trashed=false";
            const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(query) +
                '&pageSize=10&fields=' + encodeURIComponent('files(id,name,modifiedTime)');
            const response = await this.driveFetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            const files = result.files || [];
            if (files.length === 0) {
                this.showToast('JSONファイルが見つかりません');
                return;
            }

            const labels = files.map((file) => {
                const modifiedDate = new Date(file.modifiedTime).toLocaleString('ja-JP');
                return `${file.name} (${modifiedDate})`;
            });

            const index = await this.showChoiceDialog('Driveファイルを選択', labels);

            if (index !== null && index >= 0 && index < files.length) {
                const selectedFile = files[index];
                this.driveConfig.fileId = selectedFile.id;
                this.driveConfig.docFileId = '';
                this.driveConfig.fileName = selectedFile.name;

                this.updateFileInfo();
                this.updateDriveStatus();
                this.showToast(`ファイル「${selectedFile.name}」を選択しました`);
            }
        } catch (error) {
            console.error('ファイル選択エラー:', error);
            this.showToast('ファイルの選択に失敗しました');
        }
    }

    async createNewFile() {
        if (!this.driveConfig.connected) {
            this.showToast('まずGoogleアカウントにログインしてください');
            return;
        }
        if (!(await this.ensureToken())) {
            this.handleAuthExpired();
            return;
        }

        const fileName = this.elements.driveFileName.value.trim();
        if (!fileName) {
            this.showToast('ファイル名を入力してください');
            return;
        }

        try {
            // 初期データを作成
            const initialData = this.createExportData();

            const fileMetadata = {
                name: fileName,
                parents: ['root'] // ルートフォルダに作成
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(fileMetadata)], {type: 'application/json'}));
            form.append('file', new Blob([JSON.stringify(initialData, null, 2)], {type: 'application/json'}));

            const response = await this.driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                body: form
            });

            if (response.ok) {
                const result = await response.json();
                this.driveConfig.fileId = result.id;
                this.driveConfig.docFileId = '';
                this.driveConfig.fileName = fileName;

                this.updateFileInfo();
                this.updateDriveStatus();
                this.showToast(`ファイル「${fileName}」を作成しました`);
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('ファイル作成エラー:', error);
            this.showToast('ファイルの作成に失敗しました');
        }
    }

    saveDriveConfig() {
        if (!this.driveConfig.connected || !this.driveConfig.fileId) {
            this.showToast('ログインとファイル選択を完了してください');
            return;
        }

        this.driveConfig.fileName = this.elements.driveFileName.value.trim();
        this.driveConfig.syncEnabled = this.elements.autoSync.checked;

        this.saveConfig();
        this.updateDriveStatus();
        this.closeDriveSetupDialog();
        this.showToast('Drive設定を保存しました');
    }

    updateSyncInfo() {
        const localTimestamp = localStorage.getItem('outlinewriter-data-timestamp') || 'なし';
        const lastSync = this.driveConfig.lastSync || 'なし';

        this.elements.localTimestamp.textContent = localTimestamp;
        this.elements.lastSyncTimestamp.textContent = lastSync;

        // Drive timestamp will be updated when we fetch from Drive
        this.elements.driveTimestamp.textContent = '取得中...';
        this.fetchDriveTimestamp();
    }

    async fetchDriveTimestamp() {
        if (!this.driveConfig.connected || !this.driveConfig.fileId) {
            this.elements.driveTimestamp.textContent = '未設定';
            return;
        }
        if (!this.isTokenValid()) {
            this.elements.driveTimestamp.textContent = '未認証';
            return;
        }

        try {
            const url = `https://www.googleapis.com/drive/v3/files/${this.driveConfig.fileId}?fields=modifiedTime`;
            const response = await this.driveFetch(url);

            if (response.ok) {
                const result = await response.json();
                const modifiedTime = new Date(result.modifiedTime).toLocaleString('ja-JP');
                this.elements.driveTimestamp.textContent = modifiedTime;
            } else {
                this.elements.driveTimestamp.textContent = 'エラー';
            }
        } catch (error) {
            console.error('タイムスタンプ取得エラー:', error);
            this.elements.driveTimestamp.textContent = 'エラー';
        }
    }

    async uploadToDrive() {
        if (!this.driveConfig.connected || !this.driveConfig.fileId) {
            this.showToast('Drive設定を完了してください');
            return;
        }
        if (!(await this.ensureToken())) {
            this.handleAuthExpired();
            return;
        }

        this.showSyncProgress();

        try {
            const dataToUpload = this.createExportData();

            const url = `https://www.googleapis.com/upload/drive/v3/files/${this.driveConfig.fileId}?uploadType=media`;
            const response = await this.driveFetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataToUpload, null, 2)
            });

            if (response.ok) {
                this.driveConfig.lastSync = new Date().toLocaleString('ja-JP');
                this.saveConfig();

                // ローカルタイムスタンプも更新
                localStorage.setItem('outlinewriter-data-timestamp', dataToUpload.timestamp);
                localStorage.setItem('outlinewriter-data-timestamp-iso', new Date().toISOString());
                localStorage.setItem('outlinewriter-drive-synced-iso', new Date().toISOString());

                // 閲覧用ドキュメントの失敗はJSON同期の成否に影響させない
                let docError = null;
                try {
                    await this.uploadReadableDoc();
                } catch (e) {
                    docError = e;
                    console.error('閲覧用ドキュメントの保存エラー:', e);
                }

                this.hideSyncProgress();
                this.updateSyncInfo();
                this.showToast(docError
                    ? `Driveにアップロードしました（閲覧用ドキュメントの保存に失敗: ${docError.message}）`
                    : 'Driveにアップロードしました');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            this.hideSyncProgress();
            console.error('アップロードエラー:', error);
            this.showToast(`アップロードに失敗しました: ${error.message}`);
        }
    }

    // Claude等のDriveコネクタで読めるよう、MarkdownをGoogleドキュメントに変換して保存する
    // （.mdや.jsonはコネクタでテキストとして読めないため）
    async uploadReadableDoc() {
        const markdown = this.generateMarkdownExport(this.data.items, 0, false) || ' ';
        const docName = (this.driveConfig.fileName || 'OutlineWriter-data').replace(/\.json$/i, '');

        if (this.driveConfig.docFileId) {
            const url = `https://www.googleapis.com/upload/drive/v3/files/${this.driveConfig.docFileId}?uploadType=media`;
            const response = await this.driveFetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'text/markdown; charset=UTF-8' },
                body: markdown
            });
            if (response.ok) return;
            // ユーザーが削除した等で見つからない場合は作り直す
            if (response.status !== 404) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }

        const metadata = {
            name: docName,
            mimeType: 'application/vnd.google-apps.document',
            parents: ['root']
        };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([markdown], { type: 'text/markdown' }));

        const response = await this.driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            body: form
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        this.driveConfig.docFileId = result.id;
        this.saveConfig();
    }

    // Driveからデータを取得し、現在のアウトラインに反映する（UIダイアログの有無に依存しない）
    async fetchAndApplyDriveData() {
        const url = `https://www.googleapis.com/drive/v3/files/${this.driveConfig.fileId}?alt=media`;
        const response = await this.driveFetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const driveData = await response.json();

        if (!driveData.data) {
            throw new Error('無効なデータ形式です');
        }

        this.data = this.normalizeData(driveData.data);
        this.currentItem = null;
        this.elements.currentTitle.value = '';
        this.elements.currentContent.value = '';
        this.updateHierarchyPaths();
        this.renderOutline();
        this.updateCharCount();
        this.updateButtonStates();
        this.updateBreadcrumb();
        this.saveToHistory();
        this.scheduleAutoSave();

        this.driveConfig.lastSync = new Date().toLocaleString('ja-JP');
        this.saveConfig();

        // ローカルタイムスタンプを更新
        localStorage.setItem('outlinewriter-data-timestamp', driveData.timestamp || new Date().toLocaleString('ja-JP'));
        localStorage.setItem('outlinewriter-data-timestamp-iso', new Date().toISOString());
        localStorage.setItem('outlinewriter-drive-synced-iso', new Date().toISOString());
    }

    async downloadFromDrive() {
        if (!this.driveConfig.connected || !this.driveConfig.fileId) {
            this.showToast('Drive設定を完了してください');
            return;
        }
        if (!(await this.ensureToken())) {
            this.handleAuthExpired();
            return;
        }

        this.showSyncProgress();

        try {
            await this.fetchAndApplyDriveData();
            this.hideSyncProgress();
            this.updateSyncInfo();
            this.showToast('Driveからダウンロードしました');
        } catch (error) {
            this.hideSyncProgress();
            console.error('ダウンロードエラー:', error);
            this.showToast(`ダウンロードに失敗しました: ${error.message}`);
        }
    }

    // 起動時のサイレント認証成功後に呼ばれる自動同期
    async autoSyncFromDrive() {
        try {
            const localIso = localStorage.getItem('outlinewriter-data-timestamp-iso');
            const syncedIso = localStorage.getItem('outlinewriter-drive-synced-iso');
            const localIsEmpty = !this.data.items.length;

            if (localIso && !localIsEmpty) {
                const url = `https://www.googleapis.com/drive/v3/files/${this.driveConfig.fileId}?fields=modifiedTime`;
                const response = await this.driveFetch(url);
                if (response.ok) {
                    const result = await response.json();
                    const driveTime = new Date(result.modifiedTime);

                    // 前回同期時刻からの変化で判定（同期直後の自動保存や時計の微妙なズレを吸収）
                    const TOLERANCE = 5000; // ms
                    const editedSinceSync = !syncedIso || (new Date(localIso) - new Date(syncedIso) > TOLERANCE);
                    const driveChangedSinceSync = !syncedIso || (driveTime - new Date(syncedIso) > TOLERANCE);

                    if (editedSinceSync) {
                        if (!driveChangedSinceSync) {
                            // Drive側に新しい変更はない。同期するとローカルの編集が失われるだけ
                            this.showToast('自動同期をスキップしました（ローカルが最新）');
                            return;
                        }
                        const confirmed = await this.showConfirmDialog(
                            'ローカルのデータの方が新しい可能性があります。Driveのデータで上書きしますか？',
                            { okLabel: '上書きする', cancelLabel: '同期しない' }
                        );
                        if (!confirmed) {
                            this.showToast('自動同期をスキップしました');
                            return;
                        }
                    }
                }
            }

            await this.fetchAndApplyDriveData();
            this.showToast('Driveから自動同期しました');
        } catch (error) {
            console.log('自動同期に失敗しました:', error.message);
        }
    }

    showSyncProgress() {
        if (this.elements.syncProgress) {
            this.elements.syncProgress.classList.remove('hidden');
        }
    }

    hideSyncProgress() {
        if (this.elements.syncProgress) {
            this.elements.syncProgress.classList.add('hidden');
        }
    }

    // Google API 状態診断
    diagnoseGoogleAPIStatus() {
        const status = {
            gisLoaded: typeof google !== 'undefined' && !!(google.accounts && google.accounts.oauth2),
            gapiInitialized: this.gapiInitialized,
            tokenClient: !!this.tokenClient,
            accessTokenValid: this.isTokenValid(),
            connected: this.driveConfig.connected,
            fileId: this.driveConfig.fileId || '(未設定)',
            clientIdConfigured: typeof GOOGLE_CONFIG !== 'undefined' && validateGoogleConfig()
        };

        console.log('=== Google API 診断結果 ===');
        if (typeof console.table === 'function') {
            console.table(status);
        } else {
            console.log(status);
        }

        return status;
    }

    // PWA setup
    setupPWA() {
        // Register service worker when available
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('Service Worker registered');
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        }

        // Handle install prompt
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            // Could show install button here
        });
    }
}

// Initialize the mobile app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MobileOutlineWriter();
});