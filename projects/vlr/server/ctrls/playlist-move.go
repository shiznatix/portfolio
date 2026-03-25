package ctrls

import (
	"net/http"

	"github.com/gorilla/mux"
)

type PlaylistMove struct {
	Context
}

func (ctrl PlaylistMove) getDirection(r *http.Request) string {
	return mux.Vars(r)["direction"]
}

func (ctrl PlaylistMove) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		direction := ctrl.getDirection(r)

		if direction != "previous" && direction != "next" {
			ctrl.validationErr(w, map[string]string{
				"direction": "direction must be 'previous' or 'next'",
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (ctrl PlaylistMove) Handle(w http.ResponseWriter, r *http.Request) {
	direction := ctrl.getDirection(r)

	if direction == "previous" {
		if err := ctrl.VLC.Previous(); err != nil {
			ctrl.genericErr(w, "failed to go backwards in playlist", err)
			return
		}
	} else if direction == "next" {
		if err := ctrl.VLC.Next(); err != nil {
			ctrl.genericErr(w, "failed to go forwards in playlist", err)
			return
		}
	}

	ctrl.respond(w, 200, true)
}
