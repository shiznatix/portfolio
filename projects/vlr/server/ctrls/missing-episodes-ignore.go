package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
	"shiznatix/vlr/utils"
)

type missingEpisodesIgnoreCtxKey struct{}
type missingEpisodesIgnoreCtx struct {
	ID      utils.DBKey `json:"id"`
	Ignored bool        `json:"ignored"`
}

type MissingEpisodesIgnore struct {
	Context
}

func (ctrl MissingEpisodesIgnore) getCtx(r *http.Request) *missingEpisodesIgnoreCtx {
	return r.Context().Value(missingEpisodesIgnoreCtxKey{}).(*missingEpisodesIgnoreCtx)
}

func (ctrl MissingEpisodesIgnore) InitCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := &missingEpisodesIgnoreCtx{}
		decoder := json.NewDecoder(r.Body)
		err := decoder.Decode(ctx)

		if err != nil {
			ctrl.genericErr(w, "body is required", err)
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), missingEpisodesIgnoreCtxKey{}, ctx)))
	})
}

func (ctrl MissingEpisodesIgnore) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)

		if ctx.ID == 0 {
			ctrl.validationErr(w, map[string]string{
				"key": "was not set",
			})
			return
		}

		if _, ok := ctrl.MissingEps.ForKey(ctx.ID); !ok {
			ctrl.genericErr(w, "failed to find missing episode for key", nil)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (ctrl MissingEpisodesIgnore) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)

	if _, err := ctrl.MasterServer.ForwardRequest(r, ctx, nil); err != nil {
		ctrl.genericErr(w, "failed forwarding missing-episodes-ignore", err)
		return
	}

	if err := ctrl.MissingEps.Ignore(ctx.ID, ctx.Ignored); err != nil {
		ctrl.genericErr(w, "failed to ignore missing episode", err)
		return
	}

	ctrl.respond(w, 200, true)
}
