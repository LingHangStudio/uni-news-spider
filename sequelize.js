const { Sequelize } = require("sequelize");

let databaseConfig = {};
try {
  console.log("Using database config file ./config/database/database.json");
  databaseConfig = require("./config/database/database.json");
} catch (err) {
  console.log("Database config not found, using default.");
  databaseConfig = {
    host: "127.0.0.1",
    username: "postgres",
    password: "default_password",
    database: "default_database",
    port: 5432,
    dialect: "postgres",
  };
}

// 初始化 Sequelize
const sequelize = new Sequelize(
  databaseConfig.database,
  databaseConfig.username,
  databaseConfig.password,
  {
    host: databaseConfig.host,
    port: databaseConfig.port,
    dialect: databaseConfig.dialect,
    logging: console.log,
  }
);

sequelize
  .authenticate()
  .then(() => {
    console.log("Database connected successfully.");
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
  });

module.exports = sequelize;
