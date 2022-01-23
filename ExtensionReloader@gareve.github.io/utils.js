"use strict";
/* exported Utils */

const PREFIX = "_EXTENSION_RELOADER_LOG_ ";

const Utils = {
  log: (str) => {
    const lines = str.split("\n");
    log(PREFIX + " > " + lines[0]);
    for (let i = 1; i < lines.length; i++) {
      log(PREFIX + " : " + lines[i]);
    }
  },
};
