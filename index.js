const { JSDOM } = require("jsdom");
const sequelize = require("./sequelize"); // 数据库配置
const fs = require("fs");
const path = require("path");

// 获取 config 目录下的所有子文件夹
const configDir = path.join(__dirname, "config"); // 假设 config 目录和当前文件在同一级目录
const subDirs = fs
  .readdirSync(configDir, { withFileTypes: true })
  .filter((dir) => dir.isDirectory());

// 定义一个数组，用于存储所有的配置对象
let allConfigs = [];

// 遍历 config 目录中的子文件夹
subDirs.forEach((subDir) => {
  // 确保子文件夹是 'spiders'
  if (subDir.name === "spiders") {
    const spiderDir = path.join(configDir, subDir.name);

    // 获取 spiders 目录下的所有文件
    const files = fs.readdirSync(spiderDir);

    // 遍历 spiders 目录中的每个文件
    files.forEach((file) => {
      // 只处理 .json 文件
      if (file.endsWith(".json")) {
        const filePath = path.join(spiderDir, file); // 拼接文件的完整路径

        try {
          // 读取并解析 JSON 文件
          const data = fs.readFileSync(filePath, "utf8");
          const jsonData = JSON.parse(data);

          // 获取 urls 部分和 config 部分
          const urls = jsonData.urls;
          const config = {
            listSelector: jsonData.listSelector,
            titleSelector: jsonData.titleSelector,
            timeSelector: jsonData.timeSelector,
            textSelector: jsonData.textSelector,
          };

          // 将 urls 和 config 放入一个对象中并推入 allConfigs 数组
          allConfigs.push({ urls, config });
        } catch (err) {
          console.error(`无法读取或解析文件 ${file}:`, err);
        }
      }
    });
  }
});

const { launch } = require("./common"); // 引入 launch 函数

async function fetchPage(url) {
  try {
    const { window } = await JSDOM.fromURL(url);
    return window.document;
  } catch (err) {
    console.error(`Failed to load URL: ${url}`, err);
    return null; // 返回 null 表示加载失败
  }
}

// 爬虫函数，处理每个任务并将其存储到数据库中
async function spiderRoutine() {
  try {
    await sequelize.authenticate();
    console.log("Database connected successfully.");
    await sequelize.sync();
  } catch (error) {
    console.error("Database connection failed:", error);
    return;
  }

  // 遍历 tasks 配置
  for (let taskConfig of allConfigs) {
    const { urls, config } = taskConfig; // 从任务配置中提取 urls 和 config

    // 遍历 urls，并执行每个任务
    for (let [key, target] of Object.entries(urls)) {
      const document = await fetchPage(target);
      if (!document) {
        console.log(`Failed to load ${target}`);
        continue;
      }

      // 提取网页内容（示例）
      const element = document.querySelector(config.textSelector);
      const pageContent = element ? element.textContent : "No content found";

      // 执行爬虫逻辑
      try {
        await launch(key, target, config); // 调用 launch 函数并传递参数
      } catch (err) {
        console.error(`Spider execution failed for ${key} - ${target}:`, err);
      }
    }
  }
}

// 调用爬虫函数
spiderRoutine().catch((err) => {
  console.error("Error in spider routine:", err);
});
