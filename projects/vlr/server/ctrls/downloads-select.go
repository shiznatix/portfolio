package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
	"shiznatix/vlr/utils"
)

type downloadSelectCtxKey struct{}
type downloadSelectCtx struct {
	EpisodeID  utils.DBKey `json:"episodeId"`
	TorrentID  utils.DBKey `json:"torrentId"`
	MagnetLink string
}

type DownloadSelect struct {
	Context
}

func (ctrl DownloadSelect) getCtx(r *http.Request) *downloadSelectCtx {
	return r.Context().Value(downloadSelectCtxKey{}).(*downloadSelectCtx)
}

func (ctrl DownloadSelect) InitCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := &downloadSelectCtx{}
		decoder := json.NewDecoder(r.Body)
		err := decoder.Decode(ctx)

		if err != nil {
			ctrl.genericErr(w, "body is required", err)
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), downloadSelectCtxKey{}, ctx)))
	})
}

func (ctrl DownloadSelect) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)
		ep, ok := ctrl.MissingEps.ForKey(ctx.EpisodeID)
		if !ok {
			ctrl.genericErr(w, "failed to find missing episode for episodeID:"+ctx.EpisodeID.String(), nil)
			return
		}

		t, ok := ep.Torrent(ctx.TorrentID)
		if !ok {
			ctrl.genericErr(w, "failed to find torrent for episodeId:"+ctx.EpisodeID.String()+" torrentId:"+ctx.TorrentID.String(), nil)
			return
		}

		ctx.MagnetLink = t.MagnetLink

		next.ServeHTTP(w, r)
	})
}

func (ctrl DownloadSelect) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)

	tID, err := ctrl.MasterServer.ForwardRequest(r, ctx, func() (interface{}, error) {
		return ctrl.TransmissionRemote.Add(ctx.MagnetLink)
	})
	if err != nil {
		ctrl.genericErr(w, "failed adding link to transmission remote", err)
		return
	}

	if err := ctrl.MissingEps.SelectTorrent(ctx.EpisodeID, ctx.TorrentID, tID.(string)); err != nil {
		ctrl.genericErr(w, "failed to select missing episode torrentId:"+ctx.TorrentID.String(), err)
		return
	}

	ctrl.respond(w, 200, tID)
}
