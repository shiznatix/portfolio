package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
	"shiznatix/vlr/fslabels"
	"sort"
)

type browseLabelsCtxKey struct{}
type browseLabelsCtx struct {
	Dir    string   `json:"dir"`
	Labels []string `json:"labels"`
}
type browseLabelsResult struct {
	browseGroup
	Labels []string `json:"labels"`
}

type BrowseLabels struct {
	Context
}

func (ctrl BrowseLabels) getCtx(r *http.Request) *browseLabelsCtx {
	return r.Context().Value(browseLabelsCtxKey{}).(*browseLabelsCtx)
}

func (ctrl BrowseLabels) InitCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := &browseLabelsCtx{}
		decoder := json.NewDecoder(r.Body)
		err := decoder.Decode(ctx)

		if err != nil {
			ctrl.genericErr(w, "body is required or is not json", err)
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), browseLabelsCtxKey{}, ctx)))
	})
}

func (ctrl BrowseLabels) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)

		if ok, errMsg := validateDir(ctx.Dir); !ok {
			ctrl.validationErr(w, map[string]string{
				"dir": errMsg,
			})
			return
		} else if len(ctx.Labels) == 0 {
			ctrl.validationErr(w, map[string]string{
				"labels": "labels is required",
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (ctrl BrowseLabels) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)
	pathsRes := ctrl.FSLabels.Paths(fslabels.PathsFilter{
		Labels:     ctx.Labels,
		PathPrefix: ctx.Dir,
		// RequireAllLabels: true,
	})
	res := []browseLabelsResult{}

	for _, pRes := range pathsRes {
		res = append(res, browseLabelsResult{
			browseGroup: browseGroup{
				Files: newBrowseFilesFromPaths(pRes.Paths),
			},
			Labels: pRes.Labels,
		})
	}

	sort.Slice(res, func(i, j int) bool {
		return len(res[i].Labels) > len(res[j].Labels)
	})

	ctrl.respond(w, 200, res)
}
