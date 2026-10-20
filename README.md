# Cycle Navi PWA

ロードバイク向けGPXコース追従ナビの初期版。フレームワーク・APIキー・ビルド処理は不要です。

## GitHub Pagesへの公開

1. GitHubで新しいリポジトリ（例：`cycle-navi`、無料プランの場合はPublic）を作成します。
2. このフォルダの中身を `main` ブランチへ登録します。`.github/workflows/pages.yml` も含めてください。
3. リポジトリの **Settings → Pages → Build and deployment → Source → GitHub Actions** を選択します。
4. **Actions → Test and deploy Cycle Navi → Run workflow** を実行します。以後はmainへのpushで更新されます。
5. デプロイ後、Settings → Pagesに表示されるHTTPSのURLをスマホで開きます。

```bash
git init -b main
git add .
git commit -m "Create Cycle Navi PWA"
git remote add origin https://github.com/YOUR_ACCOUNT/cycle-navi.git
git push -u origin main
```

公開するのはアプリのソースのみです。個人のGPXや走行記録をリポジトリへ登録しないでください。

## スマホで使う

- iPhone：Safariで開き、共有 → ホーム画面に追加。
- Android：Chrome等で開き、メニュー → アプリをインストール／ホーム画面に追加。
- GPXを読み込み、停止した状態で「ナビ開始」を押し、位置情報を許可します。
- 画面を表示したまま使用します。画面点灯維持機能はブラウザ・省電力設定等で利用できない場合があります。
- 記録は「記録を書き出す」でGPXとして保存できます。

## 実装済み

- 日本語・スマホ対応UI、PWAマニフェスト、ホーム画面アイコン。
- GPXのtrkpt/rtept取込、XML・座標・容量・点数のチェック。複数trksegは誤結合を避けるため拒否。
- 北上固定の地図、ドラッグ、拡大縮小、コース全体表示、現在地追従。
- 線分への投影によるコース進捗、交差・往復重複での連続性の考慮。
- GPS精度を考慮した逸脱通知。形状から推定した曲がりの画面・音声通知。
- 速度・残距離・走行距離、休憩・再開・終了。
- IndexedDBによる端末内保存と中断後の復元、GPX出力、データ削除。
- アプリ本体とコース・記録のオフライン利用（背景地図は対象外）。
- Node標準テスト、GitHub ActionsからPagesへの自動デプロイ。

## 制約・未実装

- **バックグラウンドや画面消灯中のGPS・音声・記録の継続は保証できません。** インストール済みPWAでも同様です。復帰後にGPSが再開したことを確認してください。
- 道路経路の探索、目的地検索、自動リルート、交通規制・路面判定、登坂案内、センサー連携は未実装です。
- 曲がり通知は道路の交差点情報ではなくGPXの形状からの推定です。緩いカーブや複雑な交差点で誤通知・見逃しがあり得ます。
- 進捗判定は初期アルゴリズムです。長い寄り道・コース逆走・重複区間での途中参加は実走で検証が必要です。
- 15秒以上のGPS記録間隔、低精度、異常な位置移動は距離に加算せず、推測による補間をしません。
- サンプルは架空コースです。走行可能性を検証していません。
- ブラウザの保存領域はOS等に消去される場合があります。記録を定期的に書き出してください。
- Service Workerを更新する場合は `app/sw.js` のCACHE名を変更してください。新しい版は既存のアプリ画面をすべて閉じて再度開くと適用されます。

## 地図とプライバシー

OpenStreetMap標準タイルを、表示中の範囲のみ読み込みます。HTTPキャッシュはブラウザに任せ、Service Workerではタイルを扱いません。タイルの先読み・一括ダウンロード・オフライン保存は実装していません。

地図取得時は表示範囲・IPアドレス・Referer等が配信元に送られます。GPXと走行記録をアップロードする機能、アクセス解析はありません。

利用増加時や完全オフライン地図に対応する場合は、許可された地図配信サービスへ切り替えてください。現在のタイルURLは `app/app.js` のdraw内にあります。

## ローカル検証

Node.js 22以降・Python 3を使用します。依存パッケージのインストールは不要です。

```bash
npm test
npm run serve
```

PCでは `http://localhost:8080` を開けます。スマホからLAN内HTTPで開くと位置情報やPWAが使えない場合があるため、スマホ検証にはHTTPSの公開URLを使用してください。

## 実機チェックリスト（公開後）

- iPhone Safari / Android Chromeでインストール、GPS許可・拒否時の表示。
- 実際のGPXを取り込み、コースと進行方向を確認。
- 正常な走行、停止、逸脱8秒後の通知、コース復帰、往復重複区間。
- 休憩・再開、アプリを閉じた後の復帰、GPX書き出しと再読込。
- 初回オンライン起動・再起動後に機内モードにし、本体とコースを表示。
- 画面ロック・他アプリ切替・GPS停止時の挙動を確認。
- 3時間の消費電力・発熱・屋外視認性・音声を測定。

## 参考資料

- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
- https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- https://operations.osmfoundation.org/policies/tiles/

初期版は実走未検証です。車道で使う前に、徒歩・安全な場所で基本動作を確認してください。
