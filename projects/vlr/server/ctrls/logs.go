package ctrls

import (
	"net/http"
	"shiznatix/vlr/logger"
)

type Logs struct {
	Context
}

func (ctrl Logs) Handle(w http.ResponseWriter, r *http.Request) {
	ctrl.respond(w, 200, logger.Loggers.RecentMessages(20))
}
