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

function runMyShell(cmd) {
  log(">>>>>> RUNNING CMD: " + cmd);
  let [, stdout, stderr, status] = GLib.spawn_command_line_sync(cmd);
  log(">>>>>> STDOUT: " + stdout);
  log(">>>>>> STDERR: " + stderr);
  log(">>>>>> STATUS: " + status);
}

function deleteAllVersionsOfExtension(uuid) {
  const allUuids = Main.extensionManager.getUuids();

  for (let i_uuid of allUuids) {
    if (!i_uuid.startsWith(uuid)) {
      log(">>>> Ignoring extension removal: " + i_uuid);
      continue;
    }

    let extension = Main.extensionManager.lookup(i_uuid);
    if (extension.type !== ExtensionType.PER_USER) {
      continue;
    }

    if (extension) {
      Main.notify("Deleting Extension", i_uuid);
      Main.extensionManager.unloadExtension(extension);
      runMyShell(
        "rm -rf /home/gareve/.local/share/gnome-shell/extensions/" + i_uuid
      );
    }
  }
}

function installEphimeralExtension(uuid) {
  // based on https://stackoverflow.com/questions/62265594/gnome-shell-extension-install-possible-without-restart
  let manager = Main.extensionManager;
  const nowTimestamp = Date.now();
  const ephUUID = uuid + "_eph_" + nowTimestamp;
  const newDir = "/home/gareve/.local/share/gnome-shell/extensions/" + ephUUID;

  log(">>>> Reinstall Extension " + ephUUID);

  let dir = Gio.File.new_for_path(
    GLib.build_filenamev([global.userdatadir, "extensions", ephUUID])
  );

  const cmd =
    "cp -r /home/gareve/Dropbox/Programacion/gnomeShell/" + uuid + " " + newDir;
  runMyShell(cmd);

  // Modifying metadata.json
  // TODO: Error handling
  let metadataFile = dir.get_child("metadata.json");
  let metadataContents, success_;

  [success_, metadataContents] = metadataFile.load_contents(null);
  metadataContents = ByteArray.toString(metadataContents);
  let meta = JSON.parse(metadataContents);
  log(metadataContents);
  meta.uuid = ephUUID;
  meta.name += " eph_" + nowTimestamp;
  let [success, tag] = metadataFile.replace_contents(
    JSON.stringify(meta),
    null,
    false,
    Gio.FileCreateFlags.REPLACE_DESTINATION,
    null
  );

  let extension = manager.createExtensionObject(
    ephUUID,
    dir,
    ExtensionUtils.ExtensionType.PER_USER
  );

  try {
    manager.loadExtension(extension);
    // Link folder to dir with new uuid! to cheat importer
    if (!manager.enableExtension(ephUUID))
      throw new Error(
        "Cannot add %s to enabled extensions gsettings key".format(ephUUID)
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
      const uuid = Gio.File.new_for_path(settings.get_string("extension-path"))
        .get_parent()
        .get_basename();

      let icon = new St.Icon({
        icon_name: "view-refresh-symbolic", // /usr/share/icons
        //   gicon : Gio.icon_new_for_string( Me.dir.get_path() + '/icon.svg' ),
        style_class: "system-status-icon",
      });

      this.add_child(icon);

      // install extension
      let reload = new PopupMenu.PopupMenuItem("Reload Extension!");
      this.menu.addMenuItem(reload);

      reload.connect("activate", () => {
        deleteAllVersionsOfExtension(uuid);
        installEphimeralExtension(uuid);
      });

      // Preferences Button
      let prefButton = new PopupMenu.PopupMenuItem("Preferences");
      this.menu.addMenuItem(prefButton);
      prefButton.connect("activate", () => {
        ExtensionUtils.openPrefs();
      });

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // Extension Name
      let extensionMenuItem = new PopupMenu.PopupMenuItem(
        Gio.File.new_for_path(settings.get_string("extension-path"))
          .get_parent()
          .get_basename(),
        { reactive: false, activate: false, hover: false, can_focus: false }
      );
      this.menu.addMenuItem(extensionMenuItem);
      settings.connect(`changed::extension-path`, () => {
        extensionMenuItem.label.set_text(
          Gio.File.new_for_path(settings.get_string("extension-path"))
            .get_parent()
            .get_basename()
        );
      });
    }
  }
);

function init() {}

function enable() {
  myPopup = new MyPopup();
  Main.panel.addToStatusArea("ReloadExtensionPopup", myPopup, 1);
}

function disable() {
  myPopup.destroy();
}
