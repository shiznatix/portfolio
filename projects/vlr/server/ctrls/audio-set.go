package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
	"shiznatix/vlr/vlc"
)

type audioSetCtxKey struct{}
type audioSetCtx struct {
	ID          int `json:"id"`
	AudioTracks []vlc.AudioTrack
}

type AudioSet struct {
	Context
}

func (ctrl AudioSet) getCtx(r *http.Request) *audioSetCtx {
	return r.Context().Value(audioSetCtxKey{}).(*audioSetCtx)
}

func (ctrl AudioSet) InitCtx() func(n http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := &audioSetCtx{}
			decoder := json.NewDecoder(r.Body)
			err := decoder.Decode(ctx)

			if err != nil {
				ctrl.genericErr(w, "body is required", err)
				return
			}

			s, err := ctrl.VLC.Status()
			if err != nil {
				ctrl.genericErr(w, "failed to get audio tracks", err)
				return
			}

			ctx.AudioTracks = s.AudioTracks

			next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), audioSetCtxKey{}, ctx)))
		})
	}
}

func (ctrl AudioSet) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)

		if ctx.ID == -1 {
			next.ServeHTTP(w, r)
			return
		}

		for _, sub := range ctx.AudioTracks {
			if sub.ID == ctx.ID {
				next.ServeHTTP(w, r)
				return
			}
		}

		ctrl.validationErr(w, map[string]string{
			"track": "selected audio track was not found",
		})
	})
}

func (ctrl AudioSet) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)

	if err := ctrl.VLC.SetAudioTrack(ctx.ID); err != nil {
		ctrl.genericErr(w, "failed to set audio track", err)
		return
	}

	ctrl.respond(w, 200, true)
}
