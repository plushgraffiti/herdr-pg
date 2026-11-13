#!/bin/sh
# Copies these mods into Herdr's home (~/.config/herdr-app, or $HERDR_APP_HOME).
# Herdr reloads a mod when its files change. The PG layout, which shows
# pg-statusbar, is added where there is none; one already there is never replaced.
# pg-statusbar draws pg-usage inside its own bar, and a mod can't import from another
# mod's folder, so it gets its own copy of pg-usage as mods/pg-statusbar/usage/.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
home="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
mods="$home/mods"
[ -d "$mods" ] || { echo "No Herdr mods folder at $mods" >&2; exit 1; }
rsync -a "$here/pg-usage/mods/pg-usage/" "$mods/pg-usage/"
rsync -a "$here/pg-statusbar/mods/pg-statusbar/" "$mods/pg-statusbar/"
rsync -a --delete --exclude mod.json "$here/pg-usage/mods/pg-usage/" "$mods/pg-statusbar/usage/"
# auto-title keeps its folder name: its service.js and its service both use it.
rsync -a "$here/auto-title/mods/auto-title/" "$mods/auto-title/"
echo "Installed pg-usage, pg-statusbar and auto-title into $mods"

# The layout. Herdr writes theme picks and sizes elsewhere (layouts/.state), so
# the file only differs from this one after an edit, and an edited one is kept.
layout="$home/layouts/PG.json"
if [ ! -e "$layout" ]; then
	mkdir -p "$home/layouts"
	cp "$here/PG/layouts/PG.json" "$layout"
	echo "Added the PG layout"
	herdr-app do layout.switch --name PG >/dev/null 2>&1 ||
		echo "With Herdr open, show it with: herdr-app do layout.switch --name PG"
elif ! cmp -s "$here/PG/layouts/PG.json" "$layout"; then
	echo "Kept $layout, which differs from this repo's; delete it and run this again to replace it"
fi

# Auto Title's settings. ~/.config is read on every OS, and its service does not
# see a shell's XDG_CONFIG_HOME. A file already there is yours and is kept.
config="$HOME/.config/herdr-auto-title/config.env"
if [ ! -e "$config" ]; then
	mkdir -p "$(dirname "$config")"
	cp "$here/auto-title/config.env" "$config"
	echo "Wrote $config"
fi

# The mod is only the installer of Auto Title's service. Until that is installed,
# open its popup, where Install downloads the binary and has it start at login.
# The paths are where `desktop install` keeps its copy on macOS and on Linux.
open="herdr-app do mod.open --name auto-title"
for copy in \
	"$HOME/Library/Application Support/herdr-auto-title/bin/herdr-auto-title" \
	"${XDG_DATA_HOME:-$HOME/.local/share}/herdr-auto-title/herdr-auto-title"; do
	[ -x "$copy" ] && exit 0
done
# mod.open closes a popup that is open, so one already shown is left alone.
if herdr-app status 2>/dev/null | grep -q '"auto-title"'; then
	exit 0
fi
# Herdr needs a moment to see a mod folder that was only just copied.
for _ in 1 2 3 4 5; do
	if $open >/dev/null 2>&1; then
		echo "Auto Title is not installed yet: press Install in the popup Herdr just opened."
		exit 0
	fi
	sleep 1
done
echo "Auto Title is not installed yet. With Herdr open, run: $open"
