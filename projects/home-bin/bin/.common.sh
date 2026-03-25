#!/bin/bash

mmhb_restore_terminal() {
    tput cnorm 2>/dev/null || true
    stty echo 2>/dev/null || true
}

mmhb_handle_signal_exit() {
    mmhb_restore_terminal
    exit 1
}

_mmhb_chain_trap() {
    local signal="$1"
    local new_cmd="$2"
    local existing
    existing=$(trap -p "$signal" | awk -F"'" '{print $2}')

    if [ -n "$existing" ]; then
        trap "$existing; $new_cmd" "$signal"
    else
        trap "$new_cmd" "$signal"
    fi
}

if [ -z "${MMHB_TERMINAL_TRAP_INSTALLED:-}" ]; then
    _mmhb_chain_trap EXIT "mmhb_restore_terminal"
    _mmhb_chain_trap INT "mmhb_handle_signal_exit"
    _mmhb_chain_trap TERM "mmhb_handle_signal_exit"
    MMHB_TERMINAL_TRAP_INSTALLED=1
fi

confirm_prompt() {
    local prompt="$1"
    local default="${2:-Y}"
    local response
    local display_prompt

    if [ "$default" = "Y" ]; then
        display_prompt="${prompt} [Y/n] "
    else
        display_prompt="${prompt} [y/N] "
    fi

    if [ -n "$ZSH_VERSION" ]; then
        read -r "?${display_prompt}" response
    else
        read -rp "${display_prompt}" response
    fi

    # Empty response uses default
    if [ -z "$response" ]; then
        response="$default"
    fi

    # Return 0 for yes, 1 for no
    if [[ "$response" == "y" || "$response" == "Y" ]]; then
        return 0
    else
        return 1
    fi
}

array_no_empty() {
    local -n arr=$1
    arr=( $(printf '%s\n' "${arr[@]}" | grep -v '^$' || true) )
}

select_option() {
    local prompt="$1"
    shift
    local options=("$@")
    local selected=0
    local count=${#options[@]}

    tput civis

    _draw() {
        echo "$prompt"
        for i in "${!options[@]}"; do
            if [ "$i" -eq "$selected" ]; then
                echo -e "  \e[1;32m> ${options[$i]}\e[0m"
            else
                echo -e "    ${options[$i]}"
            fi
        done
    }

    _draw
    while true; do
        IFS= read -rsn1 key
        if [[ "$key" == $'\x1b' ]]; then
            read -rsn2 -t 0.1 key2
            key+="$key2"
        fi
        case "$key" in
            $'\x1b[A') (( selected > 0 )) && (( selected-- )) ;;
            $'\x1b[B') (( selected < count - 1 )) && (( selected++ )) ;;
            '') break ;;
        esac
        tput cuu $(( count + 1 ))
        _draw
    done

    tput cnorm
    tput cuu $(( count + 1 ))
    tput ed

    SELECTED_INDEX=$selected
}

multi_select_option() {
    local prompt="$1"
    shift
    local options=("$@")
    local selected=()
    local count=${#options[@]}
    local cursor=0

    tput civis

    _draw_multi() {
        if [ "$1" = "first" ]; then
            echo "$prompt"
        fi
        for i in "${!options[@]}"; do
            local mark=" "
            for sel in "${selected[@]}"; do
                if [ "$sel" -eq "$i" ]; then
                    mark="✔"
                    break
                fi
            done
            if [ "$i" -eq "$cursor" ]; then
                echo -e "  \e[1;32m> [$mark] ${options[$i]}\e[0m"
            else
                echo -e "    [$mark] ${options[$i]}"
            fi
        done
        echo -e "\nSpace: select/deselect, Enter: confirm"
    }

    _draw_multi first
    while true; do
        IFS= read -rsn1 key
        if [[ "$key" == $'\x1b' ]]; then
            read -rsn2 -t 0.1 key2
            key+="$key2"
        fi
        case "$key" in
            $'\x1b[A') (( cursor > 0 )) && (( cursor-- )) ;;
            $'\x1b[B') (( cursor < count - 1 )) && (( cursor++ )) ;;
            ' ') # Space toggles selection
                local found=false
                for idx in "${!selected[@]}"; do
                    if [ "${selected[$idx]}" -eq "$cursor" ]; then
                        unset selected[$idx]
                        selected=("${selected[@]}")
                        found=true
                        break
                    fi
                done
                if ! $found; then
                    selected+=("$cursor")
                fi
                ;;
            '') break ;;
        esac
        tput cuu $(( count + 2 ))
        tput ed
        _draw_multi
    done

    tput cnorm
    tput cuu $(( count + 2 ))
    tput ed

    local result=()
    for idx in "${selected[@]}"; do
        result+=("${options[$idx]}")
    done
    INSTALL_DEPS=("${result[@]}")
}
