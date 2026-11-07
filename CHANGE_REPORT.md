# 网站仅博客走 Trilium：交付报告

## 结论与边界

已在独立目录 `/var/minis/workspace/website-update` 完成本地改造，未推送、未发布、未修改远端 Trilium。源码来自 GitHub main 归档（前缀 `71cafc0`）；中断克隆留下的 HEAD 已修复，建立了仅本地原始快照基线提交 `9280520`，本次改动未提交。

- Trilium 只发布博客文章。文章原生编辑、模板、提交/下架、封面、正文图片、定时队列、请求按钮、同步日志和部署回执保留。
- 同步不再输出或暂存 `src/data/site.json`、`src/data/photo-library.json`。App / GitHub 对动态、照片和其他站点内容的更新不再被旧 Trilium 快照覆盖。
- 停用共享媒体自动垃圾清理。文章下架只删除对应 Markdown，不删除 `public/trilium-media/` 图片，也不触碰 `public/photos/`。
- 退役分类不会进入收集、发布选择或文章应用；旧配置仍支持过滤退役分类，新配置将其 ID 保存到 `retired*`，而非忘记它们。
- 原生目录刷新/安装只维护文章、Media 和根说明，不再重建其他分类。旧全站面板源码保留为休眠代码；新模式下禁止重新安装旧面板。
- 相册与灯箱原本没有可见图注；未删除 `alt`、无障碍按钮标签或照片元数据，新增回归保护。无需改照片组件。

## 精确文件清单

1. `.github/workflows/trilium-sync.yml`：移除 site/photo-library 暂存路径，保留文章、媒体、同步清单和部署触发。
2. `scripts/trilium/sync.mjs`：只输出文章/同步清单；使用文章专用模型；删除媒体自动清理循环；仅显式文章下架可删除文章文件。
3. `scripts/trilium/model.mjs`：新增 `applyBlogRecords`，仅处理 post，不依赖旧整站数据校验；旧多分类模型保留为休眠迁移辅助。
4. `scripts/trilium/native.mjs`：收集与选择限定 post/asset；跳过退役目录/面板；保留文章子图片；忽略图片目录里的非图片源文件。
5. `scripts/trilium/publication.mjs`：队列查询限定文章子树，过滤非文章标签/请求；兼容目录推断的文章类型及显式根 `blogSyncRequest`。
6. `scripts/trilium/media.mjs`：sharp 改为仅在实际图片转换时动态加载，导出算法、格式和缩略图规格不变。
7. `scripts/trilium/install-folders.mjs`：仅发现/安装/刷新 post、asset，根说明不再引导全站面板，不更新站点设置关系。
8. `scripts/trilium/install-controls.mjs`：`scope=blog-only` 时拒绝重建旧全站发布面板；既有博客控制不删除。
9. `scripts/trilium/install-manager.mjs`：新模式禁止重装旧全站管理器。
10. `scripts/trilium/blog-only.test.mjs`：新增文章边界、App 数据保留、媒体不清理、退役信号过滤、旧配置兼容、封面/内联图、非图片子笔记及无可见图注回归。
11. `scripts/trilium/native.test.mjs`：旧照片/头像关系测试更新为文章图片及退役内容排除。
12. `scripts/trilium/install-folders.test.mjs`：验证只维护文章和 Media、不恢复退役分类。
13. `package.json`：将新回归加入 `trilium:check`；未改依赖/锁文件。
14. `trilium/config.json`：新增 `scope: blog-only`；活跃 folders 仅 post/asset、活跃模板仅 post；其他 ID 迁至 `retiredFolders`、`retiredControls`、`retiredTemplates`。
15. `README.md`：更新所有权、发布范围、App 数据源及照片 alt 约定。
16. `trilium/使用说明.md`：改为文章专用操作、节点迁移与 App 发布契约，明确禁止用旧快照回填站点。
17. `CHANGE_REPORT.md`：本报告。

`src/data/`、`src/content/`、`public/`、`trilium/published.json` 和 `trilium/signals.json` 均没有内容改动。未删除任何既有文章、动态、照片、原图或媒体。

## 验证真实状态

- `npm ci` 在 Minis 工作区因 `EPERM symlink` 失败；`npm ci --no-bin-links` 成功安装 425 个包。
- 最终 `npm run trilium:check`：45 项，41 通过、2 失败、2 跳过，退出码 1。没有宣称完整测试全绿。
  - `scripts/trilium/media.test.mjs`：本机加载 sharp 原生模块时进程退出 1，未输出正常测试子项；媒体转换测试在本环境未完成。
  - `log.test.mjs` 的既有日期格式断言：预期 `2026/10/24`，本机 ICU 输出 `10/24/2026`；日志生产源码与该测试未改。
  - 两项跳过为可选 Playwright 原生目录视觉测试和旧管理面板浏览器测试；本机无 Playwright。
- 针对性命令：
  ```sh
  node --test scripts/trilium/blog-only.test.mjs scripts/trilium/native.test.mjs scripts/trilium/install-folders.test.mjs scripts/trilium/model.test.mjs scripts/trilium/deletion.test.mjs scripts/trilium/deploy-log.test.mjs
  ```
  38 项，37 通过、0 失败、1 项可选视觉测试跳过，退出码 0。
- 9 个新增/修改的运行脚本与回归文件 `node --check` 全通过；`git diff --check` 通过。
- `git diff --name-only -- public src/data src/content trilium/published.json trilium/signals.json` 为空，确认现有内容与媒体未修改。
- 构建未验证成功：`npm run build` 因 no-bin-links 无 astro 可执行链接退出 127；直接运行 `node node_modules/astro/bin/astro.mjs check` 又遇工作区 realpath ENOENT（目标文件实际存在）。已停止环境绕行，没有修改构建配置来掩盖环境问题。
- 没有使用真实 Trilium 执行 sync、install、report 或写入命令；只读 MCP 核对了文章与图片依赖。

## Trilium 清理范围与文章依赖

只读检查当前文章目录中的 10 条文章/模板元数据：没有文章封面关系指向 Photos 分类条目。唯一自定义封面属性为 `trilium:rkkkArkAqQqF`，图片是 `image/png`、`blogKind=asset`，父笔记为文章 `GlogbzRNBMKv`，不是 Photos 目录。该文章另有 Mermaid 源文件 `J2v34TB1i4dM`；均应保留。本地收集器已兼容忽略非图片源文件。

保留：
- 根 `JCmMu9kLDQ1H`；文章目录 `0ukvnZSfy1Gr` 及所有后代；文章模板 `BT0VvJX0HD9a`。
- Media `e79Dj57Z5UB3` 及其原图；文章子图 `rkkkArkAqQqF` 与其他文章附件。
- 日志 `pG7OAnNvOR8q` 及历史子日志。
- 高级目录 `rpoPQzeoqY8g`、私有配置 `CFQku6wnTRZu`、后端 `1ErmTwoBJyyE`、按钮 `4lPsmL2qq0mV`。不要因为 settings 这个键名而误删私有控制配置：它不是站点设置分类。

可退役的分类：talk `YszU3fSFSm6M`、photo `lzmTLvWqkrm7`、friend `GB6AUsChqjmZ`、project `EwalrEKKreYi`、站点 settings `tjjsURiAErtc`。旧 render 面板 `dEig60EtRXab` 可退役；旧分类模板 ID 已保存在 `retiredTemplates`。

相关类别标签是 `blogKind=talk/photo/friend/project/settings`，其 `publish`/`blogPublishRequested` 不再参与发布。不要删除文章的 `blogKind=post`、图片的 `blogKind=asset`、文章 `blogImage`、模板关系、提交/下架字段。源代码没有发现文章依赖退役分类；推荐先移出活跃根或归档，保留导出备份，再由父代理决定物理删除。未核查全库所有外部反向引用，不能承诺删除不会影响其他非网站笔记。绝不能随分类清理网站媒体文件。

## 原生入口、控制与日志如何重建

当前已有博客控制保留即可，无需执行旧 `install-controls.mjs` / `install-manager.mjs`，这两者现在会明确拒绝新模式，防止旧全站面板回归。

父代理授权远端更新后，可使用已发布的新代码与正确环境变量执行：

```sh
node scripts/trilium/install-folders.mjs
```

该命令会修改远端根、文章/Media 原生索引、文章字段/模板，并保存本地 config；不修改文章正文，不处理退役分类，不重建全站面板。`refreshFolderPages(client, config)` 仅重绘根和两个活跃索引，适合字段/模板已存在时使用。两者都是远端写入操作；本次未执行。清理旧分类后再刷新根，避免保留失效入口。若只做 MCP 更新，根正文可直接替换为下方最小说明。

清理前可在根清除过时的 `blogSyncRequest`、在根更新 `blogSyncStatus` 为迁移完成；这属于父代理远端操作。不要批量清空文章自身 `blogPublishRequested` 或 `publish`，否则可能丢弃未处理的文章发布请求。正常成功同步通过指纹保护仅复位本轮未被再次编辑的文章请求，保留新请求。

若后台脚本/按钮确需恢复：继续使用既有 IDs，不新建同名控制；将 `request.js` 的 `__ROOT__`、`__SETTINGS__` 分别替换为根与私有配置 ID，再由父代理写回既有后端笔记；保留私有配置中的令牌而不输出它。根的旧属性事件钩子如需移除，勿删除后端或按钮本身；文章原生请求/定时队列不依赖全站面板。普通队列和环境变量名仍为 `TRILIUM_SERVER_URL`、`TRILIUM_ETAPI_TOKEN`，未引入新的配置项或凭据要求。

### 可直接写入根笔记的最小正文

博客文章管理

- [文章 Blog](#root/0ukvnZSfy1Gr)：编辑原文章，新文章使用文章模板；保存后打开“提交发布”。下架或恢复时切换“从网站下架”后再次提交。
- [图片素材 Media](#root/e79Dj57Z5UB3)：管理文章封面与正文图片。文章子图片和既有共享原图请保留。
- [同步日志](#root/pG7OAnNvOR8q)：查看进度、错误、文件变化与部署结果。
- [立即运行文章同步](https://github.com/skqfly/skqfly.github.io/actions/workflows/trilium-sync.yml)：Run workflow；也可等待定时检查。

Trilium 仅管理博客文章和文章图片。动态、相册、友链、项目与站点设置改由 App / GitHub 管理；旧全站管理面板停用。未提交的文章修改不会随其他文章发布。

## App 发布契约与工作流

- Talks：写 `src/data/site.json` 的 `talksPageContent.entries`，保留其余字段。每条 `{ id, title, date: "YYYY-MM-DD", description, images: Photo[] }`。
- Photos：写 `src/data/photo-library.json`，以稳定 ID 为键；Photo 为 `{ src, width, height, alt, preview, previewLarge }`。图片提交到 `public/photos/*.jpg`，公开路径 `/photos/*.jpg`；三个图像路径可先用同一地址，也可提供独立缩略图。
- Talks 配图按值存储，不要求同步增加相册条目。保留 alt，仅作无障碍用途，不显示图注。
- JSON 与新增媒体应通过 GitHub Trees/Commits/Refs API 原子提交，以最新 HEAD 为父并处理冲突。OAuth 提交到 main 触发现有 `deploy-pages.yml`，无需写 Trilium 清单或调用 Trilium。
- 只有两个工作流：`trilium-sync.yml` 是保留的博客同步/日志工作流；`deploy-pages.yml` 是全站必要构建部署，也负责文章同步回执。没有额外可删的非博客工作流，删除任一都会破坏所需发布链。

`published.json` 中的旧 `site/photos/ids` 只留作迁移历史；不要把它们重新写回站点或为了“同步清理”删除对应网站内容。迁移后不需要手动重建已发布文章/图片清单。
