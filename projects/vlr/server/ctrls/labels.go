package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"shiznatix/vlr/fslabels"
	"sort"
)

type labelsCtxKey struct{}
type labelsCtx struct {
	Dir string `json:"dir"`
}
type labelsResult struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type Labels struct {
	Context
}

func (ctrl Labels) getCtx(r *http.Request) *labelsCtx {
	return r.Context().Value(labelsCtxKey{}).(*labelsCtx)
}

func (ctrl Labels) InitCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := &labelsCtx{}
		decoder := json.NewDecoder(r.Body)
		err := decoder.Decode(ctx)

		if err != nil {
			ctrl.genericErr(w, "body is required or is not json", err)
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), labelsCtxKey{}, ctx)))
	})
}

func (ctrl Labels) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)

		if ctx.Dir != "" {
			fInfo, err := os.Stat(ctx.Dir)
			if err != nil {
				ctrl.genericErr(w, "dir '"+ctx.Dir+"' does not exist", nil)
				return
			}

			if !fInfo.IsDir() {
				ctrl.genericErr(w, "dir is not a dir", nil)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

func (ctrl Labels) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)
	res := []labelsResult{}
	lbls := ctrl.FSLabels.Labels(fslabels.LabelsFilter{
		PathPrefix: ctx.Dir,
	})

	for _, l := range lbls {
		res = append(res, labelsResult{
			Name:  l.Name,
			Count: len(l.Paths),
		})
	}

	sort.Slice(res, func(i, j int) bool {
		return res[i].Count > res[j].Count
	})

	ctrl.respond(w, 200, res)
}
