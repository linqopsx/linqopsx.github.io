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
