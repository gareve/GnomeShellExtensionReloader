/*
Reload extension with: 
env GNOME_SHELL_SLOWDOWN_FACTOR=2 MUTTER_DEBUG_DUMMY_MODE_SPECS=1024x768 dbus-run-session -- gnome-shell --nested --wayland | grep Gareve
log('>>>>>>>>>>>>> enable');
Main.notify('Gareve Notification', 'Cuack');

https://gjs-docs.gnome.org/
https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/extensionSystem.js
https://gitlab.gnome.org/GNOME/gjs/-/blob/master/gjs/importer.cpp

https://codeberg.org/som/ExtensionReloader/src/branch/face/extension.js
*/

"use strict";

const Main = imports.ui.main;
const St = imports.gi.St;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const ByteArray = imports.byteArray;

const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const { ExtensionType } = ExtensionUtils;

let myPopup;

function getSettings() {
  let GioSSS = Gio.SettingsSchemaSource;
  let schemaSource = GioSSS.new_from_directory(
    Me.dir.get_child("schemas").get_path(),
    GioSSS.get_default(),
    false
  );
  let schemaObj = schemaSource.lookup(
    "org.gnome.shell.extensions.ExtensionReloader",
    true
  );
  if (!schemaObj) {
    throw new Error("cannot find schemas");
  }
  return new Gio.Settings({ settings_schema: schemaObj });
}

function execCMD(args) {
  log(">>>>>> RUNNING CMD: " + JSON.stringify(args));
  let [ok, stdout, stderr, status] = GLib.spawn_sync(
    null,
    args,
    null,
    null,
    null
  );
  log(">>>>>> OK?: " + ok);
  log(">>>>>> STDOUT: " + stdout);
  log(">>>>>> STDERR: " + stderr);
  log(">>>>>> STATUS: " + status);
}

function deleteAllVersionsOfExtension(uuid) {
  for (let i_uuid of Main.extensionManager.getUuids()) {
    if (!i_uuid.startsWith(uuid)) {
      continue;
    }
    let extension = Main.extensionManager.lookup(i_uuid);
    if (!extension || extension.type !== ExtensionType.PER_USER) {
      continue;
    }

    Main.extensionManager.unloadExtension(extension);
    execCMD([
      "/usr/bin/rm",
      "-rf",
      GLib.build_filenamev([global.userdatadir, "extensions", i_uuid]),
    ]);
  }
}

function installEphimeralExtension(uuid) {
  // based on https://stackoverflow.com/questions/62265594/gnome-shell-extension-install-possible-without-restart
  const settings = getSettings();
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
    Gio.File.new_for_path(settings.get_string("extension-metadata-path"))
      .get_parent()
      .get_path(),
    ephExtensionPath,
  ]);

  // Modifying metadata.json
  // TODO: Error handling
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
  } catch (e) {
    let extension = Main.extensionManager.lookup(ephUUID);
    if (extension) Main.extensionManager.unloadExtension(extension);
    throw new Error(
      "Error while installing %s: %s (%s)".format(
        ephUUID,
        "LoadExtensionError",
        e
      )
    );
  }
}

const MyPopup = GObject.registerClass(
  class MyPopup extends PanelMenu.Button {
    _init() {
      super._init(0);

      const settings = getSettings();
      let extensionMetadataFile = Gio.File.new_for_path(
        settings.get_string("extension-metadata-path")
      );
      let uuid = extensionMetadataFile.get_parent().get_basename();
      let extensionExists = extensionMetadataFile.query_exists(null);

      if (!extensionExists) {
        uuid = "Please select a valid metadata.json file on the preferences";
      }

      let icon = new St.Icon({
        icon_name: "view-refresh-symbolic",
        style_class: "system-status-icon",
      });

      this.add_child(icon);

      // Extension Label
      let extensionMenuItem = new PopupMenu.PopupMenuItem(uuid, {
        reactive: false,
      });
      this.menu.addMenuItem(extensionMenuItem);

      // Reload Extension
      let reloadButton = new PopupMenu.PopupMenuItem("Reload Extension!");
      this.menu.addMenuItem(reloadButton);
      reloadButton.connect("activate", () => {
        deleteAllVersionsOfExtension(uuid);
        installEphimeralExtension(uuid);
      });

      // Clean ephimeral Extensions
      let deleteButton = new PopupMenu.PopupMenuItem(
        "Delete Ephimeral Versions"
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
      let prefButton = new PopupMenu.PopupMenuItem("Preferences");
      this.menu.addMenuItem(prefButton);
      prefButton.connect("activate", () => {
        ExtensionUtils.openPrefs();
      });

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // Subscribe to changes in prefs
      settings.connect(`changed::extension-metadata-path`, () => {
        extensionMetadataFile = Gio.File.new_for_path(
          settings.get_string("extension-metadata-path")
        );
        uuid = extensionMetadataFile.get_parent().get_basename();
        extensionExists = extensionMetadataFile.query_exists(null);

        extensionMenuItem.label.set_text(
          extensionMetadataFile.get_parent().get_basename()
        );
        deleteButton.reactive = extensionExists;
        reloadButton.reactive = extensionExists;
      });
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
  myPopup.destroy();
}
