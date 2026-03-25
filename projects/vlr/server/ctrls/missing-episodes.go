package ctrls

import (
	"net/http"
)

type MissingEpisodes struct {
	Context
}

func (ctrl MissingEpisodes) Handle(w http.ResponseWriter, r *http.Request) {
	ctrl.respond(w, 200, ctrl.MissingEps.DB)
}
