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
        this.selectedItems = new Set();
        this.toolbarVisible = true;
        
        // Google Drive integration
        this.driveConfig = {
            fileName: 'OutlineWriter-data.json',
            fileId: '',
            connected: false,
            syncEnabled: false,
            lastSync: null,
            userEmail: ''
        };
        
        // Google API状態
        this.tokenClient = null;
        this.accessToken = null;
        this.gapiInitialized = false;
        
        this.initializeElements();
        this.bindEvents();
        this.loadConfig();
        this.loadData();
        this.updateHierarchyPaths();
        this.renderOutline();
        this.saveToHistory();
        this.startAutoBackup();
        this.setupPWA();
        
        // Google API初期化は少し遅延させる
        setTimeout(() => {
            console.log('Google API初期化を開始...');
            this.initializeGoogleAPI();
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
            isHeading: document.getElementById('is-heading-mobile'),
            currentContent: document.getElementById('current-content-mobile'),
            charCount: document.getElementById('char-count-mobile'),
            totalCharCount: document.getElementById('total-char-count-mobile'),
            
            // Toolbar
            bottomToolbar: document.getElementById('bottom-toolbar'),
            addItemBtn: document.getElementById('add-item-mobile'),
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
        
        // Debug: Check if critical elements exist
        console.log('Drive setup dialog element:', this.elements.driveSetupDialog);
        console.log('Drive setup button element:', this.elements.driveSetupBtn);
        if (!this.elements.driveSetupDialog) {
            console.error('Critical: drive-setup-dialog element not found in DOM');
        }
        if (!this.elements.driveSetupBtn) {
            console.error('Critical: drive-setup-mobile element not found in DOM');
        }
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
        this.elements.isHeading.addEventListener('change', () => this.updateCurrentItem());
        
        // Toolbar events
        this.elements.addItemBtn.addEventListener('click', () => this.addItemAfterCurrent());
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
            this.elements.driveSetupBtn.addEventListener('click', () => {
                console.log('Drive setup button clicked');
                this.openDriveSetupDialog();
            });
        } else {
            console.error('Cannot bind event: driveSetupBtn element not found');
        }
        this.elements.driveSyncBtn.addEventListener('click', () => this.openSyncDialog());
        this.elements.closeDriveDialog.addEventListener('click', () => this.closeDriveSetupDialog());
        this.elements.closeSyncDialog.addEventListener('click', () => this.closeSyncDialog());
        this.elements.googleSignin.addEventListener('click', () => {
            console.log('Google ログインボタンがクリックされました');
            this.signInToGoogle();
        });
        this.elements.googleSignout.addEventListener('click', () => this.signOutFromGoogle());
        this.elements.selectDriveFile.addEventListener('click', () => this.selectExistingFile());
        this.elements.createDriveFile.addEventListener('click', () => this.createNewFile());
        this.elements.saveDriveConfig.addEventListener('click', () => this.saveDriveConfig());
        this.elements.uploadToDrive.addEventListener('click', () => this.uploadToDrive());
        this.elements.downloadFromDrive.addEventListener('click', () => this.downloadFromDrive());
        
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
            if (!this.elements.searchPanel.classList.contains('hidden')) {
                this.closeSearch();
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
        this.searchItems(this.data.items, query.toLowerCase(), results);
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
                <div class="search-result-title">${this.escapeHtml(item.title)}</div>
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
        
        setTimeout(() => {
            this.elements.toast.classList.add('hidden');
        }, duration);
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
            `<span class="breadcrumb-item">${this.escapeHtml(item.title)}</span>`
        ).join('');
        
        this.elements.breadcrumb.innerHTML = `<span class="breadcrumb-item">ホーム</span>${breadcrumbHtml}`;
    }

    // Core OutlineWriter methods (adapted from main script)
    addItem(parentId = null, index = -1) {
        const newItem = {
            id: this.data.nextId++,
            title: '新しい項目',
            content: '',
            isHeading: false,
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
        this.elements.isHeading.checked = item.isHeading;
        
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

        this.currentItem.title = this.elements.currentTitle.value || '無題';
        this.currentItem.content = this.elements.currentContent.value;
        this.currentItem.isHeading = this.elements.isHeading.checked;
        
        this.renderOutline();
        this.updateActiveState();
        this.updateBreadcrumb();
        this.saveToHistory();
    }

    updateActiveState() {
        document.querySelectorAll('.outline-item-content-mobile').forEach(el => {
            el.classList.remove('active', 'selected');
        });
        
        if (this.currentItem) {
            const activeEl = document.querySelector(`[data-id="${this.currentItem.id}"]`);
            if (activeEl) {
                activeEl.classList.add('active');
            }
        }
        
        this.selectedItems.forEach(itemId => {
            const selectedEl = document.querySelector(`[data-id="${itemId}"]`);
            if (selectedEl) {
                selectedEl.classList.add('selected');
            }
        });
    }

    updateButtonStates() {
        if (!this.currentItem) {
            this.elements.indentBtn.disabled = true;
            this.elements.outdentBtn.disabled = true;
            this.elements.deleteBtn.disabled = true;
            return;
        }

        this.elements.deleteBtn.disabled = false;
        
        const parent = this.findItemParent(this.currentItem.id);
        this.elements.outdentBtn.disabled = parent === null;
        
        const siblings = parent ? parent.children : this.data.items;
        const currentIndex = siblings.indexOf(this.currentItem);
        this.elements.indentBtn.disabled = currentIndex === 0;
    }

    renderOutline() {
        this.elements.outlineTree.innerHTML = '';
        this.renderItems(this.data.items, this.elements.outlineTree);
    }

    renderItems(items, container) {
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
        
        if (item.isHeading) {
            contentDiv.classList.add('heading');
        }

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'outline-toggle-mobile';
        toggleBtn.textContent = item.children.length > 0 ? (item.expanded ? '▼' : '▶') : '•';
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpanded(item.id);
        });

        const titleSpan = document.createElement('span');
        titleSpan.className = 'outline-title-mobile';
        if (item.isHeading) {
            titleSpan.classList.add('heading');
        }
        titleSpan.textContent = item.title;

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
        const actions = [
            { label: '編集', action: () => this.selectItem(item.id) },
            { label: '削除', action: () => this.deleteItem(item.id) },
            { label: 'インデント', action: () => this.indentItemById(item.id) },
            { label: 'アウトデント', action: () => this.outdentItemById(item.id) }
        ];
        
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
        this.countChars(this.data.items, (count) => {
            total += count;
        });
        return total;
    }

    // ツールバー表示/非表示機能
    hideToolbar() {
        this.toolbarVisible = false;
        this.elements.bottomToolbar.style.transform = 'translateY(100%)';
        this.elements.bottomToolbar.style.transition = 'transform 0.3s ease';
        
        // メニューのツールバー表示ボタンを有効化
        this.elements.showToolbarBtn.style.display = 'block';
        
        this.closeMenu();
        localStorage.setItem('toolbar-visible', 'false');
    }

    showToolbar() {
        this.toolbarVisible = true;
        this.elements.bottomToolbar.style.transform = 'translateY(0)';
        this.elements.bottomToolbar.style.transition = 'transform 0.3s ease';
        
        // メニューのツールバー表示ボタンを無効化
        this.elements.showToolbarBtn.style.display = 'none';
        
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
            isHeading: false,
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
        this.showToast('アウトデントしました');
    }

    deleteCurrentItem() {
        if (!this.currentItem) return;
        
        if (!confirm('この項目を削除しますか？')) return;
        
        const parent = this.findItemParent(this.currentItem.id);
        const siblings = parent ? parent.children : this.data.items;
        const index = siblings.indexOf(this.currentItem);
        
        siblings.splice(index, 1);
        
        this.currentItem = null;
        this.elements.currentTitle.value = '';
        this.elements.currentContent.value = '';
        this.elements.isHeading.checked = false;
        
        this.updateHierarchyPaths();
        this.renderOutline();
        this.updateCharCount();
        this.updateButtonStates();
        this.updateBreadcrumb();
        this.saveToHistory();
        this.showToast('項目を削除しました');
    }

    // Include all hierarchy management methods from main script
    updateHierarchyPaths() {
        this.updateItemHierarchy(this.data.items, '', 0);
    }

    updateItemHierarchy(items, parentPath, level) {
        items.forEach((item, index) => {
            const position = index + 1;
            const currentPath = parentPath ? `${parentPath}.${position}` : `${position}`;
            
            item.hierarchyPath = currentPath;
            item.level = level;
            
            if (item.children && item.children.length > 0) {
                this.updateItemHierarchy(item.children, currentPath, level + 1);
            }
        });
    }

    // History management
    saveToHistory() {
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
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.data = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.currentItem = null;
            this.elements.currentTitle.value = '';
            this.elements.currentContent.value = '';
            this.elements.isHeading.checked = false;
            this.renderOutline();
            this.updateCharCount();
            this.updateButtonStates();
            this.updateBreadcrumb();
            this.updateUndoRedoButtons();
            this.showToast('元に戻しました');
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.data = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.currentItem = null;
            this.elements.currentTitle.value = '';
            this.elements.currentContent.value = '';
            this.elements.isHeading.checked = false;
            this.renderOutline();
            this.updateCharCount();
            this.updateButtonStates();
            this.updateBreadcrumb();
            this.updateUndoRedoButtons();
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

    // Data management
    saveData() {
        try {
            localStorage.setItem('outlinewriter-data', JSON.stringify(this.data));
            localStorage.setItem('outlinewriter-data-timestamp', new Date().toLocaleString('ja-JP'));
            this.showToast('データを保存しました');
        } catch (e) {
            this.showToast('保存に失敗しました');
        }
    }

    loadData() {
        try {
            const saved = localStorage.getItem('outlinewriter-data');
            if (saved) {
                this.data = JSON.parse(saved);
                this.currentItem = null;
                this.elements.currentTitle.value = '';
                this.elements.currentContent.value = '';
                this.elements.isHeading.checked = false;
                this.updateHierarchyPaths();
                this.renderOutline();
                this.updateCharCount();
                this.updateButtonStates();
                this.updateBreadcrumb();
            }
            this.loadBackups();
        } catch (e) {
            this.showToast('読み込みに失敗しました');
        }
    }

    // File operations
    loadFileFromDialog() {
        this.elements.loadFileInput.click();
        this.closeMenu();
    }

    loadFromFile(event) {
        const file = event.target.files[0];
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
                
                this.data = data;
                this.currentItem = null;
                this.elements.currentTitle.value = '';
                this.elements.currentContent.value = '';
                this.elements.isHeading.checked = false;
                this.updateHierarchyPaths();
                this.renderOutline();
                this.updateCharCount();
                this.updateButtonStates();
                this.updateBreadcrumb();
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
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const markdownContent = e.target.result;
                const convertedData = this.parseMarkdownToOutlineWriter(markdownContent);
                
                this.data = convertedData;
                this.currentItem = null;
                this.elements.currentTitle.value = '';
                this.elements.currentContent.value = '';
                this.elements.isHeading.checked = false;
                this.updateHierarchyPaths();
                this.renderOutline();
                this.updateCharCount();
                this.updateButtonStates();
                this.updateBreadcrumb();
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

    downloadFileWithName(content, mimeType, defaultName) {
        const filename = prompt('ファイル名を入力してください:', defaultName);
        if (filename) {
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
                        const isHeading = !!nextHeadingMatch;
                        
                        const item = {
                            id: data.nextId++,
                            title: title,
                            content: '',
                            isHeading: isHeading,
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
            } else if (trimmedLine && !trimmedLine.startsWith('<!--') && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('-')) {
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
                    isHeading: true,
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
                    isHeading: false,
                    children: [],
                    expanded: true,
                    parentId: null,
                    hierarchyPath: '',
                    level: 0
                };

                // リスト項目の階層判定を改善
                while (stack.length > 1 && !stack[stack.length - 1].isHeading) {
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

    generateMarkdownExport(items, level) {
        let result = '';
        items.forEach(item => {
            result += `<!-- hierarchy: ${item.hierarchyPath} level: ${item.level} -->\n`;
            
            if (item.isHeading) {
                const headingLevel = Math.min(level + 1, 6);
                const hashes = '#'.repeat(headingLevel);
                result += `${hashes} ${item.title}\n\n`;
                
                if (item.content.trim()) {
                    const contentLines = item.content.split('\n');
                    contentLines.forEach(line => {
                        if (line.trim()) {
                            result += `${line}\n`;
                        }
                    });
                    result += '\n';
                }
                
                if (item.children.length > 0) {
                    result += this.generateMarkdownExport(item.children, level + 1);
                }
            } else {
                const indent = '  '.repeat(level);
                result += `${indent}- ${item.title}\n`;
                
                if (item.content.trim()) {
                    const contentLines = item.content.split('\n');
                    contentLines.forEach(line => {
                        if (line.trim()) {
                            result += `${indent}  ${line}\n`;
                        }
                    });
                }
                
                if (item.children.length > 0) {
                    result += this.generateMarkdownExport(item.children, level + 1);
                }
            }
        });
        return result;
    }

    generateTextExport(items, level) {
        let result = '';
        items.forEach(item => {
            const indent = '  '.repeat(level);
            const prefix = item.isHeading ? '■ ' : '・ ';
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
        
        if (this.backups.length > this.maxBackups) {
            this.backups.shift();
        }
        
        try {
            localStorage.setItem('outlinewriter-backups', JSON.stringify(this.backups));
            this.showToast(`バックアップを作成しました`);
        } catch (e) {
            this.showToast('バックアップの作成に失敗しました');
        }
        this.closeMenu();
    }

    showBackupDialog() {
        if (this.backups.length === 0) {
            this.showToast('利用可能なバックアップがありません');
            return;
        }
        
        let message = 'バックアップを選択してください:\n\n';
        this.backups.forEach((backup, index) => {
            message += `${index + 1}. ${backup.timestamp}\n`;
        });
        
        const selection = prompt(message + '\n番号を入力してください (1-' + this.backups.length + '):');
        
        if (selection) {
            const index = parseInt(selection) - 1;
            if (index >= 0 && index < this.backups.length) {
                this.restoreFromBackup(index);
            } else {
                this.showToast('無効な番号です');
            }
        }
        this.closeMenu();
    }

    restoreFromBackup(index) {
        if (index < 0 || index >= this.backups.length) return;
        
        if (!confirm('現在のデータは失われます。本当に復元しますか？')) return;
        
        this.data = JSON.parse(JSON.stringify(this.backups[index].data));
        this.currentItem = null;
        this.elements.currentTitle.value = '';
        this.elements.currentContent.value = '';
        this.elements.isHeading.checked = false;
        this.renderOutline();
        this.updateCharCount();
        this.updateButtonStates();
        this.updateBreadcrumb();
        this.saveToHistory();
        
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
        if (this.data.items.length === 0) return;
        
        const timestamp = new Date().toLocaleString('ja-JP');
        const backup = {
            timestamp: `自動バックアップ - ${timestamp}`,
            data: JSON.parse(JSON.stringify(this.data))
        };
        
        this.backups.push(backup);
        
        if (this.backups.length > this.maxBackups) {
            this.backups.shift();
        }
        
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
            // 設定の検証
            console.log('設定の検証中...');
            if (typeof GOOGLE_CONFIG === 'undefined' || !validateGoogleConfig()) {
                console.warn('Google Drive機能は利用できません。config.jsを設定してください。');
                console.log(SETUP_INSTRUCTIONS);
                return;
            }
            console.log('設定検証完了');

            // Google API Client Library と GIS が読み込まれるのを待つ
            console.log('Google APIライブラリの読み込み待機中...');
            await this.waitForGoogleAPIs();
            console.log('Google APIライブラリ読み込み完了');

            // Google Drive API クライアントを初期化
            console.log('gapi.client初期化中...');
            await new Promise((resolve) => {
                gapi.load('client', resolve);
            });
            console.log('gapi.client初期化完了');

            console.log('Google Client初期化中...');
            try {
                // ローカル環境では簡素な初期化
                if (location.protocol === 'file:') {
                    console.log('ローカル環境を検出、簡素な初期化を実行...');
                    await gapi.client.init({});
                } else {
                    await gapi.client.init({
                        discoveryDocs: [GOOGLE_CONFIG.DISCOVERY_URL]
                    });
                }
                console.log('Google Client初期化完了');
            } catch (initError) {
                console.error('gapi.client.init エラー:', initError);
                // 最小限の初期化で再試行
                console.log('最小限の初期化で再試行...');
                await gapi.client.init({});
                console.log('Google Client初期化完了（最小限）');
            }

            // Google Identity Services を初期化
            console.log('tokenClient初期化中...');
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CONFIG.CLIENT_ID,
                scope: GOOGLE_CONFIG.SCOPES,
                callback: (response) => {
                    console.log('OAuth callback:', response);
                    if (response.error) {
                        console.error('OAuth エラー:', response.error);
                        this.showToast(`認証に失敗しました: ${response.error}`);
                    } else {
                        console.log('OAuth 成功');
                        this.accessToken = response.access_token;
                        this.onSignInSuccess();
                    }
                }
            });
            console.log('tokenClient初期化完了');

            this.gapiInitialized = true;
            console.log('Google API初期化が完全に完了しました');
            this.showToast('Google Drive機能が利用可能になりました');
            
        } catch (error) {
            console.error('Google API初期化エラー:', error);
            this.gapiInitialized = false;
            this.showToast(`Google Drive機能の初期化に失敗しました: ${error.message}`);
        }
    }

    async waitForGoogleAPIs() {
        // gapi と google.accounts の読み込みを待つ
        let attempts = 0;
        const maxAttempts = 100; // 10秒まで待機
        
        while (attempts < maxAttempts) {
            if (typeof gapi !== 'undefined' && 
                typeof google !== 'undefined' && 
                google.accounts && 
                google.accounts.oauth2 &&
                typeof google.accounts.oauth2.initTokenClient === 'function') {
                console.log('Google API libraries loaded successfully');
                return;
            }
            console.log(`Google APIs loading... attempt ${attempts + 1}/${maxAttempts}`);
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
                this.driveConfig.lastSync = savedConfig.lastSync || this.driveConfig.lastSync;
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
                lastSync: this.driveConfig.lastSync
            };
            localStorage.setItem('outlinewriter-drive-config', JSON.stringify(configToSave));
        } catch (e) {
            console.error('Drive設定の保存に失敗しました:', e);
        }
    }

    // Google 認証関連
    async signInToGoogle() {
        console.log('signInToGoogle() が呼ばれました');
        console.log('gapiInitialized:', this.gapiInitialized);
        console.log('tokenClient:', this.tokenClient);
        
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
            console.log('トークン取得を開始...');
            // Google Identity Services を使用してトークンを取得
            this.tokenClient.requestAccessToken();
        } catch (error) {
            console.error('Google ログインエラー:', error);
            this.showToast('Googleログインに失敗しました');
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

    async onSignInSuccess() {
        try {
            // アクセストークンを設定
            gapi.client.setToken({ access_token: this.accessToken });
            
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
                this.showToast(`${userInfo.name}としてログインしました`);
            } else {
                // ユーザー情報取得に失敗した場合のフォールバック
                this.driveConfig.connected = true;
                this.driveConfig.userEmail = 'user@gmail.com';
                this.driveConfig.userName = 'ユーザー';
                this.showToast('ログインしました');
            }
            
            this.updateAuthStatus();
            this.updateDriveStatus();
            
        } catch (error) {
            console.error('ユーザー情報取得エラー:', error);
            this.driveConfig.connected = true;
            this.driveConfig.userEmail = 'user@gmail.com';
            this.driveConfig.userName = 'ユーザー';
            this.updateAuthStatus();
            this.updateDriveStatus();
            this.showToast('ログインしました');
        }
    }

    onSignOutSuccess() {
        this.driveConfig.connected = false;
        this.driveConfig.userEmail = '';
        this.driveConfig.fileId = '';
        
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
            text.textContent = `ログイン中: ${this.driveConfig.userEmail}`;
            
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
        console.log('openDriveSetupDialog called');
        console.log('driveSetupDialog element:', this.elements.driveSetupDialog);
        
        if (!this.elements.driveSetupDialog) {
            console.error('Drive setup dialog element not found');
            this.showToast('ダイアログ要素が見つかりません');
            return;
        }
        
        try {
            this.elements.driveFileName.value = this.driveConfig.fileName || 'OutlineWriter-data.json';
            this.elements.autoSync.checked = this.driveConfig.syncEnabled || false;
            
            this.updateAuthStatus();
            this.updateFileInfo();
            
            console.log('Removing hidden class from dialog');
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
            
            console.log('Dialog classes after removal:', this.elements.driveSetupDialog.className);
            console.log('Dialog computed display:', window.getComputedStyle(this.elements.driveSetupDialog).display);
            console.log('Dialog computed opacity:', window.getComputedStyle(this.elements.driveSetupDialog).opacity);
            
            this.closeMenu();
        } catch (error) {
            console.error('Error opening drive setup dialog:', error);
            this.showToast('ダイアログを開く際にエラーが発生しました');
        }
    }

    closeDriveSetupDialog() {
        console.log('Closing drive setup dialog');
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
        if (!this.gapiInitialized || !this.driveConfig.connected) {
            this.showToast('まずGoogleアカウントにログインしてください');
            return;
        }

        try {
            // Drive内のJSONファイルを検索
            const response = await gapi.client.drive.files.list({
                q: "name contains '.json' and mimeType='application/json'",
                pageSize: 10,
                fields: 'files(id, name, modifiedTime)'
            });

            const files = response.result.files;
            if (files.length === 0) {
                this.showToast('JSONファイルが見つかりません');
                return;
            }

            // 簡単なファイル選択（実際のアプリではより洗練されたUIを使用）
            let fileList = 'ファイルを選択してください:\n\n';
            files.forEach((file, index) => {
                const modifiedDate = new Date(file.modifiedTime).toLocaleString('ja-JP');
                fileList += `${index + 1}. ${file.name} (${modifiedDate})\n`;
            });

            const selection = prompt(fileList + '\n番号を入力してください:');
            const index = parseInt(selection) - 1;

            if (index >= 0 && index < files.length) {
                const selectedFile = files[index];
                this.driveConfig.fileId = selectedFile.id;
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
        if (!this.gapiInitialized || !this.driveConfig.connected) {
            this.showToast('まずGoogleアカウントにログインしてください');
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

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({
                    'Authorization': `Bearer ${this.accessToken}`
                }),
                body: form
            });

            if (response.ok) {
                const result = await response.json();
                this.driveConfig.fileId = result.id;
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
        if (!this.gapiInitialized || !this.driveConfig.connected || !this.driveConfig.fileId) {
            this.elements.driveTimestamp.textContent = '未設定';
            return;
        }

        try {
            const response = await gapi.client.drive.files.get({
                fileId: this.driveConfig.fileId,
                fields: 'modifiedTime'
            });

            if (response.status === 200) {
                const modifiedTime = new Date(response.result.modifiedTime).toLocaleString('ja-JP');
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
        if (!this.gapiInitialized || !this.driveConfig.connected || !this.driveConfig.fileId) {
            this.showToast('Drive設定を完了してください');
            return;
        }

        this.showSyncProgress();

        try {
            const dataToUpload = this.createExportData();

            const response = await gapi.client.request({
                path: `https://www.googleapis.com/upload/drive/v3/files/${this.driveConfig.fileId}`,
                method: 'PATCH',
                params: {
                    uploadType: 'media'
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataToUpload, null, 2)
            });

            if (response.status === 200) {
                this.driveConfig.lastSync = new Date().toLocaleString('ja-JP');
                this.saveConfig();
                
                // ローカルタイムスタンプも更新
                localStorage.setItem('outlinewriter-data-timestamp', dataToUpload.timestamp);
                
                this.hideSyncProgress();
                this.updateSyncInfo();
                this.showToast('Driveにアップロードしました');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            this.hideSyncProgress();
            console.error('アップロードエラー:', error);
            this.showToast(`アップロードに失敗しました: ${error.message}`);
        }
    }

    async downloadFromDrive() {
        if (!this.gapiInitialized || !this.driveConfig.connected || !this.driveConfig.fileId) {
            this.showToast('Drive設定を完了してください');
            return;
        }

        this.showSyncProgress();

        try {
            const response = await gapi.client.drive.files.get({
                fileId: this.driveConfig.fileId,
                alt: 'media'
            });

            if (response.status === 200) {
                const driveData = JSON.parse(response.body);
                
                if (driveData.data) {
                    this.data = driveData.data;
                    this.currentItem = null;
                    this.elements.currentTitle.value = '';
                    this.elements.currentContent.value = '';
                    this.elements.isHeading.checked = false;
                    this.updateHierarchyPaths();
                    this.renderOutline();
                    this.updateCharCount();
                    this.updateButtonStates();
                    this.updateBreadcrumb();
                    this.saveToHistory();
                    
                    this.driveConfig.lastSync = new Date().toLocaleString('ja-JP');
                    this.saveConfig();
                    
                    // ローカルタイムスタンプを更新
                    localStorage.setItem('outlinewriter-data-timestamp', driveData.timestamp || new Date().toLocaleString('ja-JP'));
                    
                    this.hideSyncProgress();
                    this.updateSyncInfo();
                    this.showToast('Driveからダウンロードしました');
                } else {
                    throw new Error('無効なデータ形式です');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            this.hideSyncProgress();
            console.error('ダウンロードエラー:', error);
            this.showToast(`ダウンロードに失敗しました: ${error.message}`);
        }
    }

    showSyncProgress() {
        this.elements.syncProgress.classList.remove('hidden');
    }

    hideSyncProgress() {
        this.elements.syncProgress.classList.add('hidden');
    }

    // PWA setup
    setupPWA() {
        // Register service worker when available
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered');
                })
                .catch(error => {
                    console.log('Service Worker registration failed');
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