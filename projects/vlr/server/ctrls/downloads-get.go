package ctrls

import (
	"net/http"
)

type DownloadsGet struct {
	Context
}

func (ctrl DownloadsGet) Handle(w http.ResponseWriter, r *http.Request) {
	list, err := ctrl.TransmissionRemote.List()
	if err != nil {
		ctrl.genericErr(w, "failed fetching the transmission list", err)
		return
	}

	ctrl.respond(w, 200, list)
}
