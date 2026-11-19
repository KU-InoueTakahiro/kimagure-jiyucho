# きまぐれ自由帳

ゲーム、イラスト、楽曲などの作品を掲載する、1ページ完結型の個人ポートフォリオサイトです。

「道具箱」から、制作向けの独立したツールページも利用できます。

## 公開URL・デプロイ

公式サイト: **https://kimagure-jiyucho.com/**

- ビルド不要の静的HTML / CSS / JavaScriptです。GitHub Pagesで `main` ブランチの `/` を公開しています。GitHub Actionsの独自ワークフローは不要です。
- ルートの `CNAME`（`kimagure-jiyucho.com`）は既存のCustom domain設定を維持するため、そのまま公開してください。DNS・PagesのCustom domain・Enforce HTTPSの変更は不要です。
- CSS・JavaScript・画像・ツールの相対パスは、そのまま新ドメインで利用できます。旧プロジェクト名をパスに追加しないでください。
- 公開ページはトップ、`tools/audio-converter/`、`tools/walk-editor/` の3ページです。各HTMLのcanonical・OGPと、`sitemap.xml`・`robots.txt`を新ドメインに統一しています。`index.html`付きのURLでも表示でき、canonicalはディレクトリURLを指します。
- OGP画像は既存の `images/hero-colored-pencil.png` を再利用しています。faviconとApple Touch Iconは同じイラストのゲームコントローラー部分を切り出したもので、新しい絵柄は追加していません。
- 作品の外部リンクは従来どおりです。ドリンクラボのサブドメインへの切替は、CSS・JavaScript・画像・操作まで正常に動くことを確認してから別途行ってください。
- 公開後に `/` と両ツール、`sitemap.xml`・`robots.txt`、画像・アイコンの読み込みを確認してください。ブラウザやSNSのキャッシュには反映まで時間がかかる場合があります。
- 検索エンジンへの反映を促す場合は、新ドメインのSearch Consoleでサイトマップを送信してください。

既存ツールのテスト:

```sh
node --test tools/audio-converter/tests/*.test.mjs tools/walk-editor/tests/*.test.mjs
```

## ツクール音声変換帳

`tools/audio-converter/` に音声の一括変換ツールを追加しました。
`http://localhost:8000/tools/audio-converter/` で確認できます。

- 音声を端末内でOgg Vorbis / AAC-LC（m4a）へ一括変換。
- 形式判定、任意の音量調整・無音短縮、試聴、個別保存。
- 複数音源はZIPで保存。フォルダは入れず、2形式をZIP直下に並べます。
- ビルド不要。GitHub Pagesには同梱の`vendor/`を含めて公開してください。

使い方と構成は[ツールのREADME](tools/audio-converter/README.md)にまとめています。

## ローカルで確認する

歩行グラを端末内で編集する「[ツクール歩行グラ編集帳](tools/walk-editor/README.md)」も道具箱から利用できます。`tools/walk-editor/` を含めて公開してください。個人用の `tools/sprite-tool/` や素材・履歴は公開版に含みません。

`index.html` をブラウザで直接開くか、このフォルダで簡易Webサーバーを起動します。

```sh
python3 -m http.server 8000
```

その後、ブラウザで `http://localhost:8000` を開いてください。

## 作品を追加する

`script.js` の `works` 配列へ作品データを追加します。画像は `images/` に保存し、`image: "images/example.jpg"` のように相対パスで指定してください。画像を指定しない場合はカテゴリ別のプレースホルダーが表示されます。

## 外部リンクを変更する

`script.js` 冒頭の `socialLinks` 配列で、X・YouTube・ふりーむのURLを変更できます。各作品のリンクは `works` 配列内の `links` で設定します。
