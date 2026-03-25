package ctrls

import (
	"net/http"
	"shiznatix/vlr/hdmicec"
	"shiznatix/vlr/vlc"
)

type statusResponse struct {
	VLCStatus vlc.Status     `json:"vlc"`
	TVStatus  hdmicec.Status `json:"tv"`
}

type Status struct {
	Context
}

func (ctrl Status) Handle(w http.ResponseWriter, r *http.Request) {
	vlcStatus, err := ctrl.VLC.Status()
	if err != nil {
		log.Err(err, "failed getting vlc status")
	}

	cecStatus, err := ctrl.HDMICEC.Status()
	if err != nil {
		log.Err(err, "failed getting hdmi-cec status")
	}

	ctrl.respond(w, 200, statusResponse{
		VLCStatus: vlcStatus,
		TVStatus:  cecStatus,
	})
}
