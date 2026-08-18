# NAF-CSM

会計法規の正しい条文を閲覧し、4択問題と正誤問題で学習するサーバー配信用Webアプリです。

## 主な機能

- `original` の正しい条文だけを閲覧
- 異なる4条文から正しい条文を1つ選択
- 異なる4条文から誤った条文を1つ選択
- 1つの条文が正しいか誤っているかを判断
- 回答後に正しい条文と `explanation` を表示
- 大分類、関連法規グループ、重要度、難易度による絞り込み
- 連番、開始ID、絞り込み結果の開始位置、ランダム、不得意問題から出題
- 1～200問の範囲で出題数を指定
- Cookieによる正解数、不正解数、分類別成績、不得意問題の保存
- 学習結果の印刷・PDF保存
- 閲覧モードで抽出した正しい条文一覧のA4縦PDF保存
- 長い条文を読みやすくする文字サイズ切替と集中表示
- ローカルCSVの形式検査、レコード単位の編集・追加・削除・保存
- ローカルCSVを使った本アプリ同等の確認モード（確認履歴は別Cookie）
- PC、タブレット、スマートフォンに応じたレスポンシブ表示

## 動作環境

- Microsoft Edge 95以上
- JavaScriptとCookieが有効な環境
- UTF-8の静的ファイルを配信できるWebサーバー

外部ライブラリやビルド処理には依存していません。

### Microsoft EdgeのIEモード / IE11互換表示

通常のChromium版Edgeに加え、Microsoft EdgeのIEモードで動作させるための互換レイヤーとして `css/ie11.css` と `js/ie11.js` を読み込みます。

IEモードでは、次の機能を主な対応対象としています。

- ホーム画面と各画面の表示
- 学習条件の設定
- 正誤問題・4択問題
- 正しい条文の閲覧
- Cookieによる学習履歴と設定保存
- 分析表示
- ブラウザーの印刷機能を使った印刷・PDF保存

IE11で未対応のCSS Grid、CSS変数、`gap`、`min()` / `max()` / `clamp()`、`inset` などには専用CSSのフォールバックを用意しています。JavaScriptではIE11で扱えない `scrollIntoView()` のオプション指定などを互換処理しています。

ただし、**CSVの直接編集はIEモード / IE11では利用できません。** CSVを選択して元ファイルへ直接書き戻す機能はFile System Access APIを使用するため、Windows版Edge 95以上の通常モードで、`localhost`またはHTTPSから開いた場合に使用してください。IEモードではCSV直接編集ボタンを無効化します。

IEモードの表示や通信は、組織のセキュリティゾーン、Cookieポリシー、認証、Webサーバーの`.csv` MIME設定などの影響を受けます。そのため、互換コードと自動テストだけで完全な動作を保証するものではなく、実際に使用する庁内・社内環境のIEモードで最終確認してください。

## インターネット未接続環境

このアプリは、インターネットに接続されていない庁内・社内Webサーバーで動作する構成です。

- CDN、外部API、外部Webフォントを使用しません
- 実行時に外部サイトへ通信しません
- JavaScript、CSS、CSVはすべてリポジトリ内にあります
- npmなどによるサーバー上でのインストールやビルドは不要です
- Cookieはアプリを配信するサーバーのドメインへ保存されます
- PDFはEdge 95の印刷機能を使用するため、PDF生成サービスへの通信はありません
- CSV編集ページで選択したファイルは端末内だけで処理し、サーバーへ送信しません

インターネット接続された端末で事前に依存ファイルを取得する作業もありません。リポジトリのファイル一式を、USBメモリなど許可された方法でWebサーバーへ搬入できます。

## 配置方法

リポジトリ全体をWebサーバーの公開ディレクトリへ配置し、`index.html` を開きます。`file://` から直接開く方式ではCSVを取得できないため、必ずHTTPまたはHTTPSで配信してください。

```text
index.html
server.js
css/
js/
db/R8db.csv
```

サーバーでは以下を確認してください。

- `index.html`、`css/`、`js/`、`db/`を同じ階層関係のまま配置する
- `.csv`を静的ファイルとして配信できるようにする
- CSVの文字コードを変更せず、UTF-8のまま配信する
- Edge端末からサーバー名またはIPアドレスへ接続できるようにする
- Cookieを禁止するブラウザーポリシーが設定されていないことを確認する

## VS Codeから確認する

開発用PCにNode.jsとMicrosoft Edgeがインストールされている場合は、次の手順で起動できます。外部通信や追加インストールは発生しません。

1. VS Codeでこのフォルダーを開く
2. 「実行とデバッグ」を開く
3. 「NAF-CSMを起動（接続エラー回避）」を選択する
4. F5キーを押す

VS Codeが `server.js` を使って `http://127.0.0.1:8000/` を配信し、Edgeを通常モードで起動します。8000番ポートが使用中の場合は、8001番以降の空いているポートを自動的に使用します。VS Codeからブラウザーへデバッグ接続しないため、「ブラウザーにアタッチできません」というエラーを回避できます。停止するときはVS Codeのデバッグ停止ボタンを押してください。

ローカルで確認する場合の例：

```powershell
node server.js
```

その後、`http://localhost:8000/` をEdgeで開きます。

## Cookieへの保存内容

次のCookieを最長365日保存します。

- `sti_summary`: 累計および分類別の正解・不正解数
- `sti_weak`: 不得意問題のIDと成績
- `sti_settings`: 前回の出題条件
- `sti_display`: 条文の文字サイズ
- `sti_preview_summary`、`sti_preview_weak`、`sti_preview_settings`: ローカルDB確認モード専用の履歴

Cookie容量を超えないよう、不得意問題は弱点度の高いものから最大160件まで保持します。全2,436問の回答履歴明細を保存する仕様ではありません。

## PDF保存

学習結果画面で「PDF用に印刷」を選び、Edgeの印刷画面からプリンターとして「PDFとして保存」を選択します。

「正しい条文を読む」では、抽出後に「抽出条文をPDF作成」を選ぶと、対象条文を一覧で印刷できます。用紙はA4縦、左余白は25mmです。

## データ

`db/R8db.csv` は以下の列を持ちます。

```text
id,Importance,difficult,category1,category2,original,question,explanation,notes1,notes2,notes3,notes4,notes5
```

アプリ内では `category1` を大分類、`category2` を関連法規グループ、`Importance` を重要度、`difficult` を難易度として扱います。`notes1`～`notes5` は内部情報として読み込み、画面には表示しません。旧形式の `category` 列にも対応しています。法令は改正されることがあるため、実務利用時には最新の法令と照合してください。

CSV編集ページでは上記13列が同じ順序で並ぶUTF-8のCSVだけを読み込みます。保存時は`notes1`へ端末の日付、`notes2`へ必須入力したニックネームを設定し、選択したCSVそのものを更新します。CSVはサーバーへ送信せず、別名ファイルのダウンロードも行いません。直接編集にはWindows版Edge 95以上と、`localhost`またはHTTPSの安全な接続が必要です。組織のEdgeポリシーでファイル書き込みが禁止されている場合は利用できません。

## 確認

Node.jsが利用できる開発環境では、CSVの構造を次のコマンドで確認できます。

```powershell
node tests/csv-parser.test.js
node tests/local-db.test.js
node tests/editor-ui.test.js
node tests/browse-print.test.js
node tests/history-cookie.test.js
node tests/http-smoke.test.js
node tests/offline-assets.test.js
node tests/ie11-compat.test.js
node tests/vscode-launch.test.js
node tests/server-port-fallback.test.js
```
