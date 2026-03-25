package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"regexp"
	"shiznatix/vlr/utils"
	"shiznatix/vlr/xattr"
)

type filesSetXAttrCtxKey struct{}
type filesSetXAttrCtx struct {
	Path  string `json:"path"`
	Attr  string `json:"attr"`
	Value string `json:"value"`
}

type FilesSetXAttr struct {
	Context
}

func (ctrl FilesSetXAttr) getCtx(r *http.Request) *filesSetXAttrCtx {
	return r.Context().Value(filesSetXAttrCtxKey{}).(*filesSetXAttrCtx)
}

func (ctrl FilesSetXAttr) InitCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := &filesSetXAttrCtx{}
		decoder := json.NewDecoder(r.Body)
		err := decoder.Decode(ctx)

		if err != nil {
			ctrl.genericErr(w, "body is required", err)
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), filesSetXAttrCtxKey{}, ctx)))
	})
}

func (ctrl FilesSetXAttr) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)

		if ctx.Path == "" {
			ctrl.genericErr(w, "path was empty", nil)
			return
		}

		fsEpAttrBool := ctx.Attr == "autoDownloaded" || ctx.Attr == "skipInRandom"
		fsEpAttrNum := ctx.Attr == "playedCount" || ctx.Attr == "lastPlayedTime"

		if fsEpAttrBool || fsEpAttrNum {
			if fsEpAttrBool {
				if ctx.Value != "0" && ctx.Value != "1" {
					ctrl.validationErr(w, map[string]string{
						"value": "attr value must be '1' or '0' string. got: '" + ctx.Value + "'",
					})
					return
				}
			} else if fsEpAttrNum {
				numRegex := regexp.MustCompile("[1-9]{1}[0-9]{0,20}$")

				if ctx.Value != "0" && !numRegex.MatchString(ctx.Value) {
					ctrl.validationErr(w, map[string]string{
						"value": "attr value must a string containing only numbers. got: '" + ctx.Value + "'",
					})
					return
				}
			}

			_, ok := ctrl.FSEps.FindByPath(ctx.Path)
			if !ok {
				ctrl.genericErr(w, "failed to find episode at path", nil)
				return
			}
		} else if ctx.Attr == "labels" {
			if _, err := os.Stat(ctx.Path); err != nil {
				ctrl.genericErr(w, "failed to stat path", err)
				return
			}
			if !xattr.LabelsStringRegeex.MatchString(ctx.Value) {
				ctrl.genericErr(w, "value did not match labels string regex", nil)
				return
			}
		} else if ctx.Attr == "starred" {
			if ctx.Value != "0" && ctx.Value != "1" {
				ctrl.validationErr(w, map[string]string{
					"value": "if attr is 'starred' then value must be '1' or '0' string",
				})
				return
			}
			if _, err := os.Stat(ctx.Path); err != nil {
				ctrl.genericErr(w, "failed to stat path", err)
				return
			}
		} else {
			ctrl.validationErr(w, map[string]string{
				"attr": "invalid attr name",
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (ctrl FilesSetXAttr) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)
	var err error
	var res interface{} = true

	if ctx.Attr == "playedCount" {
		val := utils.StrToInt(ctx.Value)
		res = val
		err = ctrl.setXATTR(ctx.Path, func(xr xattr.File) error {
			return xr.SetPlayedCount(val)
		})
	} else if ctx.Attr == "skipInRandom" {
		val := ctx.Value == "1"
		res = val
		err = ctrl.setXATTR(ctx.Path, func(xr xattr.File) error {
			return xr.SetSkipInRandom(val)
		})
	} else if ctx.Attr == "autoDownloaded" {
		val := ctx.Value == "1"
		res = val
		err = ctrl.setXATTR(ctx.Path, func(xr xattr.File) error {
			return xr.SetAutoDownloaded(val)
		})
	} else if ctx.Attr == "lastPlayedTime" {
		val := utils.StrToInt64(ctx.Value)
		res = val
		err = ctrl.setXATTR(ctx.Path, func(xr xattr.File) error {
			return xr.SetLastPlayedTime(val)
		})
	} else if ctx.Attr == "labels" {
		val := ctx.Value
		res = val
		err = ctrl.setXATTR(ctx.Path, func(xr xattr.File) error {
			return xr.SetLabels(val)
		})
	} else if ctx.Attr == "starred" {
		val := ctx.Value == "1"
		res = val
		err = ctrl.setXATTR(ctx.Path, func(xr xattr.File) error {
			return xr.SetStarred(val)
		})
	}

	if err != nil {
		ctrl.genericErr(w, "failed to set xattr", err)
		return
	}

	ctrl.respond(w, 200, res)
}
