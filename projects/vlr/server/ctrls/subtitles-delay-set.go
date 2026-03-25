package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
)

type subtitlesDelaySetCtxKey struct{}
type subtitlesDelaySetCtx struct {
	Delay float64 `json:"delay"`
}

type SubtitlesDelaySet struct {
	Context
}

func (ctrl SubtitlesDelaySet) getCtx(r *http.Request) *subtitlesDelaySetCtx {
	return r.Context().Value(subtitlesDelaySetCtxKey{}).(*subtitlesDelaySetCtx)
}

func (ctrl SubtitlesDelaySet) InitCtx() func(n http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := &subtitlesDelaySetCtx{}
			decoder := json.NewDecoder(r.Body)
			err := decoder.Decode(ctx)

			if err != nil {
				ctrl.genericErr(w, "body is required", err)
				return
			}

			next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), subtitlesDelaySetCtxKey{}, ctx)))
		})
	}
}

func (ctrl SubtitlesDelaySet) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)

	if err := ctrl.VLC.SetSubtitleDelay(ctx.Delay); err != nil {
		ctrl.genericErr(w, "failed to set subtitle delay", err)
		return
	}

	ctrl.respond(w, 200, true)
}
