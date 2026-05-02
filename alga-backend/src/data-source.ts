import { DataSource } from "typeorm";
import { Game } from "./entity/Game";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "alga",
  password: process.env.DB_PASS || "alga123",
  database: process.env.DB_NAME || "alga",
  synchronize: true,
  logging: false,
  entities: [Game],
});
