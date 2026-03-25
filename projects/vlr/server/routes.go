package main

import (
	"net/http"
	"os"
	"shiznatix/vlr/ctrls"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

type routes struct {
	baseRoute    *mux.Router
	apiRoute     *mux.Router
	pubFilesPath string
	Context      ctrls.Context
}

func (r routes) handler() http.Handler {
	r.browseRoutes(r.apiRoute.PathPrefix("/browse").Subrouter())
	r.playlistRoutes(r.apiRoute.PathPrefix("/playlist").Subrouter())
	r.showsRoutes(r.apiRoute.PathPrefix("/shows").Subrouter())
	r.randomRoutes(r.apiRoute.PathPrefix("/random").Subrouter())
	r.labelsRoutes(r.apiRoute.PathPrefix("/labels").Subrouter())
	r.playerCmdRoutes(r.apiRoute.PathPrefix("/player").Subrouter())
	r.audioTrackRoutes(r.apiRoute.PathPrefix("/audio").Subrouter())
	r.subtitlesRoutes(r.apiRoute.PathPrefix("/subtitles").Subrouter())
	r.downloadsRoutes(r.apiRoute.PathPrefix("/downloads").Subrouter())
	r.filesystemEpisodes(r.apiRoute.PathPrefix("/filesystem-episodes").Subrouter())
	r.missingEpisodesRoutes(r.apiRoute.PathPrefix("/missing-episodes").Subrouter())
	r.filesRoutes(r.apiRoute.PathPrefix("/files").Subrouter())
	r.statusRoutes(r.apiRoute.PathPrefix("/status").Subrouter())
	r.logsRoutes(r.apiRoute.PathPrefix("/logs").Subrouter())
	r.tvCmdRoutes(r.apiRoute.PathPrefix("/tv").Subrouter())
	r.databaseRoutes(r.apiRoute.PathPrefix("/databases").Subrouter())
	r.databaseSyncRoutes(r.apiRoute.PathPrefix("/database-sync").Subrouter())
	r.systemCmdRoutes(r.apiRoute.PathPrefix("/system").Subrouter())

	r.staticRoutes()

	logR := handlers.LoggingHandler(os.Stdout, r.baseRoute)

	return logR
}

func (r routes) staticRoutes() {
	r.baseRoute.PathPrefix("/").Handler(http.FileServer(http.Dir(r.pubFilesPath)))
}

func (r routes) browseRoutes(rtr *mux.Router) {
	pathCtrl := ctrls.BrowsePath{Context: r.Context}
	pathR := rtr.Methods("POST").Subrouter()
	pathR.HandleFunc("/path", pathCtrl.Handle)
	pathR.Use(pathCtrl.InitCtx)
	pathR.Use(pathCtrl.Validate)

	lablesCtrl := ctrls.BrowseLabels{Context: r.Context}
	lablesR := rtr.Methods("POST").Subrouter()
	lablesR.HandleFunc("/labels", lablesCtrl.Handle)
	lablesR.Use(lablesCtrl.InitCtx)
	lablesR.Use(lablesCtrl.Validate)

	seasonCtrl := ctrls.BrowseSeason{Context: r.Context}
	seasonR := rtr.Methods("POST").Subrouter()
	seasonR.HandleFunc("/season", seasonCtrl.Handle).Methods("POST")
	seasonR.Use(seasonCtrl.InitCtx)
	seasonR.Use(seasonCtrl.Validate)
}

func (r routes) playlistRoutes(rtr *mux.Router) {
	setCtrl := ctrls.PlaylistSet{Context: r.Context}
	setR := rtr.Methods("POST").Subrouter()
	setR.HandleFunc("", setCtrl.Handle)
	setR.Use(setCtrl.InitCtx)
	setR.Use(setCtrl.Validate)

	getCtrl := ctrls.PlaylistGet{
		Context: r.Context,
	}
	getR := rtr.Methods("GET").Subrouter()
	getR.HandleFunc("", getCtrl.Handle)

	playAtCtrl := ctrls.PlaylistIndexAction{Context: r.Context}
	playAtR := rtr.PathPrefix("/play-at").Methods("PUT").Subrouter()
	playAtR.HandleFunc("", playAtCtrl.Handle(r.Context.VLC.Play))
	playAtR.Use(playAtCtrl.InitCtx())
	playAtR.Use(playAtCtrl.Validate)

	removeAtCtrl := ctrls.PlaylistIndexAction{Context: r.Context}
	removeAtR := rtr.PathPrefix("/remove-at").Methods("DELETE").Subrouter()
	removeAtR.HandleFunc("", removeAtCtrl.Handle(r.Context.VLC.Delete))
	removeAtR.Use(removeAtCtrl.InitCtx())
	removeAtR.Use(removeAtCtrl.Validate)

	moveCtrl := ctrls.PlaylistMove{Context: r.Context}
	moveR := rtr.PathPrefix("/{direction:(?:previous|next)}").Methods("PUT").Subrouter()
	moveR.HandleFunc("", moveCtrl.Handle)
	moveR.Use(moveCtrl.Validate)
}

func (r routes) showsRoutes(rtr *mux.Router) {
	ctrl := ctrls.Shows{Context: r.Context}
	rtr.HandleFunc("", ctrl.Handle).Methods("GET")
}

func (r routes) labelsRoutes(rtr *mux.Router) {
	ctrl := ctrls.Labels{Context: r.Context}
	rtr.HandleFunc("", ctrl.Handle).Methods("POST")
	rtr.Use(ctrl.InitCtx)
	rtr.Use(ctrl.Validate)
}

func (r routes) randomRoutes(rtr *mux.Router) {
	ctrl := ctrls.Random{Context: r.Context}
	rtr.HandleFunc("", ctrl.Handle).Methods("POST")
	rtr.Use(ctrl.InitCtx)
	rtr.Use(ctrl.Validate)
}

func (r routes) playerCmdRoutes(rtr *mux.Router) {
	ctrl := ctrls.PlayerCmd{Context: r.Context}
	rtr.HandleFunc("", ctrl.Handle).Methods("PUT")
	rtr.Use(ctrl.InitCtx())
	rtr.Use(ctrl.Validate)
}

func (r routes) tvCmdRoutes(rtr *mux.Router) {
	ctrl := ctrls.TvCmd{Context: r.Context}
	rtr.HandleFunc("", ctrl.Handle).Methods("PUT")
	rtr.Use(ctrl.InitCtx())
	rtr.Use(ctrl.Validate)
}

func (r routes) audioTrackRoutes(rtr *mux.Router) {
	setCtrl := ctrls.AudioSet{Context: r.Context}
	setR := rtr.Methods("PUT").Subrouter()
	setR.HandleFunc("", setCtrl.Handle)
	setR.Use(setCtrl.InitCtx())
	setR.Use(setCtrl.Validate)
}

func (r routes) subtitlesRoutes(rtr *mux.Router) {
	setCtrl := ctrls.SubtitlesSet{Context: r.Context}
	setR := rtr.Methods("PUT").Subrouter()
	setR.HandleFunc("", setCtrl.Handle)
	setR.Use(setCtrl.InitCtx())
	setR.Use(setCtrl.Validate)

	delaySetCtrl := ctrls.SubtitlesDelaySet{Context: r.Context}
	delaySetR := rtr.Methods("PUT").Subrouter()
	delaySetR.HandleFunc("/delay", delaySetCtrl.Handle)
	delaySetR.Use(delaySetCtrl.InitCtx())
}

func (r routes) downloadsRoutes(rtr *mux.Router) {
	allCtrl := ctrls.DownloadsGet{Context: r.Context}
	allR := rtr.Methods("GET").Subrouter()
	allR.HandleFunc("", allCtrl.Handle)

	selectCtrl := ctrls.DownloadSelect{Context: r.Context}
	selectR := rtr.Methods("PUT").Subrouter()
	selectR.HandleFunc("/select", selectCtrl.Handle)
	selectR.Use(selectCtrl.InitCtx)
	selectR.Use(selectCtrl.Validate)

	dlActionCtrl := ctrls.DownloadAction{Context: r.Context}
	dlActionR := rtr.Methods("POST").Subrouter()
	dlActionR.HandleFunc("/action", dlActionCtrl.Handle)
	dlActionR.Use(dlActionCtrl.InitCtx)
}

func (r routes) filesystemEpisodes(rtr *mux.Router) {
	ctrl := ctrls.FilesystemEpisodes{Context: r.Context}
	fR := rtr.Methods("GET").Subrouter()
	fR.HandleFunc("", ctrl.Handle)
}

func (r routes) missingEpisodesRoutes(rtr *mux.Router) {
	getCtrl := ctrls.MissingEpisodes{Context: r.Context}
	getR := rtr.Methods("GET").Subrouter()
	getR.HandleFunc("", getCtrl.Handle)

	ignoreCtrl := ctrls.MissingEpisodesIgnore{Context: r.Context}
	ignoreR := rtr.Methods("PUT").Subrouter()
	ignoreR.HandleFunc("/ignore", ignoreCtrl.Handle)
	ignoreR.Use(ignoreCtrl.InitCtx)
	ignoreR.Use(ignoreCtrl.Validate)
}

func (r routes) filesRoutes(rtr *mux.Router) {
	setXAttrCtrl := ctrls.FilesSetXAttr{Context: r.Context}
	setXAttrR := rtr.Methods("POST").Subrouter()
	setXAttrR.HandleFunc("/set-xattr", setXAttrCtrl.Handle)
	setXAttrR.Use(setXAttrCtrl.InitCtx)
	setXAttrR.Use(setXAttrCtrl.Validate)
}

func (r routes) statusRoutes(rtr *mux.Router) {
	ctrl := ctrls.Status{Context: r.Context}
	sR := rtr.Methods("GET").Subrouter()
	sR.HandleFunc("", ctrl.Handle)
}

func (r routes) logsRoutes(rtr *mux.Router) {
	ctrl := ctrls.Logs{Context: r.Context}
	sR := rtr.Methods("GET").Subrouter()
	sR.HandleFunc("", ctrl.Handle)
}

func (r routes) databaseRoutes(rtr *mux.Router) {
	ctrl := ctrls.Databases{Context: r.Context}
	dbR := rtr.PathPrefix("/{database}").Methods("GET").Subrouter()
	dbR.HandleFunc("", ctrl.Handle)
	dbR.Use(ctrl.Validate)
}

func (r routes) databaseSyncRoutes(rtr *mux.Router) {
	ctrl := ctrls.DatabaseSync{Context: r.Context}
	sR := rtr.Methods("POST").Subrouter()
	sR.HandleFunc("", ctrl.Handle)
	sR.Use(ctrl.InitCtx)
	sR.Use(ctrl.Validate)
}

func (r routes) systemCmdRoutes(rtr *mux.Router) {
	ctrl := ctrls.SystemCmd{Context: r.Context}
	rtr.HandleFunc("", ctrl.Handle).Methods("PUT")
	rtr.Use(ctrl.InitCtx())
	rtr.Use(ctrl.Validate)
}
