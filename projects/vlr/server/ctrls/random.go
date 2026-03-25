package ctrls

import (
	"context"
	"encoding/json"
	"net/http"
	"shiznatix/vlr/fseps"
	"shiznatix/vlr/vlc"
	"shiznatix/vlr/xattr"
)

type randomCtxKey struct{}

type randomCtx struct {
	Amount       int                `json:"amount"`
	Method       string             `json:"method"`
	Slots        []fseps.RandomSlot `json:"slots"`
	CurrPlaylist []vlc.PlaylistItem
}

type Random struct {
	Context
}

func (ctrl Random) getCtx(r *http.Request) *randomCtx {
	return r.Context().Value(randomCtxKey{}).(*randomCtx)
}

func (ctrl Random) InitCtx(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pl, _ := ctrl.VLC.Playlist()
		ctx := &randomCtx{
			CurrPlaylist: pl,
		}
		decoder := json.NewDecoder(r.Body)
		err := decoder.Decode(ctx)
		if err != nil {
			ctrl.genericErr(w, "Body was not parsable", err)
			return
		}

		next.ServeHTTP(w, r.WithContext(context.WithValue(context.Background(), randomCtxKey{}, ctx)))
	})
}

func (ctrl Random) Validate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ctrl.getCtx(r)

		if len(ctx.Slots) == 0 {
			ctrl.validationErr(w, map[string]string{
				"showNames": "no selected show names",
			})
			return
		}
		if ctx.Amount < 1 || ctx.Amount > 15 {
			ctrl.validationErr(w, map[string]string{
				"amount": "amount must be between 1 and 15",
			})
			return
		}
		if ctx.Method != playlistReplace && ctx.Method != playlistAppend {
			ctrl.validationErr(w, map[string]string{
				"method": "method must be of value 'replace' or 'append'",
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (ctrl Random) Handle(w http.ResponseWriter, r *http.Request) {
	ctx := ctrl.getCtx(r)
	rndm := ctrl.FSEps.NewRandom(fseps.RandomConfig{
		Amount:   ctx.Amount,
		Slots:    ctx.Slots,
		Playlist: ctx.CurrPlaylist,
	})
	eps, err := rndm.Episodes()
	if err != nil {
		ctrl.genericErr(w, "failed to load any random episodes", err)
		return
	}

	if ctx.Method == playlistReplace {
		if err := ctrl.VLC.EmptyPlaylist(); err != nil {
			ctrl.genericErr(w, "failed to empty playlist", err)
			return
		}
	}

	for _, ep := range eps {
		if err := ctrl.VLC.Add(ep.FilePath); err != nil {
			ctrl.genericErr(w, "failed to add to playlist "+ep.FilePath, err)
			return
		}

		if err := xattr.New(ep.FilePath).SetPlayed(); err != nil {
			log.Err(err, "failed to save file played metadatctrl path:'%s'", ep.FilePath)
		}

		// update our DB so other `random` calls dont include the same episode again
		if err := ctrl.FSEps.StorePath(ep.FilePath); err != nil {
			log.Err(err, "failed updating fseps database path:'%s'", ep.FilePath)
		}
	}

	pl, _ := ctrl.VLC.Playlist()

	if ctx.Method == playlistReplace || len(pl) == len(eps) {
		if err := ctrl.VLC.Play(0); err != nil {
			ctrl.genericErr(w, "failed to start playing", err)
			return
		}

		if err := ctrl.VLC.Fullscreen(); err != nil {
			log.Err(err, "failed to set fullscreen")
		}
	}

	ctrl.respond(w, 200, eps)
}
