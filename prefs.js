const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;
const Gio = imports.gi.Gio;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

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
            "File path of your extension's metadata. Should be outside the installation path",
          halign: Gtk.Align.START,
          hexpand: true,
        })
      );

      const logoPicker = new Gtk.Button({
        label: settings.get_string("extension-path"),
      });
      const fileChooser = new Gtk.FileChooserNative({
        title: "Select an Image",
        action: Gtk.FileChooserAction.OPEN,
        modal: false,
      });

      const filter = new Gtk.FileFilter();
      filter.set_name("Extension Metadata");
      filter.add_pattern("metadata.json");
      fileChooser.add_filter(filter);

      // Verify folder contains an actual extension
      fileChooser.connect("response", (dlg, response) => {
        if (response === Gtk.ResponseType.ACCEPT) {
          const new_path = dlg.get_file().get_path();
          logoPicker.label = new_path;
          settings.set_string("extension-path", new_path);
        }
        dlg.hide();
      });

      logoPicker.connect("clicked", () => {
        fileChooser.transient_for = this.get_root();
        fileChooser.show();
      });
      this.append(logoPicker);
    }
  }
);

function init() {}

function buildPrefsWidget() {
  return new HelloWorldSettings();
}
