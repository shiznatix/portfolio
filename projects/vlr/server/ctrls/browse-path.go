package ctrls

import (
	"context"
	"encoding/json"
	"io/fs"
	"net/http"
	"os"
)

type browsePathCtxKey struct{}
type browsePathCtx struct {
	Dir     string `json:"dir"`
	entries []fs.DirEntry
}

type BrowsePath struct {
	Context
}

func (ctrl BrowsePath) getCtx(r *http.Request) *browsePathCtx {
	return r.Context().Value(browsePathCtxKey{}).(*browsePathCtx)
}

func (ctrl BrowsePath) InitCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := &browsePathCtx{}
		decoder := json.NewDecoder(r.Body)
		err := decoder.Decode(ctx)

		if err != nil {
			ctrl.genericErr(w, "body is required or is not json", err)
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), browsePathCtxKey{}, ctx)))
	})
}

func (ctrl BrowsePath) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)

		if ok, errMsg := validateDir(ctx.Dir); !ok {
			ctrl.validationErr(w, map[string]string{
				"dir": errMsg,
			})
			return
		}

		entries, err := os.ReadDir(ctx.Dir)
		if err != nil {
			ctrl.validationErr(w, map[string]string{
				"dir": "dir is not readable",
			})
			return
		}

		ctx.entries = entries

		next.ServeHTTP(w, r)
	})
}

func (ctrl BrowsePath) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)
	res := []browseGroup{{
		Files: newBrowseFilesFromDirEntries(ctx.Dir, ctx.entries),
	}}

	ctrl.respond(w, 200, res)
}
