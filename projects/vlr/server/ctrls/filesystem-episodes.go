package ctrls

import (
	"net/http"
)

type FilesystemEpisodes struct {
	Context
}

func (ctrl FilesystemEpisodes) Handle(w http.ResponseWriter, r *http.Request) {
	ctrl.respond(w, 200, ctrl.FSEps.DB)
}
