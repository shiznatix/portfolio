package ctrls

import (
	"encoding/json"
	"net/http"
	"shiznatix/vlr/colors"
	"shiznatix/vlr/fseps"
	"shiznatix/vlr/fslabels"
	"shiznatix/vlr/hdmicec"
	"shiznatix/vlr/imdbeps"
	"shiznatix/vlr/logger"
	"shiznatix/vlr/missingeps"
	"shiznatix/vlr/systm"
	"shiznatix/vlr/transmission"
	"shiznatix/vlr/utils"
	"shiznatix/vlr/vlc"
	"shiznatix/vlr/xattr"
)

var log = logger.Get("ctrls", colors.LoggerControllersColor)

type Context struct {
	VLC                vlc.VLC
	FSEps              fseps.FileSystemEpisodes
	FSLabels           fslabels.FileSystemLabels
	MissingEps         missingeps.MissingEpisodes
	IMDBEps            imdbeps.IMDBEpisodes
	HDMICEC            hdmicec.HDMICEC
	TransmissionRemote transmission.Remote
	System             systm.System
	MasterServer       utils.MasterServer
}

type resBody struct {
	Data interface{} `json:"data"`
}

type resValidErr struct {
	Fields map[string]string `json:"fields"`
}

type genericErr struct {
	Error string `json:"error"`
}

func (c Context) validationErr(w http.ResponseWriter, f map[string]string) {
	log.Errorf("API validation error: %T", f)
	c.respond(w, http.StatusUnprocessableEntity, resValidErr{Fields: f})
}

func (c Context) genericErr(w http.ResponseWriter, e string, err error) {
	if err == nil {
		log.Errorf("API generic error:'%s'", e)
	} else {
		log.Err(err, "API generic error:'%s'", e)
	}

	c.respond(w, http.StatusInternalServerError, genericErr{Error: e})
}

func (c Context) respond(w http.ResponseWriter, code int, o interface{}) {
	w.Header().Set("Content-Type", "application/json")
	b, err := json.Marshal(resBody{
		Data: o,
	})
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
	} else {
		w.WriteHeader(code)
		if _, err := w.Write(b); err != nil {
			log.Err(err, "failed to send response")
		}
	}
}

func (c Context) setXATTR(path string, f func(xattr.File) error) error {
	var res error
	xr := xattr.New(path)

	if err := f(xr); err != nil {
		res = err
	}

	// ignore the errors here, we don't really care if this fails...
	c.FSEps.StorePath(path)
	c.FSLabels.StorePath(path)

	return res
}
