# 使用ライブラリと出典

このツールは変換エンジンを同一サイトから読み込みます。音声ファイルを外部サービスへ送信しません。
ZIP生成はこのツールの独自実装で、ZIP用ライブラリは使用していません。

## @ffmpeg/ffmpeg 0.12.15

- Author: Jerome Wu / ffmpeg.wasm contributors
- License: MIT。本文：[LICENSE-ffmpeg-MIT.txt](LICENSE-ffmpeg-MIT.txt)
- Source: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v12.15
- Official package: https://registry.npmjs.org/@ffmpeg/ffmpeg/-/ffmpeg-0.12.15.tgz
- 同梱：`ffmpeg/ffmpeg.js`、`ffmpeg/814.ffmpeg.js`、各ソースマップ。配布物は未改変です。

## @ffmpeg/core 0.12.10 — single-thread

- Author: FFmpeg developers / ffmpeg.wasm contributors and included codec-library authors
- License: GPL-2.0-or-later。GPL v2本文：[LICENSE-core-GPLv2.txt](LICENSE-core-GPLv2.txt)
- Source and build scripts: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v12.15
- Build configuration: https://github.com/ffmpegwasm/ffmpeg.wasm/blob/v12.15/Dockerfile
- Core documentation: https://ffmpegwasm.netlify.app/docs/overview/
- Official package: https://registry.npmjs.org/@ffmpeg/core/-/core-0.12.10.tgz
- 同梱：`ffmpeg/ffmpeg-core.js`、`ffmpeg/ffmpeg-core.wasm`。公式UMD配布物は未改変です。
- FFmpeg source and license information: https://ffmpeg.org/download.html / https://ffmpeg.org/legal.html
- FFmpeg source repository: https://git.ffmpeg.org/ffmpeg.git

バージョンを更新するときは、コアとJavaScriptラッパーの組み合わせを検証し、この一覧とライセンスも更新してください。

## Google Fonts / Yusei Magic

見出し用フォント。読み込みに失敗した場合はシステムフォントを使用します。
https://fonts.google.com/specimen/Yusei+Magic
