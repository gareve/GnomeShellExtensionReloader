"use strict";
/* exported Utils, SCHEMA_PATH_KEY */

const LOG_PREFIX = "_EXTENSION_RELOADER_LOG_ ";
const SCHEMA_PATH_KEY = "extension-metadata-path";

const Utils = {
  log: (str) => {
    const lines = str.split("\n");
    log(LOG_PREFIX + " > " + lines[0]);
    for (let i = 1; i < lines.length; i++) {
      log(LOG_PREFIX + " : " + lines[i]);
    }
  },
};
