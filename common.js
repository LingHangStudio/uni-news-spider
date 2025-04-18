const axios = require("axios");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const { Sequelize, DataTypes } = require("sequelize");
const https = require("https");
const path = require("path");
const NodeUrl = require("node:url");

// 修改为使用 sequelize.js 中的配置
const sequelize = require("./sequelize");

let latestTimeStamp;
let newsId = 0;

// 定义新闻模型
const News = sequelize.define(
  "news",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sub: DataTypes.STRING,
    title: DataTypes.STRING,
    time: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: "发布时间时间戳（毫秒）",
    },
    data: DataTypes.TEXT,
    href: DataTypes.STRING,
    other: DataTypes.JSON,
  },
  {
    defaultScope: {
      order: [
        ["time", "DESC"],
        ["id", "DESC"],
      ],
    },
  }
);

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

function convertTimeObjectToDate(time) {
  if (!time || !time.year || !time.month || !time.day) return latestTimeStamp;
  const nowTimeStamp = new Date(time.year, time.month - 1, time.day).getTime();
  if (nowTimeStamp > latestTimeStamp) latestTimeStamp = nowTimeStamp;
  return nowTimeStamp; // JS中的月份是 0-11
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

// 在 common.js 中添加一个辅助函数来处理多个选择器
function findFirstMatchElement(document, selectors) {
  // 如果 selectors 不是数组，转为数组
  if (!Array.isArray(selectors)) {
    selectors = [selectors];
  }

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }
  return null;
}

// 修改后的 readHtml 函数
async function readHtml(environment, href, html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // 新闻时间 - 支持多个选择器
  const timeSelectors = environment.config.timeSelector || ".arti_update";
  const timeElement = findFirstMatchElement(document, timeSelectors);
  const timeText = timeElement?.textContent || "";
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

  // 新闻标题 - 支持多个选择器
  const titleSelectors = environment.config.titleSelector || ".bt";
  const titleElement = findFirstMatchElement(document, titleSelectors);
  const title = titleElement?.textContent?.replace(/[\r\n\s]/g, "") || "";

  // 新闻正文 - 支持多个选择器
  const textSelectors = environment.config.textSelector || ".read";
  const textElement = findFirstMatchElement(document, textSelectors);
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
    id: newsId++,
    sub: environment.sub, // 使用合并后的 sub 键
    data: text,
    title,
    time: convertTimeObjectToDate(date),
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

async function compareNews(environment) {
  const existingNews = await News.findAll({
    where: { href: environment.allNews },
    attributes: ["href"],
  });
  const existingHrefs = existingNews.map((news) => news.href);
  environment.spideNews = environment.allNews.filter(
    (href) => !existingHrefs.includes(href)
  );

  // 提取日期并排序，让较旧的数据优先爬取
  environment.spideNews.sort((a, b) => {
    // 尝试从URL中提取日期（假设URL中包含日期信息）
    const extractDateFromUrl = (url) => {
      // 尝试匹配多种日期格式
      const datePatterns = [
        /(\d{4})(\d{2})(\d{2})/, // 20231001
        /(\d{4})-(\d{2})-(\d{2})/, // 2023-10-01
        /(\d{4})\/(\d{2})\/(\d{2})/, // 2023/10/01
        /(\d{4})_(\d{2})_(\d{2})/, // 2023_10_01
        /(\d{4})年(\d{2})月(\d{2})日/, // 2023年10月01日
      ];

      for (const pattern of datePatterns) {
        const match = url.match(pattern);
        if (match) {
          return new Date(`${match[1]}-${match[2]}-${match[3]}`);
        }
      }

      // 如果没有找到日期，返回一个很旧的日期（这样会排在最前面）
      return new Date(1970, 0, 1);
    };

    const dateA = extractDateFromUrl(a);
    const dateB = extractDateFromUrl(b);

    // 升序排序（旧日期在前）
    return dateA - dateB;
  });

  console.log(
    `${environment.spideNews.length} page(s) will be spide in chronological order (oldest first):`,
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
