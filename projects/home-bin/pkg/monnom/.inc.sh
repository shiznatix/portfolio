#!/bin/bash

set -e

APP_NAME="monnom"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPS_DIR="$(cd "$SCRIPT_DIR/../../apps" && pwd)"
BIN_DIR="$(cd "$SCRIPT_DIR/../../bin/sys" && pwd)"

BINARY="$APPS_DIR/$APP_NAME"
SYMLINK="$BIN_DIR/$APP_NAME"
VENV_DIR="$SCRIPT_DIR/venv"
PIP="$VENV_DIR/bin/pip"
PYINSTALLER="$VENV_DIR/bin/pyinstaller"
REQ_BUILD="$SCRIPT_DIR/requirements-build.txt"
REQ_RUNTIME="$SCRIPT_DIR/requirements.txt"
SPEC_FILE="$SCRIPT_DIR/$APP_NAME.spec"

cd "$SCRIPT_DIR"

# cleanup files
clean() {
	rm -rf "$SCRIPT_DIR/build" "$SCRIPT_DIR/dist" "$SCRIPT_DIR/venv" "$SCRIPT_DIR/__pycache__"
	delete_symlink
}
export -f clean
delete_binary() {
    echo "Delete binary file..."
	rm -f "$BINARY"
}
export -f delete_binary
delete_symlink() {
	if [ -L "$SYMLINK" ]; then
		echo "Removing symlink..."
		rm "$SYMLINK"
	fi
}
export -f delete_symlink

# venv
create_venv_if_missing() {
	if [ ! -d "$VENV_DIR" ]; then
		create_venv
	fi
}
export -f create_venv_if_missing
create_venv() {
	echo "Creating virtual environment..."
	python3 -m venv "$VENV_DIR"
}
export -f create_venv

# pip deps
update_build_deps() {
	echo "Upgrading pip..."
	"$PIP" install --upgrade pip
	echo "Installing build dependencies..."
	"$PIP" install -r "$REQ_BUILD"
}
export -f update_build_deps
install_runtime_deps() {
	if [ -f "$REQ_RUNTIME" ] && [ -s "$REQ_RUNTIME" ]; then
		echo "Installing runtime dependencies..."
		"$PIP" install -r "$REQ_RUNTIME"
	fi
}
export -f install_runtime_deps

# build
build() {
	echo "Building binary..."
	rm -rf "$SCRIPT_DIR/build" "$SCRIPT_DIR/dist"
	"$PYINSTALLER" --clean "$SPEC_FILE"
}
export -f build

# install
copy_binary() {
    echo "Copying binary to $APPS_DIR..."
	cp "$SCRIPT_DIR/dist/$APP_NAME" "$APPS_DIR/$APP_NAME"
	chmod +x "$APPS_DIR/$APP_NAME"
}
export -f copy_binary
create_symlink() {
	echo "Creating symlink: $SYMLINK -> $BINARY"
	ln -s "$BINARY" "$SYMLINK"
}
export -f create_symlink
