                const bookItem = document.createElement('div');
                bookItem.className = 'series-book-item';
                
                const { volumeNumber } = extractVolumeNumber(book.title);
                const displayVolume = volumeNumber || '?';
                
                const statusClass = getStatusClass(book.status);
                
                bookItem.innerHTML = `
                    <div class="series-book-cover">
                        <img src="${book.coverSrc}" alt="${book.title}の書影" onerror="this.src='icons/placeholder.svg'">
                    </div>
                    <div class="series-book-info">
                        <h4>${displayVolume}</h4>
                        <p class="${statusClass}">${getStatusText(book.status)}</p>
                    </div>
                `;
                
                // クリックイベントで詳細表示
                bookItem.addEventListener('click', () => {
                    showRecordDetails(book);
                });
                
                seriesBooks.appendChild(bookItem);
            });
            
            bookListContainer.appendChild(seriesGroup);
        });
        
        // 単独の本を表示（シリーズの下）
        if (singleBooks.length > 0) {
            const nonSeriesGroup = document.createElement('div');
            nonSeriesGroup.className = 'series-group';
            
            nonSeriesGroup.innerHTML = `
                <div class="series-header">
                    <h3 class="series-title">単行本</h3>
                </div>
                <div class="grid-view"></div>
            `;
            
            const gridContainer = nonSeriesGroup.querySelector('.grid-view');
            
            singleBooks.forEach(book => {
                const gridItem = createGridItem(book);
                gridContainer.appendChild(gridItem);
            });
            
            bookListContainer.appendChild(nonSeriesGroup);
        }
    }
    
    // シリーズタイトルでグループ化する関数
    function groupBySeriesTitle(records) {
        const groups = {};
        
        records.forEach(record => {
            const { title } = extractVolumeNumber(record.title);
            
            // 巻数がある場合のみシリーズとして扱う
            if (extractVolumeNumber(record.title).volumeNumber) {
                if (!groups[title]) {
                    groups[title] = [];
                }
                groups[title].push(record);
            }
        });
        
        // 1冊しかないシリーズは除外
        Object.keys(groups).forEach(title => {
            if (groups[title].length <= 1) {
                delete groups[title];
            }
        });
        
        return groups;
    }
    
    // 読書記録アイテムを表示する関数
    function displayRecordItem(record) {
        const statusText = getStatusText(record.status);
        const statusClass = getStatusClass(record.status);
        
        // タイトルから巻数を抽出
        const { title, volumeNumber } = extractVolumeNumber(record.title);
        const displayTitle = volumeNumber ? 
            `${title} (${volumeNumber})` : 
            title;
        
        const recordElement = document.createElement('div');
        recordElement.className = 'book-list-item';
        
        // 星評価の表示を作成
        let ratingHtml = '';
        if (record.rating) {
            ratingHtml = createRatingStars(record.rating);
        }
        
        // タグの表示を作成
        let tagsHtml = '';
        if (record.tags && record.tags.length > 0) {
            tagsHtml = '<div class="book-list-tags">';
            record.tags.forEach(tag => {
                tagsHtml += `<span class="book-list-tag">${tag}</span>`;
            });
            tagsHtml += '</div>';
        }
        
        // 読了日の表示
        let completionDateHtml = '';
        if (record.status === 'finished' && record.completionDate) {
            const formattedDate = formatDate(record.completionDate);
            completionDateHtml = `<p>読了日: ${formattedDate}</p>`;
        }
        
        recordElement.innerHTML = `
            <img class="book-list-cover" src="${record.coverSrc}" alt="${record.title}の書影" onerror="this.src='icons/placeholder.svg'">
            <div class="book-list-info">
                <h3 class="book-list-title">${displayTitle}</h3>
                <p>${record.author}</p>
                <span class="book-list-status ${statusClass}">${statusText}</span>
                ${ratingHtml}
                ${tagsHtml}
                ${completionDateHtml}
                <p class="book-list-date">追加日: ${formatDate(record.addedDate)}</p>
            </div>
        `;
        
        // クリックイベントで詳細表示
        recordElement.addEventListener('click', () => {
            showRecordDetails(record);
        });
        
        bookListContainer.appendChild(recordElement);
    }
    
    // 読書記録の詳細を表示する関数
    function showRecordDetails(record) {
        // 現在編集中の記録IDを設定
        currentRecordId = record.id;
        
        // 削除ボタンを表示
        deleteBookButton.style.display = 'block';
        
        // 書籍情報を表示
        displayBookInfo(record);
    }
    
    // 削除確認モーダルを表示する関数
    function showDeleteConfirmation() {
        deleteModal.style.display = 'flex';
    }
    
    // 読書記録を削除する関数
    function deleteRecord() {
        if (!currentRecordId) {
            deleteModal.style.display = 'none';
            return;
        }
        
        // 既存の読書記録を取得
        let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        
        // 削除対象の記録のインデックスを取得
        const index = records.findIndex(record => record.id === currentRecordId);
        
        if (index !== -1) {
            // 記録を削除
            records.splice(index, 1);
            
            // ローカルストレージに保存
            localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
            
            // 読書記録を再表示
            loadReadingRecords();
            
            // 書籍情報コンテナを非表示
            bookContainer.style.display = 'none';
            
            // 編集モードをリセット
            resetEditMode();
            
            // モーダルを閉じる
            deleteModal.style.display = 'none';
            
            // 通知を表示
            showNotification('読書記録を削除しました', 'success');
        } else {
            // モーダルを閉じる
            deleteModal.style.display = 'none';
        }
    }
    
    // 編集モードをリセットする関数
    function resetEditMode() {
        // 編集中の記録IDをリセット
        currentRecordId = null;
        
        // 削除ボタンを非表示
        deleteBookButton.style.display = 'none';
        
        // 戻るボタンを非表示
        backButton.style.display = 'none';
        
        // 入力欄をクリア
        readingNotes.value = '';
        
        // 読書状況を「未読」に設定
        readingStatusSelect.value = 'unread';
        
        // 読書状況ボタンを更新
        statusButtons.forEach(button => {
            if (button.getAttribute('data-status') === 'unread') {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        // 読了日コンテナを非表示
        completionDateContainer.classList.remove('show');
        completionDateInput.value = '';
        
        // 評価をリセット
        setRating(0);
        
        // タグをリセット
        currentTags = [];
        updateTagsDisplay();
    }
    
    // 表示モードを設定する関数
    function setViewMode(mode) {
        // 表示ボタンの状態を更新
        listViewButton.classList.remove('active');
        gridViewButton.classList.remove('active');
        seriesViewButton.classList.remove('active');
        
        switch(mode) {
            case 'grid':
                gridViewButton.classList.add('active');
                break;
            case 'series':
                seriesViewButton.classList.add('active');
                break;
            default:
                listViewButton.classList.add('active');
                mode = 'list';
                break;
        }
        
        // 設定を保存
        saveSettings('viewMode', mode);
        
        // 読書記録を再表示
        applyFiltersAndSort();
    }
    
    // テーマを切り替える関数
    function toggleTheme() {
        const hasTheme = document.body.hasAttribute('data-theme');
        
        if (hasTheme) {
            const currentTheme = document.body.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                document.body.setAttribute('data-theme', 'light');
                themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
                saveSettings('theme', 'light');
            } else {
                document.body.setAttribute('data-theme', 'dark');
                themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
                saveSettings('theme', 'dark');
            }
        } else {
            document.body.setAttribute('data-theme', 'dark');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            saveSettings('theme', 'dark');
        }
    }
    
    // 設定を読み込む関数
    function loadSettings() {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            
            // テーマを適用
            if (settings.theme === 'dark') {
                document.body.setAttribute('data-theme', 'dark');
                themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            } else if (settings.theme === 'light') {
                document.body.setAttribute('data-theme', 'light');
                themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            } else {
                // テーマが設定されていない場合は、ユーザーのシステム設定に従う
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (prefersDark) {
                    document.body.setAttribute('data-theme', 'dark');
                    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
                }
            }
            
            // 表示モードを適用
            if (settings.viewMode) {
                setViewMode(settings.viewMode);
            }
        } else {
            // 設定がない場合は、ユーザーのシステム設定に従う
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                document.body.setAttribute('data-theme', 'dark');
                themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            }
        }
    }
    
    // 設定を取得する関数
    function getSettings() {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        return savedSettings ? JSON.parse(savedSettings) : {};
    }
    
    // 設定を保存する関数
    function saveSettings(key, value) {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        const settings = savedSettings ? JSON.parse(savedSettings) : {};
        
        settings[key] = value;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
    
    // 全画面スキャナーの切り替え
    function toggleFullscreenScanner() {
        const isFullscreen = scannerContainer.classList.toggle('fullscreen-scanner');
        
        if (isFullscreen) {
            document.body.style.overflow = 'hidden'; // スクロールを無効化
            fullscreenButton.innerHTML = '<i class="fas fa-compress"></i> 通常表示';
            
            // 画面がロックされないようにする
            if (navigator.wakeLock && isMobileDevice()) {
                navigator.wakeLock.request('screen')
                    .then(wakeLock => {
                        // wakeLockを保存
                        scannerContainer.wakeLock = wakeLock;
                    })
                    .catch(err => {
                        console.log('画面ロック防止機能は利用できません:', err);
                    });
            }
            
            // 画面の向きを横向きに固定（可能な場合）
            if (screen.orientation && isMobileDevice()) {
                screen.orientation.lock('landscape')
                    .catch(err => {
                        console.log('画面の向きを固定できませんでした:', err);
                    });
            }
            
            // スキャンエリアのサイズを調整
            adjustVideoSize();
        } else {
            document.body.style.overflow = ''; // スクロールを有効化
            fullscreenButton.innerHTML = '<i class="fas fa-expand"></i> 全画面';
            
            // wakeLockを解除
            if (scannerContainer.wakeLock) {
                scannerContainer.wakeLock.release();
                scannerContainer.wakeLock = null;
            }
            
            // 画面の向きの固定を解除
            if (screen.orientation && isMobileDevice()) {
                screen.orientation.unlock();
            }
        }
    }
    
    // ビデオサイズを調整する関数
    function adjustVideoSize() {
        if (scannerVideo && scannerContainer.classList.contains('fullscreen-scanner')) {
            // 画面の向きに応じてビデオのスタイルを調整
            if (window.innerWidth > window.innerHeight) {
                // 横向き
                scannerVideo.style.width = '100%';
                scannerVideo.style.height = 'auto';
            } else {
                // 縦向き
                scannerVideo.style.height = '80%';
                scannerVideo.style.width = 'auto';
            }
        }
    }
    
    // モバイルデバイスかどうかを判定する関数
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    // エラーメッセージを表示する関数
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
    
    // エラーメッセージを非表示にする関数
    function hideError() {
        errorMessage.style.display = 'none';
    }
    
    // 通知を表示する関数
    function showNotification(message, type = 'success') {
        // 既存の通知を削除
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => {
            notification.remove();
        });
        
        // 通知を作成
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // 通知を追加
        document.body.appendChild(notification);
        
        // 自動的に削除（アニメーションが終わった後）
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // 読書状況のテキストを取得する関数
    function getStatusText(status) {
        switch(status) {
            case 'unread':
                return '未読';
            case 'reading':
                return '読書中';
            case 'finished':
                return '読了';
            default:
                return '不明';
        }
    }
    
    // 読書状況のクラス名を取得する関数
    function getStatusClass(status) {
        switch(status) {
            case 'unread':
                return 'status-unread';
            case 'reading':
                return 'status-reading';
            case 'finished':
                return 'status-finished';
            default:
                return '';
        }
    }
    
    // 星評価のHTML文字列を作成する関数
    function createRatingStars(rating) {
        let html = '<div class="book-list-rating">';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                html += '<i class="fas fa-star active"></i>';
            } else {
                html += '<i class="fas fa-star"></i>';
            }
        }
        html += '</div>';
        return html;
    }
    
    // 日付をフォーマットする関数
    function formatDate(dateStr) {
        if (!dateStr) return '';
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return dateStr;
        }
        
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    }
    
    // PWAのインストールプロンプト
    if (isMobileDevice()) {
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            // インストールプロンプトの表示を防止
            e.preventDefault();
            // プロンプトを保存
            deferredPrompt = e;
            
            // インストール案内のバナーを表示
            const installBanner = document.createElement('div');
            installBanner.innerHTML = `
                <div style="position: fixed; bottom: 0; left: 0; right: 0; background-color: var(--primary-color); color: white; padding: 10px; display: flex; justify-content: space-between; align-items: center; z-index: 1000;">
                    <span>ホーム画面に追加して、オフラインで使用できます</span>
                    <button id="install-button" style="background-color: white; color: var(--primary-color); border: none; padding: 8px 16px; border-radius: 4px;">追加</button>
                    <button id="close-banner" style="background: none; border: none; color: white; font-size: 20px; margin-left: 10px;">&times;</button>
                </div>
            `;
            document.body.appendChild(installBanner);
            
            // 追加ボタンのイベント
            document.getElementById('install-button').addEventListener('click', () => {
                // プロンプトを表示
                deferredPrompt.prompt();
                // ユーザーの選択を待つ
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('ユーザーがPWAのインストールを承認しました');
                    } else {
                        console.log('ユーザーがPWAのインストールを拒否しました');
                    }
                    deferredPrompt = null;
                    installBanner.remove();
                });
            });
            
            // 閉じるボタンのイベント
            document.getElementById('close-banner').addEventListener('click', () => {
                installBanner.remove();
            });
        });
        
        // スマートフォン用のタッチイベント最適化
        document.addEventListener('touchstart', function(e) {
            // iOSのダブルタップによるズームを防止（入力フィールドと選択フィールドは除く）
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
                e.preventDefault();
            }
        }, { passive: false });
    }
});// Service Workerの登録
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('Service Workerが登録されました:', registration.scope);
            })
            .catch(error => {
                console.error('Service Workerの登録に失敗しました:', error);
            });
    });
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', function() {
    // DOM要素の取得
    const isbnInput = document.getElementById('isbn-input');
    const searchButton = document.getElementById('search-button');
    const errorMessage = document.getElementById('error-message');
    const bookContainer = document.getElementById('book-container');
    const bookCoverImg = document.getElementById('book-cover-img');
    const bookTitle = document.getElementById('book-title');
    const bookAuthor = document.getElementById('book-author');
    const bookPublisher = document.getElementById('book-publisher');
    const bookPublishedDate = document.getElementById('book-published-date');
    const bookIsbn = document.getElementById('book-isbn');
    const readingStatusSelect = document.getElementById('reading-status-select');
    const readingNotes = document.getElementById('reading-notes');
    const addBookButton = document.getElementById('add-book-button');
    const deleteBookButton = document.getElementById('delete-book-button');
    const bookListContainer = document.getElementById('book-list-container');
    const manualOption = document.getElementById('manual-option');
    const scanOption = document.getElementById('scan-option');
    const manualContainer = document.getElementById('manual-container');
    const scannerContainer = document.getElementById('scanner-container');
    const scannerVideo = document.getElementById('scanner-video');
    const scannerSwitchButton = document.getElementById('scanner-switch-button');
    const scannerStopButton = document.getElementById('scanner-stop-button');
    const fullscreenButton = document.getElementById('fullscreen-button');
    const floatingButton = document.getElementById('add-button');
    const loadingElement = document.getElementById('loading');
    const offlineMessage = document.getElementById('offline-message');
    const ratingStars = document.getElementById('rating-stars');
    const tagInput = document.getElementById('tag-input');
    const tagsInputContainer = document.getElementById('tags-input-container');
    const tagSuggestions = document.getElementById('tag-suggestions');
    const filterStatus = document.getElementById('filter-status');
    const filterRating = document.getElementById('filter-rating');
    const sortBy = document.getElementById('sort-by');
    const filterTags = document.getElementById('filter-tags');
    const deleteModal = document.getElementById('delete-modal');
    const confirmDelete = document.getElementById('confirm-delete');
    const cancelDelete = document.getElementById('cancel-delete');
    const completionDateContainer = document.getElementById('completion-date');
    const completionDateInput = document.getElementById('completion-date-input');
    const statusButtons = document.querySelectorAll('.status-button');
    const themeToggle = document.getElementById('theme-toggle');
    const homeButton = document.getElementById('home-button');
    const backButton = document.getElementById('back-button');
    const listViewButton = document.getElementById('list-view-button');
    const gridViewButton = document.getElementById('grid-view-button');
    const seriesViewButton = document.getElementById('series-view-button');
    const mockApiControls = document.getElementById('mock-api-controls');
    const useMockApiCheckbox = document.getElementById('use-mock-api');

    // 読書記録を保存するローカルストレージのキー
    const STORAGE_KEY = 'reading_records';
    const TAGS_KEY = 'reading_tags';
    const SETTINGS_KEY = 'reading_settings';
    
    // 現在編集中の記録ID
    let currentRecordId = null;
    
    // 現在の評価（星）
    let currentRating = 0;
    
    // 現在のタグリスト
    let currentTags = [];
    
    // 全タグリスト
    let allTags = [];
    
    // アクティブなタグフィルター
    let activeTagFilters = [];
    
    // API呼び出しの再試行カウンター
    let apiRetryCount = 0;
    const MAX_API_RETRIES = 3;
    
    // スキャンタイムアウト
    let scanTimeoutId = null;
    
    // 設定を読み込む
    loadSettings();
    
    // オフライン状態の監視
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // URLパラメータを処理
    processUrlParams();
    
    // 初期表示時にオンライン状態を確認
    updateOnlineStatus();
    
    // 検索ボタンのクリックイベント
    searchButton.addEventListener('click', searchBook);

    // 追加ボタンのクリックイベント
    addBookButton.addEventListener('click', addBookToRecords);
    
    // 削除ボタンのクリックイベント
    deleteBookButton.addEventListener('click', showDeleteConfirmation);
    
    // 削除確認ボタンのイベント
    confirmDelete.addEventListener('click', deleteRecord);
    
    // 削除キャンセルボタンのイベント
    cancelDelete.addEventListener('click', () => {
        deleteModal.style.display = 'none';
    });

    // 検索オプションの切り替え
    manualOption.addEventListener('click', () => {
        manualOption.classList.add('active');
        scanOption.classList.remove('active');
        manualContainer.style.display = 'block';
        scannerContainer.style.display = 'none';
        if (codeReader) {
            codeReader.reset();
            clearScanTimeout();
        }
    });

    scanOption.addEventListener('click', () => {
        scanOption.classList.add('active');
        manualOption.classList.remove('active');
        manualContainer.style.display = 'none';
        scannerContainer.style.display = 'block';
        initScanner();
    });

    // カメラ切替ボタンのクリックイベント
    scannerSwitchButton.addEventListener('click', () => {
        if (codeReader && availableDevices.length > 1) {
            // 現在のデバイスのインデックスを取得
            const currentIndex = availableDevices.findIndex(device => device.deviceId === selectedDeviceId);
            // 次のデバイスを選択
            const nextIndex = (currentIndex + 1) % availableDevices.length;
            selectedDeviceId = availableDevices[nextIndex].deviceId;
            
            // スキャナーを再起動
            codeReader.reset();
            clearScanTimeout();
            startScanner(selectedDeviceId);
        }
    });

    // スキャン停止ボタンのクリックイベント
    scannerStopButton.addEventListener('click', () => {
        if (codeReader) {
            codeReader.reset();
            clearScanTimeout();
            manualOption.click(); // 手動入力に切り替え
        }
    });
    
    // 全画面ボタンのクリックイベント
    if (fullscreenButton) {
        fullscreenButton.addEventListener('click', toggleFullscreenScanner);
    }

    // フローティングボタンのクリックイベント
    floatingButton.addEventListener('click', () => {
        // トップに戻ってISBN入力フォームにフォーカス
        window.scrollTo(0, 0);
        isbnInput.focus();
        
        // 編集モードをリセット
        resetEditMode();
    });

    // エンターキーでの検索
    isbnInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchBook();
        }
    });
    
    // 星評価のクリックイベント
    ratingStars.addEventListener('click', function(e) {
        if (e.target.tagName === 'I') {
            const rating = parseInt(e.target.getAttribute('data-rating'));
            setRating(rating);
        }
    });
    
    // 星評価のマウスオーバーイベント
    ratingStars.addEventListener('mouseover', function(e) {
        if (e.target.tagName === 'I') {
            const rating = parseInt(e.target.getAttribute('data-rating'));
            highlightStars(rating);
        }
    });
    
    // 星評価のマウスアウトイベント
    ratingStars.addEventListener('mouseout', function() {
        highlightStars(currentRating);
    });
    
    // タグ入力のキーアップイベント
    tagInput.addEventListener('keyup', function(e) {
        const value = e.target.value.trim();
        
        if (e.key === 'Enter' && value) {
            addTag(value);
            e.target.value = '';
            tagSuggestions.style.display = 'none';
        } else if (value) {
            showTagSuggestions(value);
        } else {
            tagSuggestions.style.display = 'none';
        }
    });
    
    // タグ入力のフォーカスイベント
    tagInput.addEventListener('focus', function() {
        if (this.value.trim()) {
            showTagSuggestions(this.value.trim());
        }
    });
    
    // フィルターと並び替えのイベント
    filterStatus.addEventListener('change', applyFiltersAndSort);
    filterRating.addEventListener('change', applyFiltersAndSort);
    sortBy.addEventListener('change', applyFiltersAndSort);
    
    // 読書状況ボタンのイベント
    statusButtons.forEach(button => {
        button.addEventListener('click', function() {
            // 現在のアクティブボタンを非アクティブに
            statusButtons.forEach(btn => btn.classList.remove('active'));
            
            // クリックされたボタンをアクティブに
            this.classList.add('active');
            
            // セレクトボックスの値を更新
            const status = this.getAttribute('data-status');
            readingStatusSelect.value = status;
            
            // 読了の場合は読了日入力欄を表示
            if (status === 'finished') {
                completionDateContainer.classList.add('show');
                // 読了日が未設定の場合は今日の日付をセット
                if (!completionDateInput.value) {
                    const today = new Date().toISOString().split('T')[0];
                    completionDateInput.value = today;
                }
            } else {
                completionDateContainer.classList.remove('show');
            }
        });
    });
    
    // テーマ切り替えボタンのイベント
    themeToggle.addEventListener('click', toggleTheme);
    
    // ホームボタンのイベント
    homeButton.addEventListener('click', () => {
        // 書籍情報コンテナを非表示
        bookContainer.style.display = 'none';
        
        // 編集モードをリセット
        resetEditMode();
        
        // 読書記録一覧を表示
        loadReadingRecords();
    });
    
    // 戻るボタンのイベント
    backButton.addEventListener('click', () => {
        // 書籍情報コンテナを非表示
        bookContainer.style.display = 'none';
        
        // 編集モードをリセット
        resetEditMode();
    });
    
    // 表示切替ボタンのイベント
    listViewButton.addEventListener('click', () => {
        setViewMode('list');
    });
    
    gridViewButton.addEventListener('click', () => {
        setViewMode('grid');
    });
    
    seriesViewButton.addEventListener('click', () => {
        setViewMode('series');
    });
    
    // モックAPIの切り替えイベント
    useMockApiCheckbox.addEventListener('change', function() {
        localStorage.setItem('use_mock_api', this.checked ? 'true' : 'false');
        showNotification(this.checked ? 'スタンドアロンモードに切り替えました' : 'サーバーモードに切り替えました', 'success');
    });
    
    // モックAPIの設定を読み込む
    const savedUseMockApi = localStorage.getItem('use_mock_api');
    if (savedUseMockApi !== null) {
        useMockApiCheckbox.checked = savedUseMockApi === 'true';
    }
    
    // 開発環境のみモックAPIコントロールを表示
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        mockApiControls.style.display = 'block';
    } else {
        // 常にモックAPIを使用
        useMockApiCheckbox.checked = true;
        mockApiControls.style.display = 'block';
    }

    // バーコードスキャナー関連の変数
    let codeReader = null;
    let selectedDeviceId = null;
    let availableDevices = [];

    // 初期表示時に読書記録を読み込む
    loadReadingRecords();
    
    // 保存されたタグを読み込む
    loadTags();
    
    // オンライン状態を更新する関数
    function updateOnlineStatus() {
        if (navigator.onLine) {
            offlineMessage.style.display = 'none';
        } else {
            offlineMessage.style.display = 'block';
            // オフラインの場合はモックAPIを有効化
            useMockApiCheckbox.checked = true;
        }
    }
    
    // URLパラメータを処理する関数
    function processUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('scan') && urlParams.get('scan') === 'true') {
            // スキャンモードを自動的に開始
            setTimeout(() => {
                scanOption.click();
            }, 500);
        }
        if (urlParams.has('add') && urlParams.get('add') === 'true') {
            // ISBN入力フォームにフォーカス
            setTimeout(() => {
                isbnInput.focus();
            }, 500);
        }
    }

    // バーコードスキャナーの初期化
    function initScanner() {
        if (!codeReader) {
            try {
                if (typeof ZXing === 'undefined') {
                    console.error('ZXingライブラリが読み込まれていません');
                    showError('バーコードスキャナーの初期化に失敗しました: ZXingライブラリが見つかりません');
                    manualOption.click();
                    return;
                }
                
                codeReader = new ZXing.BrowserMultiFormatReader();
                
                // カメラのアクセス許可を事前に確認
                navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                    .then(() => {
                        // 利用可能なビデオデバイスを取得
                        codeReader.listVideoInputDevices()
                            .then((videoInputDevices) => {
                                if (videoInputDevices.length === 0) {
                                    showError('カメラが見つかりませんでした');
                                    manualOption.click();
                                    return;
                                }
                                
                                availableDevices = videoInputDevices;
                                console.log('利用可能なカメラ:', availableDevices);
                                
                                // モバイルデバイスの場合は背面カメラを優先
                                if (isMobileDevice()) {
                                    const backCamera = videoInputDevices.find(device => 
                                        device.label.toLowerCase().includes('back') || 
                                        device.label.toLowerCase().includes('後') ||
                                        device.label.toLowerCase().includes('背面') ||
                                        device.label.toLowerCase().includes('rear') ||
                                        device.label.toLowerCase().includes('環境') ||
                                        !device.label.toLowerCase().includes('front')
                                    );
                                    
                                    selectedDeviceId = backCamera ? backCamera.deviceId : videoInputDevices[0].deviceId;
                                    console.log('選択されたカメラID:', selectedDeviceId);
                                } else {
                                    // デスクトップの場合は最初のカメラを使用
                                    selectedDeviceId = videoInputDevices[0].deviceId;
                                }
                                
                                // カメラデバイスの切り替えボタンの表示/非表示を設定
                                scannerSwitchButton.style.display = videoInputDevices.length > 1 ? 'block' : 'none';
                                
                                // スキャン開始
                                startScanner(selectedDeviceId);
                            })
                            .catch((err) => {
                                console.error('カメラデバイスの一覧取得エラー:', err);
                                showError('カメラデバイスの一覧を取得できませんでした');
                                manualOption.click();
                            });
                    })
                    .catch((err) => {
                        console.error('カメラのアクセス許可エラー:', err);
                        showError('カメラへのアクセスが許可されていません。ブラウザの設定でカメラへのアクセスを許可してください。');
                        manualOption.click();
                    });
            } catch (err) {
                console.error('バーコードスキャナー初期化エラー:', err);
                showError('バーコードスキャナーの初期化に失敗しました');
                manualOption.click();
            }
        } else {
            try {
                startScanner(selectedDeviceId);
            } catch (err) {
                console.error('スキャナー再起動エラー:', err);
                showError('スキャナーの再起動に失敗しました');
                manualOption.click();
            }
        }
    }

    // スキャン開始
    function startScanner(deviceId) {
        try {
            // デコード前にリセットして確実に新しいセッションを開始
            if (codeReader) {
                codeReader.reset();
                clearScanTimeout();
            }
            
            // ローディング表示
            scannerVideo.style.filter = 'blur(3px)';
            const loadingElement = document.createElement('div');
            loadingElement.className = 'loading-spinner';
            loadingElement.style.position = 'absolute';
            loadingElement.style.top = '50%';
            loadingElement.style.left = '50%';
            loadingElement.style.transform = 'translate(-50%, -50%)';
            scannerContainer.style.position = 'relative';
            scannerContainer.appendChild(loadingElement);
            
            // フォーマット指定（ISBN-13のEAN-13フォーマットとISBN-10のコード39フォーマットを含む）
            const hints = new Map();
            hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
                ZXing.BarcodeFormat.EAN_13,
                ZXing.BarcodeFormat.CODE_39,
                ZXing.BarcodeFormat.CODE_128
            ]);
            
            // デコード開始
            codeReader.decodeFromVideoDevice(deviceId, scannerVideo, (result, err) => {
                // ローディング表示を削除
                scannerVideo.style.filter = '';
                const loadingSpinner = scannerContainer.querySelector('.loading-spinner');
                if (loadingSpinner) {
                    loadingSpinner.remove();
                }
                
                if (err && !(err instanceof ZXing.NotFoundException)) {
                    console.error('デコードエラー:', err);
                    showError('バーコードの読み取り中にエラーが発生しました');
                    return;
                }
                
                if (result) {
                    // ISBNが検出された場合
                    const rawIsbn = result.getText();
                    console.log('検出されたバーコード:', rawIsbn);
                    
                    // 検出したバーコードを強調表示
                    const canvas = document.createElement('canvas');
                    canvas.width = scannerVideo.videoWidth;
                    canvas.height = scannerVideo.videoHeight;
                    canvas.style.position = 'absolute';
                    canvas.style.top = '0';
                    canvas.style.left = '0';
                    scannerContainer.appendChild(canvas);
                    
                    const ctx = canvas.getContext('2d');
                    const resultPoints = result.getResultPoints();
                    
                    ctx.beginPath();
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 5;
                    ctx.moveTo(resultPoints[0].getX(), resultPoints[0].getY());
                    for (let i = 1; i < resultPoints.length; i++) {
                        ctx.lineTo(resultPoints[i].getX(), resultPoints[i].getY());
                    }
                    ctx.closePath();
                    ctx.stroke();
                    
                    // ISBNの形式を確認（数字とハイフンのみ）
                    if (/^[0-9\-]+$/.test(rawIsbn)) {
                        // ハイフンを除去
                        const isbn = rawIsbn.replace(/-/g, '');
                        
                        // 10桁または13桁のISBNかチェック
                        if (isbn.length === 10 || isbn.length === 13) {
                            // 成功通知を表示
                            showNotification('バーコードを読み取りました: ' + isbn);
                            
                            // スキャナーを一時停止
                            clearScanTimeout();
                            setTimeout(() => {
                                codeReader.reset();
                                
                                // 検索フォームに入力して検索
                                isbnInput.value = isbn;
                                searchBook();
                                
                                // 手動入力に戻す
                                setTimeout(() => {
                                    canvas.remove();
                                    manualOption.click();
                                }, 500);
                            }, 1000);
                        } else {
                            // ISBNの桁数が不正
                            showError('有効なISBNではありません。10桁または13桁のISBNを読み取ってください。');
                            setTimeout(() => canvas.remove(), 1000);
                        }
                    } else {
                        // ISBNの形式が不正
                        showError('バーコードからISBNを検出できませんでした。');
                        setTimeout(() => canvas.remove(), 1000);
                    }
                }
            }, hints).catch(err => {
                console.error('デコード開始エラー:', err);
                showError('カメラからのデコードを開始できませんでした');
                scannerVideo.style.filter = '';
                const loadingSpinner = scannerContainer.querySelector('.loading-spinner');
                if (loadingSpinner) {
                    loadingSpinner.remove();
                }
            });
            
            // スキャンタイムアウト設定
            startScanTimeout();
        } catch (error) {
            console.error('startScannerエラー:', error);
            showError('スキャナーの起動に失敗しました: ' + error.message);
        }
    }

    // ISBNから書籍情報を検索する関数
    function searchBook() {
        const isbn = isbnInput.value.trim().replace(/-/g, '');
        
        if (!isbn) {
            showError('ISBNを入力してください');
            return;
        }

        if (!/^\d{10}(\d{3})?$/.test(isbn)) {
            showError('ISBNは10桁または13桁の数字で入力してください');
            return;
        }

        // エラーメッセージをクリア
        hideError();
        
        // ローディング表示
        loadingElement.style.display = 'block';
        
        // 編集モードをリセット
        resetEditMode();

        // オフライン時またはモックAPI使用時はローカルデータを検索
        if (!navigator.onLine || useMockApiCheckbox.checked) {
            // 既存の記録を検索
            const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            const existingRecord = records.find(record => record.isbn === isbn);
            
            if (existingRecord) {
                displayBookInfo(existingRecord);
                loadingElement.style.display = 'none';
                return;
            } else if (useMockApiCheckbox.checked) {
                // モックデータを生成
                const mockBookData = generateMockBookData(isbn);
                displayBookInfo(mockBookData);
                loadingElement.style.display = 'none';
                return;
            } else {
                loadingElement.style.display = 'none';
                showError('オフラインモードでは新しい書籍を検索できません');
                return;
            }
        }

        // APIリトライカウンターをリセット
        apiRetryCount = 0;
        
        // 書籍情報を取得
        fetchBookInfo(isbn);
    }
    
    // 書籍情報をAPIから取得する関数
    function fetchBookInfo(isbn) {
        // サーバーAPIを使用して書籍情報を取得
        fetch(`/api/books?isbn=${isbn}`)
            .then(response => {
                if (!response.ok) {
                    if (response.status === 429) {
                        // レート制限エラーの場合
                        throw new Error('APIのリクエスト制限に達しました。しばらく待ってから再試行してください。');
                    }
                    throw new Error('ネットワークエラーが発生しました');
                }
                return response.json();
            })
            .then(bookInfo => {
                // ローディング非表示
                loadingElement.style.display = 'none';
                
                // 評価をリセット
                setRating(0);
                
                // タグをリセット
                currentTags = [];
                updateTagsDisplay();
                
                // UI更新
                displayBookInfo(bookInfo);
            })
            .catch(error => {
                console.error('Error fetching book data:', error);
                
                // レート制限エラーの場合、一定時間後に再試行
                if (error.message.includes('リクエスト制限') && apiRetryCount < MAX_API_RETRIES) {
                    apiRetryCount++;
                    const retryDelay = 2000 * apiRetryCount; // 徐々に待ち時間を増やす
                    
                    showError(`APIのリクエスト制限に達しました。${retryDelay/1000}秒後に再試行します...`);
                    
                    setTimeout(() => {
                        fetchBookInfo(isbn);
                    }, retryDelay);
                    
                    return;
                }
                
                // ローディング非表示
                loadingElement.style.display = 'none';
                showError(error.message);
                bookContainer.style.display = 'none';
                
                // ローカルに保存されている書籍を検索
                const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
                const existingRecord = records.find(record => record.isbn === isbn);
                
                if (existingRecord) {
                    showError('オンラインでの検索に失敗しましたが、ローカルに保存されたデータを表示します。');
                    displayBookInfo(existingRecord);
                } else if (useMockApiCheckbox.checked) {
                    // モックデータを生成
                    showError('オンラインでの検索に失敗しましたが、モックデータを生成します。');
                    const mockBookData = generateMockBookData(isbn);
                    displayBookInfo(mockBookData);
                }
            });
    }
    
    // モック書籍データを生成する関数
    function generateMockBookData(isbn) {
        // 13桁のISBNからカテゴリを特定（最初の3桁）
        let category = '';
        let publisher = '';
        
        if (isbn.length === 13) {
            const prefix = isbn.substring(3, 7);
            
            // 出版社のコードからジャンルを推測
            if (prefix >= '0000' && prefix <= '2499') {
                category = '文学・小説';
                publisher = 'サンプル出版社';
            } else if (prefix >= '2500' && prefix <= '3999') {
                category = 'コミック・漫画';
                publisher = 'コミックハウス';
            } else if (prefix >= '40' && prefix <= '69') {
                category = '実用書・ビジネス';
                publisher = 'ビジネスプレス';
            } else if (prefix >= '70' && prefix <= '84') {
                category = '科学・技術書';
                publisher = 'サイエンス出版';
            } else {
                category = '一般書籍';
                publisher = '一般書籍出版';
            }
        }
        
        // タイトルを生成
        let title = `サンプル書籍（ISBN: ${isbn}）`;
        
        // シリーズ物の場合
        if (Math.random() > 0.7) {
            const volume = Math.floor(Math.random() * 20) + 1;
            title = `サンプルシリーズ ${volume}巻`;
        }
        
        // 著者名を生成
        const authorSurnames = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤'];
        const authorNames = ['太郎', '次郎', '花子', '裕子', '健太', '翔太', '優子', '直樹', '洋介', '恵子'];
        const author = `${authorSurnames[Math.floor(Math.random() * authorSurnames.length)]} ${authorNames[Math.floor(Math.random() * authorNames.length)]}`;
        
        // 出版日を生成（過去10年以内）
        const currentYear = new Date().getFullYear();
        const year = currentYear - Math.floor(Math.random() * 10);
        const month = Math.floor(Math.random() * 12) + 1;
        const day = Math.floor(Math.random() * 28) + 1;
        const publishedDate = `${year}年${month}月${day}日`;
        
        // カバー画像を生成
        const coverSrc = `https://via.placeholder.com/140x200/4488cc/ffffff?text=${encodeURIComponent(title)}`;
        
        return {
            title,
            author,
            publisher,
            publishedDate,
            isbn,
            coverSrc,
            category
        };
    }
    
    // 書籍情報を表示する関数
    function displayBookInfo(bookInfo) {
        // タイトルから巻数を抽出
        const { title, volumeNumber } = extractVolumeNumber(bookInfo.title);
        bookTitle.textContent = title + (volumeNumber ? ` (${volumeNumber})` : '');
        
        // 著者、出版社、出版日をリンクとして設定
        bookAuthor.innerHTML = '著者: <a href="#" class="book-link" data-type="author" data-value="' + 
            bookInfo.author + '">' + bookInfo.author + '</a>';
        bookPublisher.innerHTML = '出版社: <a href="#" class="book-link" data-type="publisher" data-value="' + 
            bookInfo.publisher + '">' + bookInfo.publisher + '</a>';
        bookPublishedDate.textContent = '出版日: ' + bookInfo.publishedDate;
        bookIsbn.textContent = 'ISBN: ' + bookInfo.isbn;
        
        // 書影がある場合は表示、なければプレースホルダー
        if (bookInfo.coverSrc) {
            bookCoverImg.src = bookInfo.coverSrc;
        } else {
            bookCoverImg.src = 'icons/placeholder.svg';
        }
        
        // 書籍情報コンテナを表示
        bookContainer.style.display = 'block';
        
        // 入力欄をクリア
        readingNotes.value = bookInfo.notes || '';
        
        // 読書状況を設定
        const status = bookInfo.status || 'unread';
        readingStatusSelect.value = status;
        
        // 読書状況ボタンを更新
        statusButtons.forEach(button => {
            if (button.getAttribute('data-status') === status) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        // 読了日を設定
        if (bookInfo.completionDate) {
            completionDateInput.value = bookInfo.completionDate;
            if (status === 'finished') {
                completionDateContainer.classList.add('show');
            }
        } else {
            completionDateInput.value = '';
            if (status === 'finished') {
                completionDateContainer.classList.add('show');
                const today = new Date().toISOString().split('T')[0];
                completionDateInput.value = today;
            } else {
                completionDateContainer.classList.remove('show');
            }
        }
        
        // 評価を設定
        if (bookInfo.rating) {
            setRating(bookInfo.rating);
        } else {
            setRating(0);
        }
        
        // タグを設定
        if (bookInfo.tags && Array.isArray(bookInfo.tags)) {
            currentTags = [...bookInfo.tags];
        } else {
            currentTags = [];
        }
        updateTagsDisplay();

        // 書籍情報にスクロール
        bookContainer.scrollIntoView({ behavior: 'smooth' });
        
        // リンクのクリックイベントを設定
        setupBookLinks();
        
        // 戻るボタンを表示
        backButton.style.display = 'block';
        
        // 既存の記録の場合は削除ボタンを表示
        if (bookInfo.id) {
            currentRecordId = bookInfo.id;
            deleteBookButton.style.display = 'block';
        }
    }
    
    // スキャンタイムアウト機能
    function startScanTimeout() {
        // 30秒後にスキャンを停止
        clearTimeout(scanTimeoutId);
        scanTimeoutId = setTimeout(() => {
            if (codeReader) {
                showNotification('バーコードを検出できませんでした。手動で入力してください。', 'error');
                manualOption.click();
            }
        }, 30000);
    }

    function clearScanTimeout() {
        if (scanTimeoutId) {
            clearTimeout(scanTimeoutId);
            scanTimeoutId = null;
        }
    }
    
    // 書籍リンクのクリックイベントを設定
    function setupBookLinks() {
        const bookLinks = document.querySelectorAll('.book-link');
        bookLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const type = this.getAttribute('data-type');
                const value = this.getAttribute('data-value');
                
                // フィルターを適用
                filterByAttribute(type, value);
            });
        });
    }
    
    // 属性でフィルタリングする関数
    function filterByAttribute(type, value) {
        let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        let filteredRecords = [];
        
        switch(type) {
            case 'title':
                // タイトルの基本部分で一致するものを検索（巻数を除く）
                const baseTitle = extractVolumeNumber(value).title;
                filteredRecords = records.filter(record => {
                    const recordBaseTitle = extractVolumeNumber(record.title).title;
                    return recordBaseTitle === baseTitle;
                });
                break;
            case 'author':
                filteredRecords = records.filter(record => record.author === value);
                break;
            case 'publisher':
                filteredRecords = records.filter(record => record.publisher === value);
                break;
        }
        
        // 結果を表示
        displayFilteredRecords(filteredRecords, type, value);
    }
    
    // フィルタリング結果を表示
    function displayFilteredRecords(records, type, value) {
        // 書籍情報コンテナを非表示
        bookContainer.style.display = 'none';
        
        // リストをクリア
        bookListContainer.innerHTML = '';
        
        if (records.length === 0) {
            bookListContainer.innerHTML = `<p>「${value}」に一致する読書記録はありません</p>`;
            return;
        }
        
        // フィルタリング情報を表示
        const typeLabels = {
            'title': 'タイトル',
            'author': '著者',
            'publisher': '出版社'
        };
        
        bookListContainer.innerHTML = `<p>「${typeLabels[type]}: ${value}」で絞り込み中 (${records.length}件)</p>`;
        
        // 読書記録を表示
        records.forEach(record => {
            displayRecordItem(record);
        });
    }
    
    // タイトルから巻数を抽出する関数
    function extractVolumeNumber(title) {
        if (!title) return { title: '', volumeNumber: null };
        
        // 巻数のパターン: 第X巻、X巻、(X)、Vol.X、#X など
        const volumePatterns = [
            /第(\d+)巻/,
            /(\d+)巻/,
            /\((\d+)\)/,
            /Vol\.(\d+)/,
            /#(\d+)/,
            /（(\d+)）/,
            /\s(\d+)$/
        ];
        
        let volumeNumber = null;
        let cleanTitle = title;
        
        for (const pattern of volumePatterns) {
            const match = title.match(pattern);
            if (match) {
                volumeNumber = match[1];
                cleanTitle = title.replace(match[0], '').trim();
                break;
            }
        }
        
        return { title: cleanTitle, volumeNumber };
    }
    
    // 評価（星）を設定する関数
    function setRating(rating) {
        currentRating = rating;
        highlightStars(rating);
    }
    
    // 星を強調表示する関数
    function highlightStars(rating) {
        const stars = ratingStars.querySelectorAll('i');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }
    
    // タグを追加する関数
    function addTag(tagName) {
        // 重複チェック
        if (!currentTags.includes(tagName)) {
            currentTags.push(tagName);
            updateTagsDisplay();
            
            // 全タグリストに追加
            if (!allTags.includes(tagName)) {
                allTags.push(tagName);
                saveTags();
                updateTagFilters();
            }
        }
    }
    
    // タグ表示を更新する関数
    function updateTagsDisplay() {
        // 現在のタグ要素を削除（入力フィールド以外）
        const elements = tagsInputContainer.querySelectorAll('.tag');
        elements.forEach(el => el.remove());
        
        // タグを追加
        currentTags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'tag';
            tagElement.innerHTML = `${tag} <span class="remove-tag">&times;</span>`;
            
            // タグ削除イベント
            tagElement.querySelector('.remove-tag').addEventListener('click', () => {
                currentTags = currentTags.filter(t => t !== tag);
                updateTagsDisplay();
            });
            
            // 入力フィールドの前に挿入
            tagsInputContainer.insertBefore(tagElement, tagInput);
        });
    }
    
    // タグ候補を表示する関数
    function showTagSuggestions(query) {
        // 入力に一致するタグをフィルタリング
        const filteredTags = allTags.filter(tag => 
            tag.toLowerCase().includes(query.toLowerCase()) && 
            !currentTags.includes(tag)
        );
        
        if (filteredTags.length === 0) {
            tagSuggestions.style.display = 'none';
            return;
        }
        
        // 候補リストをクリア
        tagSuggestions.innerHTML = '';
        
        // 候補を追加
        filteredTags.forEach(tag => {
            const suggestionElement = document.createElement('div');
            suggestionElement.className = 'tag-suggestion';
            suggestionElement.textContent = tag;
            
            // クリックイベント
            suggestionElement.addEventListener('click', () => {
                addTag(tag);
                tagInput.value = '';
                tagSuggestions.style.display = 'none';
            });
            
            tagSuggestions.appendChild(suggestionElement);
        });
        
        // 候補リストを表示
        tagSuggestions.style.display = 'block';
    }
    
    // タグを保存する関数
    function saveTags() {
        localStorage.setItem(TAGS_KEY, JSON.stringify(allTags));
    }
    
    // タグを読み込む関数
    function loadTags() {
        const savedTags = localStorage.getItem(TAGS_KEY);
        if (savedTags) {
            allTags = JSON.parse(savedTags);
            updateTagFilters();
        }
    }
    
    // 読書記録に追加する関数
    function addBookToRecords() {
        const title = bookTitle.textContent;
        const author = bookAuthor.textContent.replace('著者: ', '').replace(/<[^>]*>/g, '');
        const publisher = bookPublisher.textContent.replace('出版社: ', '').replace(/<[^>]*>/g, '');
        const publishedDate = bookPublishedDate.textContent.replace('出版日: ', '');
        const isbn = bookIsbn.textContent.replace('ISBN: ', '');
        const coverSrc = bookCoverImg.src;
        const status = readingStatusSelect.value;
        const notes = readingNotes.value;
        const rating = currentRating;
        const tags = [...currentTags];
        const addedDate = new Date().toISOString();
        
        // 読了日を取得
        let completionDate = null;
        if (status === 'finished' && completionDateInput.value) {
            completionDate = completionDateInput.value;
        }

        // 既存の読書記録を取得
        let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        
        if (currentRecordId) {
            // 既存の記録を更新
            const index = records.findIndex(record => record.id === currentRecordId);
            
            if (index !== -1) {
                records[index].status = status;
                records[index].notes = notes;
                records[index].rating = rating;
                records[index].tags = tags;
                records[index].lastUpdated = addedDate;
                records[index].completionDate = completionDate;
                
                // ローカルストレージに保存
                localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
                
                // 読書記録を再表示
                loadReadingRecords();
                
                // 書籍情報コンテナを非表示
                bookContainer.style.display = 'none';
                
                // 編集モードをリセット
                resetEditMode();
                
                showNotification('読書記録を更新しました', 'success');
            }
        } else {
            // 既存のISBNがあるか確認
            const existingIndex = records.findIndex(record => record.isbn === isbn);
            
            if (existingIndex !== -1) {
                // 確認なしで更新
                records[existingIndex].status = status;
                records[existingIndex].notes = notes;
                records[existingIndex].rating = rating;
                records[existingIndex].tags = tags;
                records[existingIndex].lastUpdated = addedDate;
                records[existingIndex].completionDate = completionDate;
            } else {
                // 読書記録オブジェクトを作成
                const record = {
                    id: Date.now().toString(),
                    title,
                    author,
                    publisher,
                    publishedDate,
                    isbn,
                    coverSrc,
                    status,
                    notes,
                    rating,
                    tags,
                    addedDate,
                    lastUpdated: addedDate,
                    completionDate
                };
                
                // 新しい記録を追加
                records.push(record);
            }
            
            // ローカルストレージに保存
            localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
            
            // 読書記録を再表示
            loadReadingRecords();
            
            // 書籍情報コンテナを非表示
            bookContainer.style.display = 'none';
            
            // 入力欄をクリア
            isbnInput.value = '';
            
            showNotification('読書記録に追加しました', 'success');
        }
    }

    // 保存された読書記録を読み込んで表示する関数
    function loadReadingRecords() {
        const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        
        // リストをクリア
        bookListContainer.innerHTML = '';
        
        if (records.length === 0) {
            // 空の状態表示
            displayEmptyState();
            return;
        }
        
        // フィルターと並び替えを適用
        applyFiltersAndSort();
    }
    
    // 空の状態表示
    function displayEmptyState() {
        const emptyState = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-book"></i>
                </div>
                <h2 class="empty-state-text">読書記録はまだありません</h2>
                <p class="empty-state-subtext">ISBNコードを入力するか、バーコードをスキャンして書籍を追加しましょう</p>
                <a href="#" class="start-button" id="start-scan-button">
                    <i class="fas fa-barcode"></i> バーコードをスキャン
                </a>
            </div>
        `;
        
        bookListContainer.innerHTML = emptyState;
        
        // スキャンボタンのイベント
        const startScanButton = document.getElementById('start-scan-button');
        if (startScanButton) {
            startScanButton.addEventListener('click', function(e) {
                e.preventDefault();
                scanOption.click();
            });
        }
    }
    
    // フィルターと並び替えを適用する関数
    function applyFiltersAndSort() {
        let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        
        // ステータスでフィルタリング
        const statusFilter = filterStatus.value;
        if (statusFilter !== 'all') {
            records = records.filter(record => record.status === statusFilter);
        }
        
        // 評価でフィルタリング
        const ratingFilter = parseInt(filterRating.value);
        if (ratingFilter > 0) {
            records = records.filter(record => (record.rating || 0) >= ratingFilter);
        } else if (ratingFilter === 0) {
            records = records.filter(record => !record.rating || record.rating === 0);
        }
        
        // タグでフィルタリング
        if (activeTagFilters.length > 0) {
            records = records.filter(record => {
                if (!record.tags || !Array.isArray(record.tags)) return false;
                return activeTagFilters.every(tag => record.tags.includes(tag));
            });
        }
        
        // 並び替え
        const sortOption = sortBy.value;
        records.sort((a, b) => {
            switch (sortOption) {
                case 'lastUpdated':
                    const dateA = a.lastUpdated || a.addedDate;
                    const dateB = b.lastUpdated || b.addedDate;
                    return new Date(dateB) - new Date(dateA);
                case 'lastUpdated-asc':
                    const dateC = a.lastUpdated || a.addedDate;
                    const dateD = b.lastUpdated || b.addedDate;
                    return new Date(dateC) - new Date(dateD);
                case 'completionDate':
                    // 読了日がない場合は最も古い日付として扱う
                    const compDateA = a.completionDate || '0000-01-01';
                    const compDateB = b.completionDate || '0000-01-01';
                    return new Date(compDateB) - new Date(compDateA);
                case 'completionDate-asc':
                    // 読了日がない場合は最も新しい日付として扱う
                    const compDateC = a.completionDate || '9999-12-31';
                    const compDateD = b.completionDate || '9999-12-31';
                    return new Date(compDateC) - new Date(compDateD);
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'title-desc':
                    return b.title.localeCompare(a.title);
                case 'author':
                    return a.author.localeCompare(b.author);
                case 'author-desc':
                    return b.author.localeCompare(a.author);
                case 'publisher':
                    return a.publisher.localeCompare(b.publisher);
                case 'publisher-desc':
                    return b.publisher.localeCompare(a.publisher);
                case 'rating':
                    return (b.rating || 0) - (a.rating || 0);
                case 'rating-asc':
                    return (a.rating || 0) - (b.rating || 0);
                default:
                    return 0;
            }
        });
        
        // リストをクリア
        bookListContainer.innerHTML = '';
        
        if (records.length === 0) {
            bookListContainer.innerHTML = '<p>条件に一致する読書記録はありません</p>';
            return;
        }
        
        // 表示モードに応じて表示
        const settings = getSettings();
        const viewMode = settings.viewMode || 'list';
        
        if (viewMode === 'grid') {
            displayGridView(records);
        } else if (viewMode === 'series') {
            displaySeriesView(records);
        } else {
            // デフォルトはリスト表示
            displayListView(records);
        }
    }
    
    // リスト表示
    function displayListView(records) {
        records.forEach(record => {
            displayRecordItem(record);
        });
    }
    
    // グリッド表示
    function displayGridView(records) {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'grid-view';
        
        records.forEach(record => {
            const gridItem = createGridItem(record);
            gridContainer.appendChild(gridItem);
        });
        
        bookListContainer.appendChild(gridContainer);
    }
    
    // グリッドアイテムを作成
    function createGridItem(record) {
        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item';
        
        const statusText = getStatusText(record.status);
        const statusClass = getStatusClass(record.status);
        
        // タイトルから巻数を抽出
        const { title, volumeNumber } = extractVolumeNumber(record.title);
        const displayTitle = volumeNumber ? 
            `${title} (${volumeNumber})` : 
            title;
        
        gridItem.innerHTML = `
            <div class="grid-item-cover">
                <img src="${record.coverSrc}" alt="${record.title}の書影" onerror="this.src='icons/placeholder.svg'">
            </div>
            <div class="grid-item-info">
                <h3>${displayTitle}</h3>
                <p>${record.author}</p>
                <p class="book-list-status ${statusClass}">${statusText}</p>
                ${record.rating ? createRatingStars(record.rating) : ''}
            </div>
        `;
        
        // クリックイベントで詳細表示
        gridItem.addEventListener('click', () => {
            showRecordDetails(record);
        });
        
        return gridItem;
    }
    
    // シリーズ表示
    function displaySeriesView(records) {
        // シリーズごとにグループ化
        const seriesGroups = groupBySeriesTitle(records);
        
        // 単独の本も表示
        const singleBooks = records.filter(record => {
            // 巻数のない本、またはシリーズグループに含まれない本
            const { volumeNumber } = extractVolumeNumber(record.title);
            const { title } = extractVolumeNumber(record.title);
            return !volumeNumber || !seriesGroups[title];
        });
        
        // 各シリーズを表示
        Object.entries(seriesGroups).forEach(([seriesTitle, books]) => {
            const seriesGroup = document.createElement('div');
            seriesGroup.className = 'series-group';
            
            // シリーズのステータスを判定
            const isComplete = books.every(book => book.status === 'finished');
            const statusClass = isComplete ? 'complete' : 'incomplete';
            const statusText = isComplete ? '完読' : '未完';
            
            seriesGroup.innerHTML = `
                <div class="series-header">
                    <h3 class="series-title">${seriesTitle}</h3>
                    <span class="series-status ${statusClass}">${statusText}</span>
                </div>
                <div class="series-books"></div>
            `;
            
            const seriesBooks = seriesGroup.querySelector('.series-books');
            
            // 巻数でソート
            books.sort((a, b) => {
                const volA = extractVolumeNumber(a.title).volumeNumber || '0';
                const volB = extractVolumeNumber(b.title).volumeNumber || '0';
                return parseInt(volA) - parseInt(volB);
            });
            
            // 各巻を表示
            books.forEach(book => {マンガアート社';
            } else if (prefix >= '4000' && prefix <= '6999') {
                category = '実用書・ビジネス';
                publisher = 'ビジネス出版';
            } else if (prefix >= '7000' && prefix <= '8499') {
                category = '科学・技術書';
                publisher = 'テクノブックス';
            } else {
                category = '一般書籍';
                publisher = '総合出版';
            }
        } else {
            // ISBN-10の場合
            const prefix = isbn.substring(0, 2);
            if (prefix >= '00' && prefix <= '19') {
                category = '文学・小説';
                publisher = '文学社';
            } else if (prefix >= '20' && prefix <= '39') {
                category = 'コミック・漫画';
                publisher = '