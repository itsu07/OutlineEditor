/**
 * Google Drive API設定（OAuth 2.0のみ）
 * 
 * このファイルはOAuth 2.0クライアントIDのみを使用します。
 * APIキーは不要です。
 * 
 * セットアップ手順:
 * 1. Google Cloud Consoleでプロジェクトを作成
 * 2. Google Drive APIを有効化
 * 3. OAuth 2.0クライアントIDを作成（Webアプリケーション）
 * 4. 承認済みJavaScriptの生成元にドメインを追加
 * 5. 下記のCLIENT_IDを実際の値に置き換え
 */

const GOOGLE_CONFIG = {
    // OAuth 2.0 クライアントID
    // 開発環境用: localhost:8000とfile://プロトコルで動作可能
    CLIENT_ID: '752134953637-kfh5qnplpsb4etd2dui1fgq4snlgkvbp.apps.googleusercontent.com',
    
    // Google Drive APIのスコープ（アプリが作成したファイルのみアクセス + ユーザー情報）
    SCOPES: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
    
    // Discovery URL for the Drive API
    DISCOVERY_URL: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    
    // 開発環境用の設定
    DEV_MODE: true,
    
    // 承認済みドメインの設定例
    AUTHORIZED_DOMAINS: [
        'http://localhost:8000',
        'http://localhost:3000',
        'http://127.0.0.1:8000',
        'http://127.0.0.1:3000',
        'file://'
    ]
};

// 設定確認用関数
function validateGoogleConfig() {
    if (!GOOGLE_CONFIG.CLIENT_ID || GOOGLE_CONFIG.CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
        console.error('Google Drive API設定エラー: CLIENT_IDが設定されていません');
        return false;
    }
    
    return true;
}

// 設定手順の説明
const SETUP_INSTRUCTIONS = `
Google Drive API設定手順（開発環境用）:

⚠️ 重要: OAuth 2.0エラーの修正方法

1. Google Cloud Console (https://console.cloud.google.com/) にアクセス
2. 「APIとサービス」→「認証情報」を選択
3. 既存のOAuth 2.0 クライアントIDを編集
4. 「承認済みのJavaScriptの生成元」に以下を追加:
   - http://localhost:8000
   - http://localhost:3000
   - http://127.0.0.1:8000
   - http://127.0.0.1:3000
   - file://

5. 「承認済みのリダイレクト URI」に以下を追加:
   - http://localhost:8000
   - http://localhost:3000
   - http://127.0.0.1:8000
   - http://127.0.0.1:3000

6. 変更を保存

開発環境での起動方法:
- python3 -m http.server 8000 でローカルサーバーを起動
- http://localhost:8000 でアクセス

注意事項:
- file:// プロトコルでは一部制限あり
- 開発時はローカルサーバー推奨
- 本番デプロイ時は実際のドメインを設定
`;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GOOGLE_CONFIG, validateGoogleConfig, SETUP_INSTRUCTIONS };
}