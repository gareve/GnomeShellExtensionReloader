const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const USER_INSTALLATION_PATH = GLib.build_filenamev([
  GLib.get_user_data_dir(),
  "gnome-shell",
  "extensions",
]);

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

var HelloWorldSettings = GObject.registerClass(
  { GTypeName: "Gjs_HelloWorldSettings" + Date.now() },
  class HelloWorldSettings extends Gtk.ListBox {
    _init(params) {
      super._init(params);
      const settings = getSettings();

      this.connect("row-activated", (widget, row) => {
        this._rowActivated(widget, row);
      });

      this.append(
        new Gtk.Label({
          label:
            "File path of your extension's metadata. It should be outside the installation path",
          halign: Gtk.Align.START,
          hexpand: true,
        })
      );

      const logoPicker = new Gtk.Button({
        label: settings.get_string("extension-metadata-path"),
      });
      this.append(logoPicker);

      const fileChooser = new Gtk.FileChooserNative({
        title: "Select an Image",
        action: Gtk.FileChooserAction.OPEN,
        modal: false,
      });

      const filter = new Gtk.FileFilter();
      filter.set_name("Extension Metadata");
      filter.add_pattern("metadata.json");
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
          const new_path = dlg.get_file().get_path();
          const is_invalid_path = new_path.startsWith(USER_INSTALLATION_PATH);

          if (is_invalid_path) {
            errorMessage.set_markup(
              `<span foreground="red">
                  <span> <b>ERROR: Extension path should be outside the local extension installation path</b></span>
                  <span><tt>Selected File Path : ${new_path} </tt></span>
                  <span><tt>User extension Path: ${USER_INSTALLATION_PATH}</tt></span>
                </span>`
            );
          } else {
            logoPicker.label = new_path;
            settings.set_string("extension-metadata-path", new_path);
          }
        }
        dlg.hide();
      });

      logoPicker.connect("clicked", () => {
        fileChooser.transient_for = this.get_root();
        fileChooser.show();
      });
    }
  }
);

// eslint-disable-next-line no-unused-vars
function init() {}

// eslint-disable-next-line no-unused-vars
function buildPrefsWidget() {
  return new HelloWorldSettings();
}
