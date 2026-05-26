# JIRA MCP サーバー

JIRA と連携する [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) サーバーです。
Claude などの AI アシスタントから JIRA を直接操作できるようになります。

## 概要

このサーバーを使うと、Claude に自然言語で話しかけるだけで JIRA の Issue 検索・作成・更新などができます。

```
「PROJECT の未完了 Issue を一覧して」
「PROJ-123 のステータスを In Progress に変えて」
「バグ報告の Issue を作って」
```

## 必要なもの

- Node.js 18 以上
- JIRA アカウント（Atlassian Cloud）
- JIRA API トークン

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/bakery48/jira-mcp.git
cd jira-mcp
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.example` をコピーして `.env` を作成します。

```bash
cp .env.example .env
```

`.env` を編集して認証情報を入力します。

```env
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
```

**API トークンの取得方法:**
1. [Atlassian アカウント設定](https://id.atlassian.com/manage-profile/security/api-tokens) を開く
2. 「APIトークンを作成する」をクリック
3. 生成されたトークンを `JIRA_API_TOKEN` に設定

### 4. ビルド

```bash
npm run build
```

### 5. Claude へのMCP設定

`~/.claude/claude_desktop_config.json` に以下を追加します。

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/path/to/jira-mcp/dist/index.js"],
      "env": {
        "JIRA_BASE_URL": "https://yourcompany.atlassian.net",
        "JIRA_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-jira-api-token"
      }
    }
  }
}
```

## 使えるツール一覧

### `jira_get_issue` — Issue の詳細取得

Issue キーを指定して詳細情報を取得します。

| パラメータ | 必須 | 説明 |
|---|---|---|
| `issue_key` | はい | Issue キー（例: `PROJ-123`） |

### `jira_search_issues` — JQL で Issue を検索

JQL（JIRA Query Language）を使って Issue を検索します。

| パラメータ | 必須 | 説明 |
|---|---|---|
| `jql` | はい | JQL クエリ（例: `project = PROJ AND status = "To Do"`） |
| `max_results` | いいえ | 最大取得件数（デフォルト: 20） |

### `jira_create_issue` — Issue の作成

新しい Issue を作成します。

| パラメータ | 必須 | 説明 |
|---|---|---|
| `project_key` | はい | プロジェクトキー（例: `PROJ`） |
| `summary` | はい | タイトル |
| `description` | いいえ | 説明文 |
| `issue_type` | いいえ | Issue タイプ（デフォルト: `Task`） |
| `priority` | いいえ | 優先度（例: `High`, `Medium`, `Low`） |
| `assignee` | いいえ | 担当者のアカウントID |

### `jira_update_issue` — Issue の更新

既存の Issue を更新します。

| パラメータ | 必須 | 説明 |
|---|---|---|
| `issue_key` | はい | Issue キー |
| `summary` | いいえ | 新しいタイトル |
| `description` | いいえ | 新しい説明文 |
| `priority` | いいえ | 新しい優先度 |
| `assignee` | いいえ | 新しい担当者のアカウントID |

### `jira_add_comment` — コメントの追加

Issue にコメントを追加します。

| パラメータ | 必須 | 説明 |
|---|---|---|
| `issue_key` | はい | Issue キー |
| `comment` | はい | コメント本文 |

### `jira_transition_issue` — ステータスの変更

Issue のステータスを変更します（例: `To Do` → `In Progress`）。

| パラメータ | 必須 | 説明 |
|---|---|---|
| `issue_key` | はい | Issue キー |
| `transition_name` | はい | 遷移先のステータス名（例: `In Progress`, `Done`） |

### `jira_get_projects` — プロジェクト一覧の取得

アクセス可能なプロジェクトの一覧を取得します。パラメータは不要です。

## 開発用コマンド

```bash
# 開発モード（ビルド不要で直接実行）
npm run dev

# ビルド
npm run build

# 本番実行
npm start
```

## 技術スタック

- **TypeScript** — 型安全な実装
- **@modelcontextprotocol/sdk** — MCP サーバーフレームワーク
- **axios** — JIRA REST API v3 との通信
- **dotenv** — 環境変数の管理
