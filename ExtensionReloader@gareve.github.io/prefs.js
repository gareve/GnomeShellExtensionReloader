const { GObject, Gtk, GLib } = imports.gi;
const ByteArray = imports.byteArray;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Utils, SCHEMA_PATH_KEY } = Me.imports.utils;

const USER_INSTALLATION_PATH = GLib.build_filenamev([
  GLib.get_user_data_dir(),
  "gnome-shell",
  "extensions",
]);

const HelloWorldSettings = GObject.registerClass(
  { GTypeName: "Gjs_HelloWorldSettings" },
  class HelloWorldSettings extends Gtk.ListBox {
    _init(params) {
      super._init(params);
      const settings = ExtensionUtils.getSettings(
        "org.gnome.shell.extensions.ExtensionReloader"
      );
      Utils.log("Opening preferences");

      const extensionWebsite = Me.metadata.url;
      this.append(
        new Gtk.Label({
          useMarkup: true,
          label: `<b>Source Code and additional Documentation on: 
            <a href='${extensionWebsite}'>${extensionWebsite}</a>
          </b>`,
        })
      );

      this.append(
        new Gtk.Label({
          label:
            "File path of your extension's metadata. It should be outside the installation path",
          halign: Gtk.Align.START,
          hexpand: true,
        })
      );

      const logoPicker = new Gtk.Button({
        label: settings.get_string(SCHEMA_PATH_KEY),
      });
      this.append(logoPicker);

      const fileChooser = new Gtk.FileChooserNative({
        title: "Select an Image",
        action: Gtk.FileChooserAction.OPEN,
        modal: false,
      });

      const filter = new Gtk.FileFilter();
      filter.set_name("Extension Metadata");
      filter.add_pattern("metadata.json"); // Simpler way to pick a valid extension
      fileChooser.add_filter(filter);

      const errorMessage = new Gtk.Label({
        useMarkup: true,
        label: "",
        halign: Gtk.Align.START,
        hexpand: true,
      });
      this.append(errorMessage);

      // Verify folder contains an actual extension
      fileChooser.connect("response", (dlg, response) => {
        errorMessage.set_markup("");
        if (response === Gtk.ResponseType.ACCEPT) {
          const newPath = dlg.get_file().get_path();
          const isInvalidPath = newPath.startsWith(USER_INSTALLATION_PATH);

          if (isInvalidPath) {
            errorMessage.set_markup(
              `<span foreground="red">
                  <span> <b>ERROR: Extension path should be outside the local extension installation path</b></span>
                  <span> <b>SETTING WAS NOT SAVED</b></span>
                  <span><tt>Selected File Path : ${newPath} </tt></span>
                  <span><tt>User extension Path: ${USER_INSTALLATION_PATH}</tt></span>
                </span>`
            );
            Utils.log(
              `Selected path(${newPath}) is inside installation path(${USER_INSTALLATION_PATH})`
            );
          } else {
            logoPicker.label = newPath;
            settings.set_string(SCHEMA_PATH_KEY, newPath);
            Utils.log(`New Extension selected: ${newPath}`);
          }
        }
        dlg.hide();
      });

      logoPicker.connect("clicked", () => {
        fileChooser.transient_for = this.get_root();
        fileChooser.show();
      });

      this.append(
        new Gtk.Label({
          useMarkup: true,
          label: "<b>Latest Extension Logs</b>",
          halign: Gtk.Align.START,
          hexpand: true,
        })
      );
      const scrolledwindow = new Gtk.ScrolledWindow({
        min_content_height: 500,
      });
      scrolledwindow.set_policy(
        Gtk.PolicyType.AUTOMATIC,
        Gtk.PolicyType.AUTOMATIC
      );
      this.append(scrolledwindow);

      // Logview
      const logView = new Gtk.TextView({
        editable: false,
        monospace: true,
      });

      scrolledwindow.set_child(logView);

      const logViewBuffer = logView.get_buffer();
      let [, stdout] = GLib.spawn_sync(
        null,
        [
          "/bin/bash",
          "-c",
          'journalctl --since "120 minutes ago" --output=cat --no-pager | grep "_EXTENSION_RELOADER_"',
        ],
        null,
        GLib.SpawnFlags.SEARCH_PATH,
        null
      );
      logViewBuffer.set_text(ByteArray.toString(stdout), -1);
    }
  }
);

// eslint-disable-next-line no-unused-vars
function init() {}

// eslint-disable-next-line no-unused-vars
function buildPrefsWidget() {
  return new HelloWorldSettings();
}
