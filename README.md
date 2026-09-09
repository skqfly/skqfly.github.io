# mmddskq.top

skqfly 的个人网站，记录计算数学、科学计算、数学建模与相关实践。

## 技术栈

- **框架**：[Astro](https://astro.build) v6 — 静态站点生成
- **样式**：Tailwind CSS v4 + CSS 自定义属性（亮/暗主题）
- **UI 组件**：Astro 静态组件 + 原生浏览器脚本
- **图标**：[astro-icon](https://github.com/natemoo-re/astro-icon)（Material Design Icons）
- **数学渲染**：KaTeX（`remark-math` + `rehype-katex`）
- **字体**：Inter Variable

## 站点结构

```
src/
├── assets/          # 静态资源（头像等）
├── components/      # UI 组件
│   └── talks/       # Talks 静态时间线组件
├── content/
│   └── posts/       # 博客文章（Markdown）
├── data/            # 共用照片数据
├── layouts/         # 页面布局
├── pages/           # 路由页面
│   ├── blog/        # Blog 列表 & 文章页
│   ├── index.astro  # 首页
│   ├── about.astro
│   ├── friends.astro
│   ├── photos.astro
│   ├── projects.astro
│   └── talks.astro
├── styles/          # 全局样式
└── config.ts        # 站点配置（导航、链接、社交等）
```

## 本地开发

推荐 Node.js 24（最低 22.18），与 CloudBase 构建环境保持一致。

```bash
# 安装依赖
npm ci

# 启动开发服务器
npm run dev

# 生产构建
npm run build

# 本地预览构建结果
npm run preview
```

## 内容管理

### 博客文章

文章位于 `src/content/posts/`，使用 Markdown 格式，支持数学公式（KaTeX）。

每篇文章需包含 frontmatter：

```yaml
---
title: 文章标题
pubDate: 2026-01-01
category: 分类名
description: 文章简介
author: skqfly
image:
  url: /logo.svg
  alt: skqfly 标志
---
```

### 站点配置

`src/config.ts` 集中管理导航栏、社交链接、首页内容等，修改后自动生效。

### 页面

| 页面 | 路由 | 说明 |
|------|------|------|
| 首页 | `/` | 个人介绍 + 社交链接 |
| Blog | `/blog` | 文章时间线 |
| Projects | `/projects` | 项目展示 |
| Talks | `/talks` | 分享与交流记录 |
| Photos | `/photos` | 摄影作品 |
| Friends | `/friends` | 友情链接 |
| About | `/about` | 关于页 |

## 特性

- 亮色/暗色主题切换（带 clip-path 过渡动画）
- 响应式设计（桌面 + 移动端）
- KaTeX 数学公式渲染
- RSS Feed（`/feed.xml`）
- 鼠标悬停或键盘聚焦时预加载站内导航
- 摄影作品画廊（支持固定/原始比例切换）
- Photos / Talks 共用图片预览，点击图片切换、点击空白关闭，支持方向键和 Escape
- 本地 WebP 缩略图，打开预览时加载图床原图

## 摄影图片

`src/data/photos.ts` 统一维护原图地址、尺寸、说明及预览图路径。
添加或更换图片后运行 `npm run images:generate`，生成 480 / 960 像素的 WebP
预览图，并将 `public/photos/` 的产物一起提交。该命令需要联网读取图床，
日常 `npm run build` 使用已生成的预览图，不依赖图床可用性。
预览图命名为 `<photoLibrary 中的键名>-480.webp` 和 `-960.webp`，
应与数据中的 `preview`、`previewLarge` 路径一致。

## 部署

站点已配置 GitHub Pages 部署，推送到 `main` 分支后自动构建发布。

CloudBase 静态网站托管：框架选 Astro，Node.js 24，目标目录 `./`，
安装命令 `npm ci`，构建命令 `npm run build`，产物目录 `./dist`，部署路径 `/`。
无需环境变量。正式域名由 `astro.config.mjs` 的 `site` 配置维护，
用于 canonical、分享链接和 RSS；绑定新域名时一起更新。
