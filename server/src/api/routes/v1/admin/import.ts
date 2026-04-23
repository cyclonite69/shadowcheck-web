const express = require('express');
const router = express.Router();
export {};
const sqliteImportRoutes = require('./import/sqlite');
const sqlImportRoutes = require('./import/sql');
const importHistoryRoutes = require('./import/history');
const orphanNetworkRoutes = require('./import/orphans');
const kmlImportRoutes = require('./import/kml');

const appendRoutes = (childRouter: any) => {
  for (const layer of childRouter.stack || []) {
    router.stack.push(layer);
  }
};

appendRoutes(sqliteImportRoutes);
appendRoutes(sqlImportRoutes);
appendRoutes(importHistoryRoutes);
appendRoutes(orphanNetworkRoutes);
appendRoutes(kmlImportRoutes);

module.exports = router;
