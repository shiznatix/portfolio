package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
	"shiznatix/vlr/config"
	"shiznatix/vlr/fseps"
	"shiznatix/vlr/fslabels"
	"shiznatix/vlr/imdbeps"
	"shiznatix/vlr/missingeps"
	"shiznatix/vlr/utils"
	"strings"
)

type databaseSyncCtxKey struct{}
type databaseSyncCtx struct {
	Database string `json:"database"`
	Action   string `json:"action"`
}

type DatabaseSync struct {
	Context
}

func (ctrl DatabaseSync) getCtx(r *http.Request) *databaseSyncCtx {
	return r.Context().Value(databaseSyncCtxKey{}).(*databaseSyncCtx)
}

func (ctrl DatabaseSync) InitCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := &databaseSyncCtx{}
		decoder := json.NewDecoder(r.Body)
		err := decoder.Decode(ctx)

		if err != nil {
			ctrl.genericErr(w, "body is required or is not json", err)
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), databaseSyncCtxKey{}, ctx)))
	})
}

func (ctrl DatabaseSync) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)

		validDBNames := []string{
			fslabels.NAME, fseps.NAME, imdbeps.NAME, missingeps.NAME,
		}
		validActions := []string{"sync", "pause", "resume"}

		if !utils.ContainsStr(validDBNames, ctx.Database) {
			ctrl.validationErr(w, map[string]string{
				"name": "name must be one of " + strings.Join(validDBNames, ", "),
			})
			next.ServeHTTP(w, r)
			return
		} else if !utils.ContainsStr(validActions, ctx.Action) {
			ctrl.validationErr(w, map[string]string{
				"action": "action must be one of" + strings.Join(validActions, ", "),
			})
			next.ServeHTTP(w, r)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (ctrl DatabaseSync) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)
	var db utils.DB
	var conf interface{} = nil

	switch ctx.Database {
	case fslabels.NAME:
		db = ctrl.FSLabels.DB
	case fseps.NAME:
		db = ctrl.FSEps.DB
	case imdbeps.NAME:
		db = ctrl.IMDBEps.DB
	case missingeps.NAME:
		// if needed, we can add a config struct here which can change the search chances or add filters
		db = ctrl.MissingEps.DB
		conf = missingeps.SyncConfig{
			VLRSearchURL: config.Config.VLRSearchURL,
			MaxResults:   5,
			MaxSearches:  2,
		}
	}

	switch ctx.Action {
	case "sync":
		db.ManualSync(conf)
	case "pause":
		db.PauseSync()
	case "resume":
		db.ResumeSync()
	}

	ctrl.respond(w, 200, true)
}
