# Theodore 的博客

使用 [Chirpy Starter](https://github.com/cotes2020/chirpy-starter) 和 Jekyll 搭建，发布到 GitHub Pages。

博客地址：https://linqopsx.github.io

## 修改博客

- 博客名、简介、头像：编辑 `_config.yml`。
- 关于页面：编辑 `_tabs/about.md`。
- 文章：放在 `_posts/` 中，文件名为 `年-月-日-英文短名.md`。
- 图片：建议放在 `assets/img/` 下，在文章中使用相应路径引用。

## 在 GitHub 上写文章

进入仓库的 `_posts` 文件夹，选择 **Add file → Create new file**。
文件名例如 `2026-10-26-my-first-note.md`，文章开头使用：

```yaml
---
title: 我的第一篇笔记
date: 2026-10-26 09:00:00 +0800
categories: [学习]
tags: [笔记]
---
```

在第二个 `---` 下写正文，提交到 `main` 后，GitHub Actions 会构建并更新网站。
日期在未来的文章会等到相应时间后再次构建才显示；立即发布时应使用当前或过去的时间。

## 发布设置

仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
构建和检查通过后，工作流会自动部署。进入 **Actions** 查看结果。

## 本地使用（可选）

安装符合主题要求的 Ruby 和 Bundler 后，在项目目录执行：

```text
bundle install
bundle exec jekyll serve
```

打开 http://127.0.0.1:4000 预览。无需为了在线写作而安装本地 Ruby。

## 官方资料

- [入门指南](https://chirpy.cotes.page/posts/getting-started/)
- [主题项目](https://github.com/cotes2020/jekyll-theme-chirpy)

本项目保留上游 MIT 许可证。

## 网页写作后台

- [进入后台](https://linqopsx.github.io/admin/)
- [首次登录与使用帮助](https://linqopsx.github.io/admin/help/)

公开文章通过 GitHub 账号登录 Pages CMS，可管理文章、图片和关于页面。保存后自动构建发布。

## 私人草稿

进入 https://linqopsx.github.io/admin/private/ 管理未公开文章。内容和图片保存在单独的私有仓库，当前博客构建不读取该仓库。

保存私人草稿不会公开发布；若要公开，请在公开文章编辑器中新建文章，复制正文和需要公开的图片。

公开写作使用 GitHub 账号登录，私人写作沿用对应 Resource owner 的作者令牌。不要把私人草稿文件复制到此公开仓库。
