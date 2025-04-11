const axios = require("axios");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const { Sequelize, DataTypes } = require("sequelize");
const https = require("https");
const path = require("path");
const NodeUrl = require("node:url");

// 修改为使用 sequelize.js 中的配置
const sequelize = require("./sequelize");

// 定义新闻模型
const News = sequelize.define("News", {
  sub: DataTypes.STRING, // 直接使用合并后的 sub 作为唯一标识
  data: DataTypes.TEXT,
  title: DataTypes.STRING,
  time: DataTypes.JSON,
  href: DataTypes.STRING,
  other: DataTypes.JSON,
});

// 判断路径类型是绝对路径、相对路径还是网络路径
function pathType(pathString) {
  if (path.isAbsolute(pathString)) {
    return "absolute";
  } else {
    if (pathString.startsWith("http://") || pathString.startsWith("https://")) {
      return "web";
    } else {
      return "relative";
    }
  }
}

// 补全相对路径为绝对路径
function subAssetUrl(currentUrl, assetUrl) {
  const assetUrlType = pathType(assetUrl);
  if (assetUrlType === "web") {
    return assetUrl;
  } else if (assetUrlType === "absolute") {
    const urlObj = new NodeUrl.URL(currentUrl);
    urlObj.pathname = assetUrl;
    return decodeURIComponent(urlObj.toString());
  } else if (assetUrlType === "relative") {
    const urlObj = new NodeUrl.URL(currentUrl);
    urlObj.pathname = path.join(path.dirname(urlObj.pathname), assetUrl);
    return decodeURIComponent(urlObj.toString());
  }
}

// 读取新闻 HTML ，并写入数据库
async function readHtml(environment, href, html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // 新闻时间
  const timeSelector = environment.config.timeSelector || ".arti_update";
  const timeText = document.querySelector(timeSelector)?.textContent || "";
  const targetMatch =
    timeText.match(/[0-9]+-[0-9]+-[0-9]+/) ||
    timeText.match(/[0-9]+年[0-9]+月[0-9]+日/);
  const date = targetMatch
    ? {
        year: parseInt(targetMatch[0].split(/[-年月日]/)[0]),
        month: parseInt(targetMatch[0].split(/[-年月日]/)[1]),
        day: parseInt(targetMatch[0].split(/[-年月日]/)[2]),
      }
    : { year: 0, month: 0, day: 0 };

  // 新闻标题
  const titleSelector = environment.config.titleSelector || ".bt";
  const title =
    document
      .querySelector(titleSelector)
      ?.textContent?.replace(/[\r\n\s]/g, "") || "";

  // 新闻正文
  const textSelector = environment.config.textSelector || ".read";
  const textElement = document.querySelector(textSelector);
  const text = textElement?.innerHTML || "";

  // 存放图片和附件等附加信息
  const other = { picList: [] };

  // 从 text 中提取图片
  if (textElement) {
    const imgElements = textElement.querySelectorAll("img");
    imgElements.forEach((img) => {
      const oldPic = img.getAttribute("src");
      const newPic = subAssetUrl(href, oldPic);
      other.picList.push(newPic);
    });
  }

  // 写入数据库，保存 sub 为唯一键
  await News.create({
    sub: environment.sub, // 使用合并后的 sub 键
    data: text,
    title,
    time: date,
    href,
    other,
  });
}

// 爬取新闻目录页面，把新闻 URL 追加到 environment.allNews 列表中
async function spideContents(environment) {
  const res = await axios.get(environment.newsContents, {
    httpsAgent: environment.agent,
  });
  const dom = new JSDOM(res.data);
  const document = dom.window.document;

  const listSelector =
    environment.config.listSelector || ".wp_article_list .Article_Title a";
  document.querySelectorAll(listSelector).forEach((a) => {
    const hrefUrl = a.getAttribute("href");
    if (hrefUrl) {
      const newsUrl = subAssetUrl(environment.newsContents, hrefUrl);
      if (path.extname(newsUrl) === ".htm") {
        environment.allNews.push(newsUrl);
      }
    }
  });
}

// 对照数据库判断哪些是新的新闻需要爬取
async function compareNews(environment) {
  const existingNews = await News.findAll({
    where: { href: environment.allNews },
    attributes: ["href"],
  });
  const existingHrefs = existingNews.map((news) => news.href);
  environment.spideNews = environment.allNews.filter(
    (href) => !existingHrefs.includes(href)
  );
  console.log(
    `${environment.spideNews.length} page(s) will be spide:`,
    environment.spideNews
  );
}

// 爬取 environment.spideNews 中的新闻
async function spideNews(environment) {
  for (const href of environment.spideNews) {
    try {
      const res = await axios.get(href, { httpsAgent: environment.agent });
      await readHtml(environment, href, res.data);
    } catch (err) {
      console.error(`Failed to fetch ${href}:`, err);
    }
  }
}

// 主启动函数
async function launch(sub, url, config = {}) {
  await sequelize.sync();
  const environment = {
    newsContents: url,
    sub,
    allNews: [],
    spideNews: [],
    agent: new https.Agent({ rejectUnauthorized: false }),
    config,
  };

  try {
    await spideContents(environment);
    await compareNews(environment);
    await spideNews(environment);
  } catch (err) {
    console.error("Spide task failed:", err);
  }
}

module.exports = { launch };
