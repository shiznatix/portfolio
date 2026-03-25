package main

import (
	"context"
	"net/http"
	"shiznatix/vlr/config"
	"shiznatix/vlr/ctrls"
	"shiznatix/vlr/fseps"
	"shiznatix/vlr/fslabels"
	"shiznatix/vlr/hdmicec"
	"shiznatix/vlr/imdbeps"
	"shiznatix/vlr/missingeps"
	"shiznatix/vlr/systm"
	"shiznatix/vlr/transmission"
	"shiznatix/vlr/utils"
	"shiznatix/vlr/vlc"
	"time"

	"github.com/gorilla/mux"
)

type server struct {
	ctx          context.Context
	cancel       context.CancelFunc
	vlc          vlc.VLC
	fseps        fseps.FileSystemEpisodes
	fslabels     fslabels.FileSystemLabels
	missingeps   missingeps.MissingEpisodes
	imdbeps      imdbeps.IMDBEpisodes
	transmission transmission.Remote
	hdmicec      hdmicec.HDMICEC
	systm        systm.System
	masterServer utils.MasterServer
}

func (s server) serve() (err error) {
	log.Infof("server port:%s masterServer:%s", config.Config.Port, s.masterServer)

	rtr := mux.NewRouter()
	rs := routes{
		baseRoute:    rtr,
		apiRoute:     rtr.PathPrefix("/api/").Subrouter(),
		pubFilesPath: config.Config.ClientPath,
		Context: ctrls.Context{
			VLC:                s.vlc,
			FSEps:              s.fseps,
			FSLabels:           s.fslabels,
			MissingEps:         s.missingeps,
			IMDBEps:            s.imdbeps,
			TransmissionRemote: s.transmission,
			HDMICEC:            s.hdmicec,
			System:             s.systm,
			MasterServer:       s.masterServer,
		},
	}
	srv := &http.Server{
		Addr:         ":" + config.Config.Port,
		Handler:      rs.handler(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		if err = srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Err(err, "failed on server listening")
			s.cancel()
		}
	}()

	log.Info("server started")
	<-s.ctx.Done()
	log.Info("server stopped")

	ctxShutDown, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer func() {
		cancel()
	}()

	if err = srv.Shutdown(ctxShutDown); err != nil {
		log.Err(err, "server shutdown failed")
		return err
	}

	log.Info("server exited properly")

	if err == http.ErrServerClosed {
		err = nil
	}

	return err
}
