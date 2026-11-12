#!/bin/sh
# Copies these mods into Herdr's home (~/.config/herdr-app, or $HERDR_APP_HOME).
# Herdr reloads a mod when its files change. Layouts are not touched.
# pg-statusbar draws pg-usage inside its own bar, and a mod can't import from another
# mod's folder, so it gets its own copy of pg-usage as mods/pg-statusbar/usage/.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
mods="${HERDR_APP_HOME:-$HOME/.config/herdr-app}/mods"
[ -d "$mods" ] || { echo "No Herdr mods folder at $mods" >&2; exit 1; }
rsync -a "$here/pg-usage/mods/pg-usage/" "$mods/pg-usage/"
rsync -a "$here/pg-statusbar/mods/pg-statusbar/" "$mods/pg-statusbar/"
rsync -a --delete --exclude mod.json "$here/pg-usage/mods/pg-usage/" "$mods/pg-statusbar/usage/"
echo "Installed pg-usage and pg-statusbar into $mods"
