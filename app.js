// 楽天ブックスAPIから書籍情報を取得する関数
function fetchFromRakutenBooks(isbn) {
    // 楽天ブックスAPI URL (アプリケーションIDを含む)
    const applicationId = '1091748348626763213'; // 楽天APIアプリケーションID
    const apiUrl = `https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404?format=json&isbn=${isbn}&applicationId=${applicationId}`;
    
    return fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('楽天APIからのレスポンスエラー: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            // 書籍が見つからない場合
            if (!data.Items || data.Items.length === 0) {
                throw new Error('楽天APIで書籍が見つかりませんでした');
            }
            
            // 書籍情報を取得
            const bookItem = data.Items[0].Item;
            
            // 書籍データを整形（価格情報と楽天リンクは含めない）
            const bookData = {
                title: bookItem.title,
                author: bookItem.author,
                publisher: bookItem.publisherName,
                publishedDate: formatRakutenDate(bookItem.salesDate),
                isbn: isbn,
                coverSrc: bookItem.largeImageUrl || bookItem.mediumImageUrl || bookItem.smallImageUrl,
                description: bookItem.itemCaption || '',
                status: 'unread',
                addedDate: new Date().toISOString()
                // 価格情報と楽天URLは含めない
            };
            
            return bookData;
        });
}

// 楽天の日付フォーマット（yyyy年mm月、yyyy年mm月dd日など）を整形する関数
function formatRakutenDate(dateStr) {
    if (!dateStr) return '不明';
    return dateStr;  // 楽天の日付はすでに日本語形式
}

// APIフォールバックフローに楽天ブックスAPIを追加するよう書籍検索関数を修正
function fetchBookInfo(isbn) {
    // ローディング表示
    loadingElement.style.display = 'block';
    
    // まず楽天ブックスAPIから検索（日本の書籍に特化しているため最初に試す）
    fetchFromRakutenBooks(isbn)
        .then(bookData => {
            // ローディング非表示
            loadingElement.style.display = 'none';
            
            // 評価をリセット
            setRating(0);
            
            // タグをリセット
            currentTags = [];
            updateTagsDisplay();
            
            // UI更新
            displayBookInfo(bookData);
        })
        .catch(error => {
            console.error('楽天ブックスAPI Error:', error);
            
            // Google Books APIにフォールバック
            fetchFromGoogleBooks(isbn);
        });
}

// Google Books APIから書籍情報を取得する関数
function fetchFromGoogleBooks(isbn) {
    // Google Books API URL
    const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&langRestrict=ja`;
    
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('ネットワークエラーが発生しました');
            }
            return response.json();
        })
        .then(data => {
            // 書籍データが見つからない場合
            if (data.totalItems === 0) {
                // OpenBD API にフォールバック
                fetchFromOpenBD(isbn);
                return;
            }
            
            // 書籍情報を抽出
            const bookInfo = data.items[0].volumeInfo;
            
            // 書籍データを整形
            const bookData = {
                title: bookInfo.title || `不明なタイトル (ISBN: ${isbn})`,
                author: bookInfo.authors ? bookInfo.authors.join(', ') : '不明な著者',
                publisher: bookInfo.publisher || '不明な出版社',
                publishedDate: bookInfo.publishedDate ? formatGoogleBooksDate(bookInfo.publishedDate) : '不明',
                isbn: isbn,
                coverSrc: bookInfo.imageLinks ? bookInfo.imageLinks.thumbnail : null,
                description: bookInfo.description || '',
                status: 'unread',
                addedDate: new Date().toISOString()
            };
            
            // ローディング非表示
            loadingElement.style.display = 'none';
            
            // UI更新
            displayBookInfo(bookData);
        })
        .catch(error => {
            console.error('Google Books API Error:', error);
            
            // OpenBD API にフォールバック
            fetchFromOpenBD(isbn);
        });
}

// フォールバックチェーンを表示するユーティリティ関数
function showAPIProgress(message) {
    const progressElement = document.getElementById('api-progress');
    if (progressElement) {
        progressElement.textContent = message;
        progressElement.style.display = 'block';
        
        // 3秒後に非表示
        setTimeout(() => {
            progressElement.style.display = 'none';
        }, 3000);
    } else {
        console.log('API進捗:', message);
    }
}

// 検索ボタンのクリックイベント関数を修正
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
    
    // 書籍情報を取得（まず楽天ブックスAPIから開始）
    fetchBookInfo(isbn);
}

// 書籍情報表示関数を拡張（価格と楽天リンクを非表示に）
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
    
    // 価格情報と楽天リンクは非表示のままにする
    const priceElement = document.getElementById('book-price');
    if (priceElement) {
        priceElement.style.display = 'none';
    }
    
    const rakutenLinkElement = document.getElementById('rakuten-link');
    if (rakutenLinkElement) {
        rakutenLinkElement.style.display = 'none';
    }
    
    // 書影がある場合は表示、なければプレースホルダー
    if (bookInfo.coverSrc) {
        bookCoverImg.src = bookInfo.coverSrc;
    } else {
        bookCoverImg.src = './icons/placeholder.svg';
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
    
    // データソースを表示（どのAPIから取得したか）
    const apiSourceElement = document.getElementById('api-source');
    if (apiSourceElement) {
        let source = '未知のソース';
        if (bookInfo.coverSrc && bookInfo.coverSrc.includes('imageASIN.images-amazon.com')) {
            source = '楽天ブックス';
        } else if (bookInfo.coverSrc && bookInfo.coverSrc.includes('books.google.com')) {
            source = 'Google Books';
        } else if (bookInfo.coverSrc && bookInfo.coverSrc.includes('openbd.jp')) {
            source = 'OpenBD';
        } else if (bookInfo.coverSrc && bookInfo.coverSrc.includes('ndl.go.jp')) {
            source = '国立国会図書館';
        } else if (bookInfo.coverSrc && bookInfo.coverSrc.includes('placeholder.com')) {
            source = 'モックデータ';
        }
        apiSourceElement.textContent = `データソース: ${source}`;
        apiSourceElement.style.display = 'block';
    }
}
