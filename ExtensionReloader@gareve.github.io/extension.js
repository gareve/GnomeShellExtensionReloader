/*
Reload extension with: 
env GNOME_SHELL_SLOWDOWN_FACTOR=2 MUTTER_DEBUG_DUMMY_MODE_SPECS=1024x768 dbus-run-session -- gnome-shell --nested --wayland
*/

"use strict";

const { St, GObject, Gio, Meta, Shell, GLib } = imports.gi;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ByteArray = imports.byteArray;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Utils, SCHEMA_PATH_KEY } = Me.imports.utils;
const { ExtensionType } = ExtensionUtils;

let myPopup;

function execCMD(args) {
  Utils.log(">>>>>> RUNNING CMD: " + JSON.stringify(args));
  let [ok, stdout, stderr, status] = GLib.spawn_sync(
    null,
    args,
    null,
    null,
    null
  );
  Utils.log(">>>>>> OK?: " + ok);
  Utils.log(">>>>>> STDOUT: " + stdout);
  Utils.log(">>>>>> STDERR: " + stderr);
  Utils.log(">>>>>> STATUS: " + status);
}

function getNewestUUIDFromSettings() {
  const settings = ExtensionUtils.getSettings(
    "org.gnome.shell.extensions.ExtensionReloader"
  );
  let extensionMetadataFile = Gio.File.new_for_path(
    settings.get_string(SCHEMA_PATH_KEY)
  );
  return extensionMetadataFile.get_parent().get_basename();
}

function deleteAllVersionsOfExtension() {
  Utils.log("START deleteAllVersionsOfExtension");
  const uuid = getNewestUUIDFromSettings();
  for (let iUUID of Main.extensionManager.getUuids()) {
    if (!iUUID.startsWith(uuid)) {
      continue;
    }
    let extension = Main.extensionManager.lookup(iUUID);
    if (!extension || extension.type !== ExtensionType.PER_USER) {
      continue;
    }

    Main.extensionManager.unloadExtension(extension);
    execCMD([
      "/usr/bin/rm",
      "-rf",
      GLib.build_filenamev([global.userdatadir, "extensions", iUUID]),
    ]);
  }
}

function installEphimeralExtension() {
  Utils.log("START installEphimeralExtension");
  const uuid = getNewestUUIDFromSettings();
  // based on https://stackoverflow.com/questions/62265594/gnome-shell-extension-install-possible-without-restart
  const settings = ExtensionUtils.getSettings(
    "org.gnome.shell.extensions.ExtensionReloader"
  );
  const manager = Main.extensionManager;
  const nowTimestamp = Date.now();
  const ephUUID = uuid + "_eph_" + nowTimestamp;
  const ephExtensionPath = GLib.build_filenamev([
    global.userdatadir,
    "extensions",
    ephUUID,
  ]);
  const ephExtensionDir = Gio.File.new_for_path(ephExtensionPath);

  // Copy extension to installation path with ephimeral UUID
  execCMD([
    "/usr/bin/cp",
    "-r",
    Gio.File.new_for_path(settings.get_string(SCHEMA_PATH_KEY))
      .get_parent()
      .get_path(),
    ephExtensionPath,
  ]);

  // Modifying metadata.json
  const metadataFile = ephExtensionDir.get_child("metadata.json");
  const [, metadataContents] = metadataFile.load_contents(null);
  const meta = JSON.parse(ByteArray.toString(metadataContents));
  meta.uuid = ephUUID;
  meta.name += " eph_" + nowTimestamp;
  metadataFile.replace_contents(
    JSON.stringify(meta),
    null,
    false,
    Gio.FileCreateFlags.REPLACE_DESTINATION,
    null
  );

  let extension = manager.createExtensionObject(
    ephUUID,
    ephExtensionDir,
    ExtensionType.PER_USER
  );

  try {
    manager.loadExtension(extension);
    // Link folder to dir with new uuid! to cheat importer
    if (!manager.enableExtension(ephUUID))
      throw new Error(
        "Cannot add %s to enabled extensions gsettings key".format(ephUUID)
      );
    Main.notify(
      "Old Extension deleted & new Ephimeral Extension installed",
      ephUUID
    );
    Utils.log("Successful Installation of Ephimeral Extension");
  } catch (e) {
    let extension = Main.extensionManager.lookup(ephUUID);
    if (extension) {
      Main.extensionManager.unloadExtension(extension);
    }
    const errorMessage = "Error while installing %s: %s (%s)".format(
      ephUUID,
      "LoadExtensionError",
      e
    );
    Utils.log(errorMessage);
    throw new Error(errorMessage);
  }
}

function cleanExtensionReload() {
  Utils.log("START cleanExtensionReload");
  deleteAllVersionsOfExtension();
  installEphimeralExtension();
}

const MyPopup = GObject.registerClass(
  class MyPopup extends PanelMenu.Button {
    _init() {
      super._init(0);
      const isWayland = Meta.is_wayland_compositor();
      Utils.log("Starting Extension! is_wayland=" + isWayland);

      const settings = ExtensionUtils.getSettings(
        "org.gnome.shell.extensions.ExtensionReloader"
      );
      let extensionMetadataFile = Gio.File.new_for_path(
        settings.get_string(SCHEMA_PATH_KEY)
      );
      let uuid = extensionMetadataFile.get_parent().get_basename();
      let extensionExists = extensionMetadataFile.query_exists(null);

      let icon = new St.Icon({
        icon_name: "view-refresh-symbolic",
        style_class: "system-status-icon",
      });

      this.add_child(icon);

      // Validations
      if (!extensionExists) {
        uuid = "Please select a valid metadata.json file on the preferences";
        Utils.log("No valid metadata.json found");
      }
      if (!isWayland) {
        uuid =
          "ExtensionReloader was made for Wayland. Just run Alt+F2 'r' to restart on X-Server";
      }

      // Extension Label
      let extensionMenuItem = new PopupMenu.PopupMenuItem(uuid, {
        reactive: false,
      });
      this.menu.addMenuItem(extensionMenuItem);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      if (!isWayland) {
        Utils.log("Not running wayland. Displaying error and leaving");
        return;
      }

      // Reload Extension
      let reloadButton = new PopupMenu.PopupImageMenuItem(
        "Reload Extension! (" +
          settings.get_strv("reload-extension-hotkey") +
          ")",
        "view-refresh-symbolic"
      );
      this.menu.addMenuItem(reloadButton);
      reloadButton.connect("activate", () => {
        cleanExtensionReload(uuid);
      });

      // Clean ephimeral Extensions
      let deleteButton = new PopupMenu.PopupImageMenuItem(
        "Delete Ephimeral Versions",
        "edit-delete-symbolic"
      );
      this.menu.addMenuItem(deleteButton);
      deleteButton.connect("activate", () => {
        deleteAllVersionsOfExtension(uuid);
        Main.notify("All installed ephimeral versions were deleted");
      });

      if (!extensionExists) {
        deleteButton.reactive = false;
        reloadButton.reactive = false;
      }

      // Preferences Button
      let prefButton = new PopupMenu.PopupImageMenuItem(
        "Preferences",
        "system-run-symbolic"
      );
      this.menu.addMenuItem(prefButton);
      prefButton.connect("activate", () => {
        ExtensionUtils.openPrefs();
      });

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // Subscribe to changes in prefs
      settings.connect(`changed::${SCHEMA_PATH_KEY}`, () => {
        Utils.log("Settings updated. Refreshing UI");
        extensionMetadataFile = Gio.File.new_for_path(
          settings.get_string(SCHEMA_PATH_KEY)
        );
        extensionExists = extensionMetadataFile.query_exists(null);

        extensionMenuItem.label.set_text(
          extensionMetadataFile.get_parent().get_basename()
        );
        deleteButton.reactive = extensionExists;
        reloadButton.reactive = extensionExists;
      });

      // Keybinding
      Main.wm.addKeybinding(
        "reload-extension-hotkey",
        settings,
        Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        () => {
          Utils.log("Shortcut used. Reloading Extension");
          cleanExtensionReload();
        }
      );
    }
  }
);

// eslint-disable-next-line no-unused-vars
function init() {}

// eslint-disable-next-line no-unused-vars
function enable() {
  myPopup = new MyPopup();
  Main.panel.addToStatusArea("ReloadExtensionPopup", myPopup, 1);
}

// eslint-disable-next-line no-unused-vars
function disable() {
  Main.wm.removeKeybinding("reload-extension-hotkey");
  if (myPopup) {
    myPopup.destroy();
  }
}
