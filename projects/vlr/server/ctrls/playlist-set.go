package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"shiznatix/vlr/utils"
	"shiznatix/vlr/xattr"
)

const playlistReplace = "replace"
const playlistAppend = "append"

type playlistSetCtxKey struct{}
type playlistSetCtx struct {
	Paths      []string `json:"paths"`
	StreamURLs []string `json:"streamUrls"`
	Method     string   `json:"method"`
}
type PlaylistSet struct {
	Context
}

func (ctrl PlaylistSet) pathsError(w http.ResponseWriter, msg string) {
	ctrl.validationErr(w, map[string]string{
		"paths": msg,
	})
}

func (ctrl PlaylistSet) methodError(w http.ResponseWriter, msg string) {
	ctrl.validationErr(w, map[string]string{
		"method": msg,
	})
}

func (ctrl PlaylistSet) getCtx(r *http.Request) *playlistSetCtx {
	return r.Context().Value(playlistSetCtxKey{}).(*playlistSetCtx)
}

func (ctrl PlaylistSet) InitCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := &playlistSetCtx{}
		decoder := json.NewDecoder(r.Body)
		err := decoder.Decode(ctx)

		if err != nil {
			ctrl.genericErr(w, "body is required", err)
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), playlistSetCtxKey{}, ctx)))
	})
}

func (ctrl PlaylistSet) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)

		if ctx.Method != playlistReplace && ctx.Method != playlistAppend {
			ctrl.methodError(w, "method must be 'replace' or 'append'")
			return
		}

		for _, path := range ctx.Paths {
			fInfo, err := os.Stat(path)
			if err != nil {
				ctrl.pathsError(w, "ctrl path does not exist")
				return
			}

			if fInfo.IsDir() {
				ctrl.pathsError(w, "ctrl path is not ctrl regular file")
				return
			}

			if !utils.IsPlayableExtension(fInfo.Name()) {
				ctrl.pathsError(w, "ctrl path is not ctrl playable file")
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

func (ctrl PlaylistSet) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)

	if ctx.Method == playlistReplace {
		if err := ctrl.VLC.EmptyPlaylist(); err != nil {
			log.Err(err, "failed to empty playlist")
		}
	}

	for _, path := range ctx.Paths {
		log.Infof("adding '%s' to playlist", path)

		if err := ctrl.VLC.Add(path); err != nil {
			ctrl.genericErr(w, "failed to add path to playlist", err)
			return
		}

		err := ctrl.setXATTR(path, func(f xattr.File) error {
			return f.SetPlayed()
		})
		if err != nil {
			log.Err(err, "failed to save file played metadata path:'%s'", path)
		}

		log.Infof("added '%s' to playlist", path)
	}

	for _, streamURL := range ctx.StreamURLs {
		if err := ctrl.VLC.AddStreamURL(streamURL); err != nil {
			ctrl.genericErr(w, "failed to add stream url to playlist", err)
			return
		}
	}

	pl, _ := ctrl.VLC.Playlist()
	// if our new playlist is the same len as the number of paths to add, that means we have a new playlist totally
	if ctx.Method == playlistReplace || len(pl) == len(ctx.Paths) {
		if err := ctrl.VLC.Play(0); err != nil {
			ctrl.genericErr(w, "failed to start playlist", err)
			return
		}

		if err := ctrl.VLC.Fullscreen(); err != nil {
			log.Err(err, "failed to set fullscreen")
		}
	}

	ctrl.respond(w, 200, true)
}
