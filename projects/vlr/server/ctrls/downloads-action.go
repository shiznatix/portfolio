package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
)

type downloadActionCtxKey struct{}
type downloadActionCtx struct {
	ID     string `json:"id"`
	Action string `json:"action"`
}

type DownloadAction struct {
	Context
}

func (ctrl DownloadAction) getCtx(r *http.Request) *downloadActionCtx {
	return r.Context().Value(downloadActionCtxKey{}).(*downloadActionCtx)
}

func (ctrl DownloadAction) InitCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := &downloadActionCtx{}
		decoder := json.NewDecoder(r.Body)
		err := decoder.Decode(ctx)

		if err != nil {
			ctrl.genericErr(w, "body is required", err)
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), downloadActionCtxKey{}, ctx)))
	})
}

func (ctrl DownloadAction) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)

		if ctx.Action != "delete" && ctx.Action != "start" && ctx.Action != "pause" {
			ctrl.validationErr(w, map[string]string{
				"action": "must be 'delete', 'start', or 'pause'",
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (ctrl DownloadAction) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)

	switch ctx.Action {
	case "delete":
		_, err := ctrl.MasterServer.ForwardRequest(r, ctx, func() (interface{}, error) {
			err := ctrl.TransmissionRemote.Remove(ctx.ID)
			return nil, err
		})
		if err != nil {
			ctrl.genericErr(w, "failed removing download from transmission remote", err)
			return
		}

		if err := ctrl.MissingEps.UnselectTorrent(ctx.ID); err != nil {
			ctrl.genericErr(w, "failed unselecting torrent from missing episodes", err)
			return
		}
	case "start":
		if err := ctrl.TransmissionRemote.Start(ctx.ID); err != nil {
			ctrl.genericErr(w, "failed starting transmission download", err)
			return
		}
	case "pause":
		if err := ctrl.TransmissionRemote.Stop(ctx.ID); err != nil {
			ctrl.genericErr(w, "failed stopping transmission download", err)
			return
		}
	}

	ctrl.respond(w, 200, true)
}
