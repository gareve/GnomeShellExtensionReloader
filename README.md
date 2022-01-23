# GnomeShellExtensionReloader
A one-click reload of Gnome Shell Extensions on Wayland

# Demo Video
https://user-images.githubusercontent.com/1031137/150702536-c16847f3-1478-404c-b370-2edda0671bdd.mp4

# Why do we need this extension?

There's no default clean & fast way to reload Gnome Shell extensions on Wayland. This extension tries to workaround certain design decisions in favour of our development speed. The two official ways to reload an extension are:
- Logout and login again. This is slow & you lose all your open windows.
- Start a wayland window on nested mode. Faster, but do you know what's faster? a one-click reload :)

# How does it work?

GnomeShellExtensionReloader does the following:
- Uninstall the target extension
- Installs again the target extension but it changes the extension's `uuid` & `name` to a new one (I like to call this ephimeral extension)
  - This is necessary, because Gnome Shell caches the library code, so we need to trick Gnome that a new extension was installed.
- Enable new ephimeral target extension!

# Usage Instructions
1) Select the metadata.json file from the extension you're developing. Make sure this extension is outside of Gnome's installation path (Usually $HOME/.local/share/gnome-shell/extensions. Anyway, the extension will throw an error if this happens)
2) Reload your extension by clicking on the GnomeShellExtensionReloader tray icon (as seen on above video) OR you can use the key shortcut `CTRL + SUPER + R  `

# Do I need to modify my Gnome Extension so it can work with GnomeShellExtensionReloader?
Unfortunately yes, but is a small change.
- Everytime you use GObject.registerClass on prefs.js, you will need to provide a unique name(current timestamp works) to the class.
e.g.
```
# OLD VERSION
const HelloWorldSettings = GObject.registerClass(  
  class HelloWorldSettings extends Gtk.ListBox {
  ...
  });
  
# PLEASE CHANGE TO THE FOLLOWING
var HelloWorldSettings = GObject.registerClass(
  { GTypeName: "Gjs_HelloWorldSettings" + Date.now() },
  class HelloWorldSettings extends Gtk.ListBox {
  ...
  });
```

If you don't make this change, you will get the following error:
```
Error: Type name Gjs_HelloWorldSettings is already registered
```
