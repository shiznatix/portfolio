package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
	"shiznatix/vlr/vlc"
)

type subtitlesSetCtxKey struct{}
type subtitlesSetCtx struct {
	ID             int `json:"id"`
	SubtitleTracks []vlc.SubtitleTrack
}

type SubtitlesSet struct {
	Context
}

func (ctrl SubtitlesSet) getCtx(r *http.Request) *subtitlesSetCtx {
	return r.Context().Value(subtitlesSetCtxKey{}).(*subtitlesSetCtx)
}

func (ctrl SubtitlesSet) InitCtx() func(n http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := &subtitlesSetCtx{}
			decoder := json.NewDecoder(r.Body)
			err := decoder.Decode(ctx)

			if err != nil {
				ctrl.genericErr(w, "body is required", err)
				return
			}

			s, err := ctrl.VLC.Status()
			if err != nil {
				ctrl.genericErr(w, "failed to get subtitles", err)
				return
			}

			ctx.SubtitleTracks = s.SubtitleTracks

			next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), subtitlesSetCtxKey{}, ctx)))
		})
	}
}

func (ctrl SubtitlesSet) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)

		if ctx.ID == -1 {
			next.ServeHTTP(w, r)
			return
		}

		for _, sub := range ctx.SubtitleTracks {
			if sub.ID == ctx.ID {
				next.ServeHTTP(w, r)
				return
			}
		}

		ctrl.validationErr(w, map[string]string{
			"track": "selected track was not found",
		})
	})
}

func (ctrl SubtitlesSet) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)

	if err := ctrl.VLC.SetSubtitleTrack(ctx.ID); err != nil {
		ctrl.genericErr(w, "failed to set subtitle track", err)
		return
	}

	ctrl.respond(w, 200, true)
}
