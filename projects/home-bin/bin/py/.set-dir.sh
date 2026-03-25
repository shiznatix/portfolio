#!/bin/bash

set -e

_check_dirs=(
	"."
	"server"
	"pkg/*"
	"python/libs/*"
)
project_dir=$(basename "$PWD")

# managing the `redhouse-platform` automatically is tricky, just manage it manually
# if [ "$project_dir" = "redhouse-platform" ]; then
# 	echo -e "\e[2;35m! Special Python 'redhouse-platform' project found\e[0m" >&2
# 	cd python/libs/rhpy
# 	return 0
# fi

_quiet=false
for _arg in "$@"; do
	[[ "$_arg" == "--quiet" ]] && _quiet=true
done

for check_dir in "${_check_dirs[@]}"; do
	path="${check_dir}/src/*.py"
	mapfile -t matches < <(compgen -G "$path" || true)
	count=${#matches[@]}
	if [ "$count" -gt 0 ]; then
		first_match_dir="$(dirname "${matches[0]}")"
		py_dir="$(dirname "${first_match_dir}")"
		[[ "$_quiet" == false ]] && echo -e "\e[2;32m+ Python '${project_dir}' workspace found at '${py_dir}' ($count files)\e[0m"
		cd "$py_dir"
		return 0
	fi
done

[[ "$_quiet" == false ]] && echo -e "\e[2;31m- No Python '${project_dir}' files found\e[0m" >&2
return 1
