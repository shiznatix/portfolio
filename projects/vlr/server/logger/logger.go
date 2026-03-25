package logger

import (
	"fmt"
	"shiznatix/vlr/colors"
	"sync"
)

var Loggers = Collection{}
var lock = sync.Mutex{}

type level string

const (
	lvlInfo  level = "I"
	lvlError level = "E"
	lvlDebug level = "D"
)

type Collection map[string]Logger

func (l Collection) RecentMessages(count int) map[string]RecentLogs {
	logs := map[string]RecentLogs{}

	for k, v := range l {
		logs[k] = v.RecentLogs(count)
	}

	return logs
}

type RecentLogs struct {
	Info    []string `json:"info"`
	Error   []string `json:"error"`
	Debug   []string `json:"debug"`
	Verbose []string `json:"verbose"`
}

type Logger struct {
	name        string
	color       colors.Color
	errorMsgs   Queue
	infoMsgs    Queue
	debugMsgs   Queue
	verboseMsgs Queue
}

func Get(name string, color colors.Color) Logger {
	lock.Lock()
	defer lock.Unlock()

	if l, ok := Loggers[name]; ok {
		return l
	}

	Loggers[name] = Logger{
		name:        name,
		color:       color,
		errorMsgs:   NewQueue(),
		infoMsgs:    NewQueue(),
		debugMsgs:   NewQueue(),
		verboseMsgs: NewQueue(),
	}

	return Loggers[name]
}

func (l Logger) log(lvl level, q Queue, msg string) {
	lvlColor := colors.LevelUnknownColor
	if lvl == lvlInfo {
		lvlColor = colors.LevelInfoColor
	} else if lvl == lvlError {
		lvlColor = colors.LevelErrorColor
	} else if lvl == lvlDebug {
		lvlColor = colors.LevelDebugColor
	}

	fmt.Println("[" + string(lvlColor) + string(lvl) + string(colors.Reset) + "] [" + string(l.color) + l.name + string(colors.Reset) + "] " + msg)
	q.Append(msg)
}

func (l Logger) Info(msg string) {
	l.log(lvlInfo, l.infoMsgs, msg)
}

func (l Logger) Infof(msg string, arg ...any) {
	l.Info(fmt.Sprintf(msg, arg...))
}

func (l Logger) Error(msg string) {
	l.log(lvlError, l.errorMsgs, msg)
}

func (l Logger) Errorf(msg string, arg ...any) {
	l.Error(fmt.Sprintf(msg, arg...))
}

func (l Logger) Err(err error, msg string, arg ...any) {
	vals := append([]any{}, arg...)
	vals = append(vals, err.Error())
	l.Error(fmt.Sprintf(msg+" err:'%s'", vals...))
}

func (l Logger) Debug(msg string) {
	l.log(lvlDebug, l.debugMsgs, msg)
}

func (l Logger) Debugf(msg string, arg ...any) {
	l.Debug(fmt.Sprintf(msg, arg...))
}

func (l Logger) Verbose(msg string) {
	l.verboseMsgs.Append(msg)
}

func (l Logger) Verbosef(msg string, arg ...any) {
	l.Verbose(fmt.Sprintf(msg, arg...))
}

func (l Logger) RecentLogs(count int) RecentLogs {
	i := l.infoMsgs.Latest(count, true)
	e := l.errorMsgs.Latest(count, true)
	d := l.debugMsgs.Latest(count, true)

	return RecentLogs{
		Info:  i,
		Error: e,
		Debug: d,
	}
}
