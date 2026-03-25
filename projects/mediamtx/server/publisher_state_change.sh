#!/bin/bash

STATE="$1"
REASON="$2"
LOGFILE="/tmp/mediamtx_${MTX_PATH}_state.log"

if [[ -n "$REASON" ]]; then
	REASON=" - $REASON"
fi

echo "$(date) - ${STATE}${REASON}" >> "$LOGFILE"
