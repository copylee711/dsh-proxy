# 2026-10-06 设置页导航图标（0.4.3）

## 背景

用户反馈设置页导航里“网络代理”用的是宿主给第三方插件的通用齿轮，辨识度低。

## 改动

- 新增 `src/client/nav-icon.ts`：按标签（中文“网络代理”或英文名）找到导航里的这一行，用 CSS 遮罩把齿轮换成网络节点图标（Lucide network）。做法与 Office、电脑控制两个插件相同；宿主的 `settings.section` 注册项不带图标字段，只能这样换。
- 重新构建并提交 `client/client.js`。

## 验证

- `npm run typecheck`、`npm test`（33 项）通过，`npm run build` 后 `lib`、`client` 与源码一致。
- 没有在桌面版里看实际效果。
