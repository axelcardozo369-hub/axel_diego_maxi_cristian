import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

// Tabla pivote de la relación N:M entre fuentes y categorías
export const DataSourceCategory = sequelize.define(
  "DataSourceCategory",
  {
    data_source_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
  },
  { tableName: "data_source_categories", timestamps: true },
);
