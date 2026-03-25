package ctrls

import (
	"context"
	"encoding/json"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"shiznatix/vlr/config"
	"shiznatix/vlr/utils"
)

type browseSeasonCtxKey struct{}
type browseSeasonCtx struct {
	ShowName  string `json:"showName"`
	SeasonNum string `json:"seasonNum"`
	seasonDir string
	entries   []fs.DirEntry
}

type BrowseSeason struct {
	Context
}

func (ctrl BrowseSeason) getCtx(r *http.Request) *browseSeasonCtx {
	return r.Context().Value(browseSeasonCtxKey{}).(*browseSeasonCtx)
}

func (ctrl BrowseSeason) InitCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := &browseSeasonCtx{}
		decoder := json.NewDecoder(r.Body)
		err := decoder.Decode(ctx)

		if err != nil {
			ctrl.genericErr(w, "body is required", err)
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), browseSeasonCtxKey{}, ctx)))
	})
}

func (ctrl BrowseSeason) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)

		if ctx.ShowName == "" {
			ctrl.validationErr(w, map[string]string{
				"showName": "cannot be empty",
			})
			return
		}
		if ctx.SeasonNum == "" {
			ctrl.validationErr(w, map[string]string{
				"seasonNum": "cannot be empty",
			})
			return
		}

		paddSeasonNum := utils.PrefixZero(ctx.SeasonNum)
		var searchErr error

		for _, dir := range config.Config.ShowDirs {
			ctx.seasonDir = filepath.Join(dir, ctx.ShowName, "Season "+paddSeasonNum)
			eps, err := os.ReadDir(ctx.seasonDir)
			if err == nil {
				ctx.entries = eps
				searchErr = nil
				break
			}

			searchErr = err
		}

		if searchErr != nil {
			ctrl.genericErr(w, "failed to read show season dir", searchErr)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (ctrl BrowseSeason) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)
	res := []browseGroup{{
		Files: newBrowseFilesFromDirEntries(ctx.seasonDir, ctx.entries),
	}}

	ctrl.respond(w, 200, res)
}
