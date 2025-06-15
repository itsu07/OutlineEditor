/**
 * Google Drive API設定
 * 
 * このファイルはOutlineWriter MobileのGoogle Drive統合に必要な設定を含みます。
 * 以下の設定を行ってください：
 * 
 * 1. Google Cloud Consoleでプロジェクトを作成
 * 2. Google Drive APIを有効化
 * 3. OAuth 2.0 クライアントIDを作成
 * 4. 以下の値を設定
 */

const GOOGLE_CONFIG = {
    // Google Cloud ConsoleのAPIキー
    // APIキーの制限: HTTPリファラー（ウェブサイト）で使用ドメインを制限推奨
    API_KEY: 'AIzaSyDiYcJl_47IjiJFBMilxYYkXkD5c8kmj_s',
    
    // OAuth 2.0 クライアントID
    // 承認済みJavaScriptの生成元にドメインを追加必要
    CLIENT_ID: '752134953637-kfh5qnplpsb4etd2dui1fgq4snlgkvbp.apps.googleusercontent.com ',
    
    // Google Drive APIのスコープ
    SCOPES: 'https://www.googleapis.com/auth/drive.file',
    
    // Discovery URL for the Drive API
    DISCOVERY_URL: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
};

// 設定確認用関数
function validateGoogleConfig() {
    const errors = [];
    
    if (!GOOGLE_CONFIG.API_KEY || GOOGLE_CONFIG.API_KEY === 'AIzaSyDiYcJl_47IjiJFBMilxYYkXkD5c8kmj_s') {
        errors.push('API_KEYが設定されていません');
    }
    
    if (!GOOGLE_CONFIG.CLIENT_ID || GOOGLE_CONFIG.CLIENT_ID === '752134953637-kfh5qnplpsb4etd2dui1fgq4snlgkvbp.apps.googleusercontent.com ') {
        errors.push('CLIENT_IDが設定されていません');
    }
    
    if (errors.length > 0) {
        console.error('Google Drive API設定エラー:', errors);
        return false;
    }
    
    return true;
}

// 設定手順の説明
const SETUP_INSTRUCTIONS = `
Google Drive API設定手順:

1. Google Cloud Console (https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成または既存プロジェクトを選択
3. 「APIとサービス」→「ライブラリ」でGoogle Drive APIを有効化
4. 「APIとサービス」→「認証情報」でAPIキーを作成
5. 「APIとサービス」→「認証情報」でOAuth 2.0 クライアントIDを作成
   - アプリケーションの種類: ウェブアプリケーション
   - 承認済みのJavaScriptの生成元: あなたのドメイン（例: https://yoursite.com）
6. 取得したAPIキーとクライアントIDをconfig.jsに設定

セキュリティ推奨事項:
- APIキーにHTTPリファラー制限を設定
- OAuth 2.0クライアントIDに承認済みドメインのみ追加
- 本番環境では環境変数で設定値を管理
`;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GOOGLE_CONFIG, validateGoogleConfig, SETUP_INSTRUCTIONS };
}