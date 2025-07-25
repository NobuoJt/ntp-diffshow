# NTP Diff Show

このアプリは、指定したNTPサーバーから一回限り正確な時刻を取得し、ローカル時刻と比較・統計・グラフ・CSV出力を行うWebアプリです。

## 主な機能

- NTPサーバーリスト（別ファイル指定）から時刻を取得
- 毎秒更新のローカル時刻表示
- サーバーごとに取得時刻・diff・偏差・シグマ（色分け）・グラフ表示
- 2シグマ・1シグマ外を排除した偏差表示
- 取得時メタデータの表示
- すべてのデータをCSVで出力

## 現在

### クライアント部分:vite→Apache

ソースはGitHub。  
- vite+reactでビルドしたファイル群を、```www/html/ntp/*``` に配置。  
- ```ogaserve.pgw.jp/ntp```でブラウザからアクセス可能。   

### API部分:Docker

API部分```server.js```はDockerでまとめてogaserveへ。  

- GitHubのソースをコンテナ化。
- `systemctl start nobuo_ntp_api.service`で起動。  
  - `~/nobuo/etc/`にスクリプト配置。  
  - `docker run --rm --init -p 3001:3001 -v /home/mario/nobuo/api/ntp/localhost-cert.pem:/app/localhost-cert.pem -v /home/mario/nobuo/api/ntp/localhost-key.pem:/app/localhost-key.pem \ nobuojt/ntp-api-server`  
  でAPIサーバー展開・起動。

- ```ogaserve.pgw.jp:3001/api/ntp?host=ntp.nict.jp```でjsonとして取得可能。  

- `/home/mario/nobuo/api/ntp/*`にHTTPS用pemファイルがあるので、Docker内にマウント。

`compose.yml`で指定するものは、イメージのrun時にはコマンドで入力する必要がある。

## 開発・起動方法

```sh
npm install
npm run dev
```

---

## React + TypeScript + Vite テンプレート情報

このテンプレートは、ViteでReactを動作させるための最小限の設定を提供し、HMR（ホットモジュールリプレースメント）やいくつかのESLintルールが含まれています。

現在、2つの公式プラグインが利用可能です：

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) は、Fast Refreshのために[Babel](https://babeljs.io/)を使用します
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) は、Fast Refreshのために[SWC](https://swc.rs/)を使用します

## ESLint設定の拡張

本番アプリケーションを開発している場合、型に基づいたLintルールを有効にするために設定を更新することをお勧めします：

```js
export default tseslint.config({
  extends: [
    // ...tseslint.configs.recommendedを削除し、これに置き換えます
    ...tseslint.configs.recommendedTypeChecked,
    // より厳密なルールを使用するには、これを代わりに使用します
    ...tseslint.configs.strictTypeChecked,
    // オプションで、スタイルに関するルールを追加するには、これを追加します
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // 他のオプション...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

また、React専用のLintルールのために、[eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x)と[eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom)をインストールすることもできます：

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // react-xとreact-domプラグインを追加
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // 他のルール...
    // 推奨されるTypeScriptルールを有効にします
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```

---
