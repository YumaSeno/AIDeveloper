# AIDeveloper

- [AIDeveloper](#aideveloper)
  - [概要](#概要)
  - [環境構築](#環境構築)
    - [VSCodeのDevContainersを利用する方法](#vscodeのdevcontainersを利用する方法)
      - [前提条件](#前提条件)
      - [手順](#手順)
    - [コンテナを利用する方法(DevContainerなし)](#コンテナを利用する方法devcontainerなし)
      - [前提条件](#前提条件-1)
      - [手順](#手順-1)
    - [コンテナ無しでnode.jsを利用する方法](#コンテナ無しでnodejsを利用する方法)
      - [前提条件](#前提条件-2)
      - [手順](#手順-2)
  - [開発 (未作成)](#開発-未作成)

## 概要
AIDeveloperは、AIを活用して開発を支援するツールです。
TypeScript言語を利用して開発されています。

## 環境構築
### VSCodeのDevContainersを利用する方法
#### 前提条件
- VSCodeがインストールされていること
- VSCodeに拡張機能「Dev Containers, Container Tools, Docker」がインストールされていること
- Dockerがインストールされていること
- Docker Composeがインストールされていること

#### 手順
1. VSCodeにGitHubアカウントでログインし、リポジトリをクローンします。
2. クローンしたディレクトリをVSCodeで開きます。
3. DockerのDev Containersを利用してコンテナを作成・起動します。VSCodeのウィンドウ一番左下、リモートウィンドウを開くボタンから「コンテナで再度開く」を選択します。(Ctrl + Shift + Pでコマンドパレットを開き、「コンテナで再度開く」と入力しても良い。)
4. 開発を開始します。F5を押下するとデバッグが起動します。

### コンテナを利用する方法(DevContainerなし)
#### 前提条件
- Dockerがインストールされていること
- Docker Composeがインストールされていること

#### 手順
1. リポジトリをクローンします。
2. クローンしたディレクトリに移動します。
3. Docker Composeでコンテナを起動します。
   ```bash
   docker-compose up -d
   ```
4. bashを起動し開発を開始します。
   ```bash
   docker-compose exec ai_developer_ts /bin/bash
   ```
4. プログラムを起動する場合はnpm startを実行します。
   ```bash
   npm start
   ```

### コンテナ無しでnode.jsを利用する方法
#### 前提条件
- node.jsがインストールされていること
- npmがインストールされていること

#### 手順
1. リポジトリをクローンします。
2. クローンしたディレクトリに移動します。
3. 依存関係をインストールします。
   ```bash
   npm install
   ```
4. プログラムを起動します。
   ```bash
   npm start
   ```

## 開発 (未作成)
