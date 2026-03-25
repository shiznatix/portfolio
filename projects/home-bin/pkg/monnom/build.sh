#!/bin/bash

set -e

# Parse flags
clean=false
deps=false

for arg in "$@"; do
    case "$arg" in
        --clean)
            clean=true
			deps=true # if clean, also update deps
            ;;
        --deps)
            deps=true
            ;;
    esac
done

echo "Starting build with options: clean=$clean, deps=$deps"

source "$(dirname "${BASH_SOURCE[0]}")/.inc.sh"

if [ "$clean" = true ]; then
	clean
fi
create_venv_if_missing
if [ "$deps" = true ]; then
	update_build_deps
	install_runtime_deps
fi
build

delete_binary
copy_binary
delete_symlink
create_symlink

echo "✓ Build and installation complete"
