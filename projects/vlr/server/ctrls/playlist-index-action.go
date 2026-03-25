package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
	"shiznatix/vlr/vlc"
)

type playlistIndexActionCtxKey struct{}
type playlistIndexActionCtx struct {
	Index    int `json:"index"`
	Playlist []vlc.PlaylistItem
}

type PlaylistIndexAction struct {
	Context
}

func (ctrl PlaylistIndexAction) getCtx(r *http.Request) *playlistIndexActionCtx {
	return r.Context().Value(playlistIndexActionCtxKey{}).(*playlistIndexActionCtx)
}

func (ctrl PlaylistIndexAction) InitCtx() func(n http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := &playlistIndexActionCtx{}
			decoder := json.NewDecoder(r.Body)
			err := decoder.Decode(ctx)

			if err != nil {
				ctrl.genericErr(w, "body is required", err)
				return
			}

			pl, err := ctrl.VLC.Playlist()
			if err != nil {
				ctrl.genericErr(w, "failed to get current playlist", err)
			}

			ctx.Playlist = pl

			next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), playlistIndexActionCtxKey{}, ctx)))
		})
	}
}

func (ctrl PlaylistIndexAction) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)
		plLen := len(ctx.Playlist)
		if plLen < 1 || plLen-1 < ctx.Index {
			ctrl.validationErr(w, map[string]string{
				"index": "playlist length must be within range",
			})
			return
		}

		for i := range ctx.Playlist {
			if ctx.Index == i {
				next.ServeHTTP(w, r)
				return
			}
		}

		ctrl.genericErr(w, "failed to find playlist item at index", nil)
	})
}

func (ctrl PlaylistIndexAction) Handle(vlcFunc func(id int) error) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)

		for i, item := range ctx.Playlist {
			if i == ctx.Index {
				if err := vlcFunc(item.ID); err != nil {
					ctrl.genericErr(w, "failed to do playlist index action", err)
					return
				}
			}
		}

		ctrl.respond(w, 200, true)
	}
}
