function clearScanTimeout() {
    if (scanTimeoutId) {
        clearTimeout(scanTimeoutId);
        scanTimeoutId = null;
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

    // オフライン時はローカルデータを検索
    if (!navigator.onLine) {
        const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const existingRecord = records.find(record => record.isbn === isbn);
        
        if (existingRecord) {
            displayBookInfo(existingRecord);
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
            }
        });
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
        bookCoverImg.src = '/icons/placeholder.svg';
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

// タグフィルターを更新する関数
function updateTagFilters() {
    filterTags.innerHTML = '';
    
    if (allTags.length === 0) {
        return;
    }
    
    // すべてのタグをフィルターとして追加
    allTags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.className = 'filter-tag';
        if (activeTagFilters.includes(tag)) {
            tagElement.classList.add('active');
        }
        tagElement.textContent = tag;
        
        // クリックイベント
        tagElement.addEventListener('click', () => {
            if (activeTagFilters.includes(tag)) {
                // フィルターを解除
                activeTagFilters = activeTagFilters.filter(t => t !== tag);
                tagElement.classList.remove('active');
            } else {
                // フィルターを追加
                activeTagFilters.push(tag);
                tagElement.classList.add('active');
            }
            applyFiltersAndSort();
        });
        
        filterTags.appendChild(tagElement);
    });
}

// 読書記録に追加する関数
function addBookToRecords() {
    const title = bookTitle.textContent;
    const author = bookAuthor.textContent.replace('著者: ', '');
    const publisher = bookPublisher.textContent.replace('出版社: ', '');
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
        bookListContainer.innerHTML = '<p>読書記録はまだありません</p>';
        return;
    }
    
    // フィルターと並び替えを適用
    applyFiltersAndSort();
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
            <img src="${record.coverSrc}" alt="${record.title}の書影" onerror="this.src='/icons/placeholder.svg'">
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
        books.forEach(book => {
            const bookItem = document.createElement('div');
            bookItem.className = 'series-book-item';
            
            const { volumeNumber } = extractVolumeNumber(book.title);
            const displayVolume = volumeNumber || '?';
            
            const statusClass = getStatusClass(book.status);
            
            bookItem.innerHTML = `
                <div class="series-book-cover">
                    <img src="${book.coverSrc}" alt="${book.title}の書影" onerror="this.src='/icons/placeholder.svg'">
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
        <img class="book-list-cover" src="${record.coverSrc}" alt="${record.title}の書影" onerror="this.src='/icons/placeholder.svg'">
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
        document.body.removeAttribute('data-theme');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        saveSettings('theme', 'light');
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
        }
        
        // 表示モードを適用
        if (settings.viewMode) {
            setViewMode(settings.viewMode);
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
        // iOSのダブルタップによるズームを防止
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    }, { passive: false });
}
});document.addEventListener('DOMContentLoaded', function() {
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

// 初期表示時にオンライン状態を確認
updateOnlineStatus();

// オンライン状態を更新する関数
function updateOnlineStatus() {
    if (navigator.onLine) {
        offlineMessage.style.display = 'none';
    } else {
        offlineMessage.style.display = 'block';
    }
}

// 初期表示時に読書記録を読み込む
loadReadingRecords();

// 保存されたタグを読み込む
loadTags();

// バーコードスキャナー関連の変数
let codeReader = null;
let selectedDeviceId = null;
let availableDevices = [];

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