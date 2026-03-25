#!/bin/bash

source /var/lib/home-bin/.env
DEBUG=false
script_dir="/var/lib/home-bin/bin"

comp_1=$(cd "$script_dir" && find . -maxdepth 1 -type d ! -name '.' -exec basename {} \; | tr '\n' ' ' | sed 's/ $//')

[[ "$DEBUG" = true ]] && echo "comp_1: $comp_1"

# Create comp_2_* variables for each directory
_comp_2() {
	var_name="comp_2_${dir}"
	files=$(cd "$script_dir/$dir" && find . -maxdepth 1 \( -type f -o -type l \) -not -name '.*' -not -name '*.txt' -exec basename {} \; | tr '\n' ' ' | sed 's/ $//')
	eval "${var_name}=\"${files}\""
	[[ "$DEBUG" = true ]] && echo "$var_name: $(eval echo \$${var_name})"
}
if [ -n "$ZSH_VERSION" ]; then for dir in ${=comp_1}; do _comp_2; done
else for dir in $comp_1; do _comp_2; done
fi

# Helper function: Complete from word list
_homebin_complete_words() {
	local word_list="$1"
	local cur="$2"
	local -a words
	words=($(compgen -W "$word_list" -- "$cur"))
	COMPREPLY=()
	for word in "${words[@]}"; do
		COMPREPLY+=("$word ")
	done
}

# Helper function: Parse completion output from command --completion
_homebin_parse_completion() {
	local completion_output="$1"
	local cur="$2"

	COMPREPLY=()
	while IFS= read -r line; do
		if [[ "$line" == flag:* ]]; then
			# Flag completion - add space
			local flag=${line#flag:}
			COMPREPLY+=("$flag ")
		elif [[ "$line" == word:* ]]; then
			# Word completion - add space
			local word=${line#word:}
			COMPREPLY+=("$word ")
		elif [[ "$line" == dir:* ]]; then
			# Directory completion
			local pattern=${line#dir:}
			if [ -z "$pattern" ]; then
				pattern="*"
			fi

			if [ -n "$ZSH_VERSION" ]; then
				local search_cur=${cur//\\ / }
				setopt localoptions nullglob
				local -a matches
				eval "matches=(\"${search_cur}\"${pattern})"
				for file in "${matches[@]}"; do
					[ -d "$file" ] && COMPREPLY+=("${file}/")
				done
			else
				compopt -o nospace -o filenames
				local IFS=$'\n'
				local items=($(compgen -d -- "${cur}${pattern}"))
				for item in "${items[@]}"; do
					COMPREPLY+=("$item")
				done
			fi
		elif [[ "$line" == file:* ]]; then
			# File completion with optional extension filter
			local spec=${line#file:}
			local ext_filter=""

			if [[ "$spec" == *.* ]]; then
				ext_filter=".${spec#*.}"
			fi

			if [ -n "$ZSH_VERSION" ]; then
				local search_cur=${cur//\\ / }
				setopt localoptions nullglob
				local -a matches
				eval "matches=(\"${search_cur}\"*)"
				for file in "${matches[@]}"; do
					if [ -d "$file" ]; then
						COMPREPLY+=("${file}/")
					elif [ -z "$ext_filter" ] || [[ "$file" == *"$ext_filter" ]]; then
						COMPREPLY+=("$file")
					fi
				done
			else
				compopt -o nospace -o filenames
				local IFS=$'\n'
				local items=($(compgen -f -- "$cur"))
				for item in "${items[@]}"; do
					if [ -d "$item" ] || [ -z "$ext_filter" ] || [[ "$item" == *"$ext_filter" ]]; then
						COMPREPLY+=("$item")
					fi
				done
			fi
		elif [[ "$line" == exec:* ]]; then
			local exec_cmd=${line#exec:}

			if [ -z "$exec_cmd" ]; then
				# No command specified: complete executables from PATH or at typed path
				if [[ "$cur" == */* ]]; then
					if [ -n "$ZSH_VERSION" ]; then
						local search_cur=${cur//\\ / }
						setopt localoptions nullglob
						local -a matches
						eval "matches=(\"${search_cur}\"*)"
						for file in "${matches[@]}"; do
							if [ -d "$file" ]; then
								COMPREPLY+=("${file}/")
							elif [ -x "$file" ]; then
								COMPREPLY+=("$file ")
							fi
						done
					else
						compopt -o nospace -o filenames
						local IFS=$'\n'
						local items=($(compgen -f -- "$cur"))
						for item in "${items[@]}"; do
							if [ -d "$item" ] || [ -x "$item" ]; then
								COMPREPLY+=("$item")
							fi
						done
					fi
				else
					if [ -n "$ZSH_VERSION" ]; then
						local -a cmds
						cmds=(${(k)commands[(I)${cur}*]})
						for cmd in "${cmds[@]}"; do
							COMPREPLY+=("$cmd ")
						done
					else
						local IFS=$'\n'
						local -a cmds
						cmds=($(compgen -c -- "$cur"))
						for cmd in "${cmds[@]}"; do
							COMPREPLY+=("$cmd ")
						done
					fi
				fi
			else
				# TODO - finish this, use `qq gpu prime-run firefox -`
				echo ">>>$exec_cmd<<<" > /tmp/homebin_debug
				# [[ "$DEBUG" = true ]] && echo ">>>$exec_cmd<<<" > /tmp/homebin_debug
				# Command specified: use compgen with the registered complete spec,
				# stripping any -F/-C/-G options that would execute something
				local comp_spec comp_opts
				comp_spec=$(complete -p "$exec_cmd" 2>/dev/null)
				if [ -n "$comp_spec" ]; then
					# Remove 'complete', any -F func, -C cmd, -G glob, and the trailing command name
					comp_opts=$(echo "$comp_spec" \
						| sed 's/^complete//' \
						| sed 's/-F [^ ]*//g' \
						| sed 's/-C [^ ]*//g' \
						| sed "s/[[:space:]]${exec_cmd}\$//" \
						| xargs)
				fi

				local IFS=$'\n'
				local -a items
				if [ -n "$comp_opts" ]; then
					items=($(eval compgen $comp_opts -- '"$cur"' 2>/dev/null))
				else
					# No usable spec: fall back to file completion
					compopt -o nospace -o filenames 2>/dev/null
					items=($(compgen -f -- "$cur"))
				fi

				for item in "${items[@]}"; do
					[ -d "$item" ] && COMPREPLY+=("${item}/") || COMPREPLY+=("$item ")
				done
			fi
		fi
	done <<< "$completion_output"
}

# Universal completion function generator
_create_homebin_completion() {
	local alias_name="$1"
	local preset_group="$2"
	local preset_cmd="$3"

	# Dynamic completion by calling command --completion
	local dynamic_completion="
		local comp_index=0
		local start_idx=0

		# Determine where arguments start based on preset level
		if [ -z \"$preset_group\" ]; then
			start_idx=3
			comp_index=\$((COMP_CWORD - 3))
		elif [ -z \"$preset_cmd\" ]; then
			start_idx=2
			comp_index=\$((COMP_CWORD - 2))
		else
			start_idx=1
			comp_index=\$((COMP_CWORD - 1))
		fi

		# Only run completion if we're past the command itself
		if [ \$COMP_CWORD -ge \$start_idx ]; then
			local -a comp_cmd=()

			# Add all words up to (but not including) the current word
			for ((i=0; i<\$COMP_CWORD; i++)); do
				comp_cmd+=(\"\${COMP_WORDS[i]}\")
			done
			comp_cmd+=(\"--completion\")
			comp_cmd+=(\"\$cur\")

			local completion_output
			completion_output=\$(\"\${comp_cmd[@]}\" 2>/dev/null)

			[ -n \"\$completion_output\" ] && _homebin_parse_completion \"\$completion_output\" \"\$cur\"
		fi
	"

	# Build completion logic based on preset level
	local comp_logic
	if [ -z "$preset_group" ]; then
		# Level 0: No preset - full homebin completion
		comp_logic="
			if [ \$COMP_CWORD -eq 1 ]; then
				_homebin_complete_words \"$comp_1\" \"\$cur\"
			elif [ \$COMP_CWORD -eq 2 ]; then
				local group=\"\${COMP_WORDS[1]}\"
				local var_name=\"comp_2_\${group}\"
				local word_list=\$(eval echo \\\$\${var_name})
				_homebin_complete_words \"\$word_list\" \"\$cur\"
			else
				$dynamic_completion
			fi
		"
	elif [ -z "$preset_cmd" ]; then
		# Level 1: Preset group - show comp_2 and dynamic completion
		comp_logic="
			if [ \$COMP_CWORD -eq 1 ]; then
				local var_name=\"comp_2_${preset_group}\"
				local word_list=\$(eval echo \\\$\${var_name})
				_homebin_complete_words \"\$word_list\" \"\$cur\"
			else
				$dynamic_completion
			fi
		"
	else
		# Level 2: Preset group and command - show dynamic completion
		comp_logic="
			$dynamic_completion
		"
	fi

	eval "_${alias_name}_completion() {
		local cur=\"\${COMP_WORDS[COMP_CWORD]}\"
		$comp_logic
	}"

	complete -o nospace -F _${alias_name}_completion "$alias_name"
}

_create_homebin_completion "$MMHB_CMD"

# Process MMHB_ALIASES and create completions
if [ -n "$MMHB_ALIASES" ]; then
	_alias_entry() {
		# Skip empty entries
		[[ -z "$alias_entry" ]] && continue

		# Split on pipe to get alias_name and command_parts
		alias_name="${alias_entry%%|*}"
		command_parts="${alias_entry#*|}"

		# If no pipe found or command_parts equals alias_name, skip
		[[ "$command_parts" == "$alias_name" ]] && continue

		[[ "$DEBUG" = true ]] && echo "Processing: alias_name='$alias_name' command_parts='$command_parts'"

		if [ -z "$command_parts" ]; then
			# Level 0: qq| (no command - full homebin completion)
			_create_homebin_completion "$alias_name"
		elif [[ ! "$command_parts" =~ _ ]]; then
			# Level 1: qgit|git (just group)
			_create_homebin_completion "$alias_name" "$command_parts"
		else
			# Level 2: nscan|net_scan (group_cmd)
			group="${command_parts%%_*}"
			cmd="${command_parts#*_}"
			_create_homebin_completion "$alias_name" "$group" "$cmd"
		fi
	}
	if [ -n "$ZSH_VERSION" ]; then for alias_entry in ${=MMHB_ALIASES}; do _alias_entry; done
	else for alias_entry in $MMHB_ALIASES; do _alias_entry; done
	fi
fi
