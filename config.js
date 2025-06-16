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
    // 承認済みJavaScriptの生成元にドメインを追加済みであることを確認
    CLIENT_ID: '752134953637-kfh5qnplpsb4etd2dui1fgq4snlgkvbp.apps.googleusercontent.com',
    
    // Google Drive APIのスコープ（アプリが作成したファイルのみアクセス）
    SCOPES: 'https://www.googleapis.com/auth/drive.file',
    
    // Discovery URL for the Drive API
    DISCOVERY_URL: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
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
Google Drive API設定手順（簡略版）:

1. Google Cloud Console (https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成または既存プロジェクトを選択
3. 「APIとサービス」→「ライブラリ」でGoogle Drive APIを有効化
4. 「APIとサービス」→「認証情報」でOAuth 2.0 クライアントIDを作成
   - アプリケーションの種類: ウェブアプリケーション
   - 承認済みのJavaScriptの生成元: あなたのドメイン（例: https://yoursite.com）
5. 取得したクライアントIDを config.js の CLIENT_ID に設定

セキュリティ設定:
- OAuth 2.0クライアントIDに承認済みドメインのみ追加
- スコープは 'drive.file' に制限（アプリが作成したファイルのみアクセス可能）

注意: APIキーは不要です。OAuth 2.0のみで十分です。
`;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GOOGLE_CONFIG, validateGoogleConfig, SETUP_INSTRUCTIONS };
}
