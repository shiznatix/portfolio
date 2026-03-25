#!/bin/bash

PARENT_PID=$$
LOG_PREFIX="[ffmpeg.sh]($MTX_PATH)|$PARENT_PID|"
echo "${LOG_PREFIX} START"

./publisher_state_change.sh start

MTX_USER="$(id -un 2>/dev/null || whoami 2>/dev/null)"
if [ -z "$MTX_USER" ]; then
	echo "cannot find current user" >&2
	exit 1
fi
TMP_DIR="/dev/shm/$MTX_PATH"

if [ -d "$TMP_DIR" ]; then
	echo "${LOG_PREFIX} TMP_DIR already exists: $TMP_DIR"
fi

sudo rm -rf $TMP_DIR
sudo mkdir -p $TMP_DIR
sudo chown "$MTX_USER":"$MTX_USER" $TMP_DIR

PROGRESS_PIPE="$TMP_DIR/ffmpeg_progress"
LAST_FRAME_TIME_FILE="$TMP_DIR/ffmpeg_last_frame_time"
LAST_FRAME_REPEAT_FILE="$TMP_DIR/ffmpeg_last_frame_repeat"
NO_FRAMES_TIMEOUT=30 # default timeout in seconds

for arg in "$@"; do
	case "$arg" in
		--timeout=*)
			NO_FRAMES_TIMEOUT="${arg#--timeout=}"
			;;
	esac
done

mkfifo $PROGRESS_PIPE
echo "${LOG_PREFIX} INIT pipe=$PROGRESS_PIPE timeout=${NO_FRAMES_TIMEOUT}sec"

COMMAND_FILE="$(dirname "$0")/$1"
if [ ! -f "$COMMAND_FILE" ]; then
	echo "${LOG_PREFIX} Command file not found: $COMMAND_FILE"
	exit 1
fi

echo $(date +%s) > "$LAST_FRAME_TIME_FILE"
echo "0" > "$LAST_FRAME_REPEAT_FILE"
LAST_FRAME=""
LAST_LOG_TIME=$(date +%s)

FFMPEG_STDERR_FILE="$TMP_DIR/ffmpeg_stderr.log"
FFREPORT="file=$FFMPEG_STDERR_FILE:level=32"
touch "$FFMPEG_STDERR_FILE"

export PROGRESS_PIPE
export PARENT_PID
export FFREPORT
setsid bash "$COMMAND_FILE" &
STREAM_PID=$!
STREAM_PGID=$(ps -o pgid= $STREAM_PID | grep -o '[0-9]*')
STREAM_PID=$!

# watch the stream process to ensure it is not a zombie or exited
(while true; do
	sleep 1
	stream_proc_dead=0
	stream_proc_dead_reason=""
	now=$(date +%s)
	last_frame_time=$(cat "$LAST_FRAME_TIME_FILE" 2>/dev/null || echo "0")
	last_frame_repeat=$(cat "$LAST_FRAME_REPEAT_FILE" 2>/dev/null || echo "0")

	# check for zombie (defunct) state
	if [ -e /proc/$STREAM_PID ]; then
		state=$(awk '{print $3}' /proc/$STREAM_PID/stat)
		if [ "$state" = "Z" ]; then
			stream_proc_dead=1
			stream_proc_dead_reason="zombie"
		fi
	fi
	# check if process is still running
	if ! kill -0 $STREAM_PID 2>/dev/null; then
		stream_proc_dead=1
		stream_proc_dead_reason="exited"
	fi
	# check if no frames received in X seconds
	if [ $((now - last_frame_time)) -gt "$NO_FRAMES_TIMEOUT" ]; then
		stream_proc_dead=1
		stream_proc_dead_reason="frames stalled (>$NO_FRAMES_TIMEOUT sec)"
	fi
	# check if same frame received 100 times
	if [ "$last_frame_repeat" -ge 100 ]; then
		stream_proc_dead=1
		stream_proc_dead_reason="frame-repeating"
	fi

	if [ "$stream_proc_dead" -eq 1 ]; then
		echo "${LOG_PREFIX} EXIT: STREAM_PID $STREAM_PID $stream_proc_dead_reason"
		./publisher_state_change.sh failed "$stream_proc_dead_reason"
		kill -TERM $$ 2>/dev/null
		exit 1
	fi
done) &
WATCHDOG_PID=$!

cleanup() {
	[ "$_cleanup_done" = "1" ] && return
    _cleanup_done=1
	echo "${LOG_PREFIX} STOPPED"

	if [ -n "$STREAM_PGID" ]; then
		kill -TERM -"$STREAM_PGID" 2>/dev/null
		echo "${LOG_PREFIX} KILLED STREAM_PGID $STREAM_PGID"
	fi
	if [ -n "$STREAM_PID" ]; then
		kill -TERM $STREAM_PID 2>/dev/null
		echo "${LOG_PREFIX} KILLED STREAM_PID $STREAM_PID"
	fi
	if [ -n "$WATCHDOG_PID" ]; then
		kill -TERM $WATCHDOG_PID 2>/dev/null
		echo "${LOG_PREFIX} KILLED WATCHDOG_PID $WATCHDOG_PID"
	fi
	if [ -n "$PROGRESS_PIPE" ]; then
		rm -f $PROGRESS_PIPE
		echo "${LOG_PREFIX} RM PROGRESS_PIPE $PROGRESS_PIPE"
	fi
	if [ -n "$LAST_FRAME_TIME_FILE" ]; then
		rm -f "$LAST_FRAME_TIME_FILE"
		echo "${LOG_PREFIX} RM LAST_FRAME_TIME_FILE $LAST_FRAME_TIME_FILE"
	fi
	if [ -n "$LAST_FRAME_REPEAT_FILE" ]; then
		rm -f "$LAST_FRAME_REPEAT_FILE"
		echo "${LOG_PREFIX} RM LAST_FRAME_REPEAT_FILE $LAST_FRAME_REPEAT_FILE"
	fi

	last_ffmpeg_err=$(tail -n 1 "$FFMPEG_STDERR_FILE")

	if [ -n "$TMP_DIR" ]; then
		rm -rf $TMP_DIR
		echo "${LOG_PREFIX} RM TMP_DIR $TMP_DIR"
	fi

	./publisher_state_change.sh stop "$last_ffmpeg_err"

	echo "${LOG_PREFIX} EXIT"
}
trap 'cleanup; exit 0' EXIT INT TERM

echo "${LOG_PREFIX} STARTED stream_pid:$STREAM_PID watchdog_pid:$WATCHDOG_PID"

# Open the FIFO for both reading and writing to prevent blocking
while read -r line; do
	last_frame_time=$(cat "$LAST_FRAME_TIME_FILE" 2>/dev/null || echo "0")
	last_frame_repeat=$(cat "$LAST_FRAME_REPEAT_FILE" 2>/dev/null || echo "0")

	case "$line" in
		frame=* )
			cur_frame=$(echo "$line" | cut -d"=" -f2)

			if [ "$cur_frame" = "$LAST_FRAME" ]; then
				last_frame_repeat=$((last_frame_repeat + 1))
			else
				last_frame_repeat=0
				LAST_FRAME="$cur_frame"
			fi
			echo "$(date +%s)" > "$LAST_FRAME_TIME_FILE"
			echo "$last_frame_repeat" > "$LAST_FRAME_REPEAT_FILE"
			;;
	esac

	now=$(date +%s)
	if [ $((now - LAST_LOG_TIME)) -ge 10 ]; then
		echo "${LOG_PREFIX} LAST_TIME: $(date -d @$last_frame_time +%H:%M:%S), LAST_FRAME: $LAST_FRAME, REPEAT: $last_frame_repeat"
		LAST_LOG_TIME=$now
	fi
done < $PROGRESS_PIPE

exit 0
