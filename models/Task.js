const { DataTypes } = require("sequelize");
const sequelize = require("../sequelize"); // 引入数据库连接

// 定义 Task 模型
const Task = sequelize.define(
  "Task",
  {
    sub: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "tasks", // 如果表名不一致，可以指定
    timestamps: false, // 禁用默认的 createdAt 和 updatedAt
  }
);

module.exports = Task;
