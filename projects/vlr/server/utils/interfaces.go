package utils

type logger interface {
	Info(msg string)
	Infof(msg string, arg ...any)
	Error(msg string)
	Errorf(msg string, arg ...any)
	Err(err error, msg string, arg ...any)
	Debug(msg string)
	Debugf(msg string, arg ...any)
}
