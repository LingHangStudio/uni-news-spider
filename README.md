# 武科大助手新闻资讯爬虫

本项目为武科大助手新闻资讯的爬虫脚本项目，从武科大新闻官网爬取新闻，并存入数据库中。

## 功能描述

- 爬取武科大新闻官网的新闻列表和详情页。
- 支持多页面、多模块的新闻爬取。
- 自动存储爬取的新闻数据到 PostgreSQL 数据库。
- 提供灵活的配置文件支持，方便扩展爬取目标。

## 安装步骤

1. 克隆项目到本地：

   ```bash
   git clone https://github.com/your-repo/university-news-spider.git
   cd university-news-spider
   ```

2. 安装依赖：

   ```bash
   npm install
   ```

3. 配置数据库：

   - 修改 `config/database/database.json` 文件，填写正确的数据库连接信息。

4. 配置爬取目标：
   - 在 `config/spiders` 目录下添加或修改 JSON 配置文件，定义爬取的目标网址和选择器。

## 使用方法

1. 启动爬虫：

   ```bash
   node index.js
   ```

2. 查看日志输出，确认爬取任务是否成功。

## 相关链接

### 预览页面

- [武科大助手新闻资讯页面预览版](https://news.wust.edu.cn)

### 开发文档

- [武科大助手新闻资讯 API 文档](https://api-docs.example.com)

### 项目

- [武科大助手新闻资讯前端项目](https://github.com/your-repo/university-news-frontend)
- [武科大助手新闻资讯 API 项目](https://github.com/your-repo/university-news-api)
- [武科大助手新闻资讯爬虫项目](https://github.com/your-repo/university-news-spider)

## 贡献

欢迎提交 Issue 或 Pull Request 来改进本项目。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。
