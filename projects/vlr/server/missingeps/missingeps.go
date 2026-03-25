package missingeps

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"shiznatix/vlr/colors"
	"shiznatix/vlr/fseps"
	"shiznatix/vlr/imdbeps"
	"shiznatix/vlr/logger"
	"shiznatix/vlr/utils"
	"strings"
	"time"
)

const NAME = "missingeps"
const SYNC_EVERY_MIN_SECS = int64(5 * 60)
const SYNC_EVERY_MAX_SECS = int64(15 * 60)

type dbValue = episode

type MissingEpisodes struct {
	ctx   context.Context
	log   logger.Logger
	DB    utils.DB
	fseps fseps.FileSystemEpisodes
	imdb  imdbeps.IMDBEpisodes
}

type Config struct {
	Ctx               context.Context
	CacheFilePath     string
	VLRSearchURL      string
	FSEps             fseps.FileSystemEpisodes
	IMDBEps           imdbeps.IMDBEpisodes
	MasterServer      utils.MasterServer
	DefaultSyncStatus string
}

type SyncConfig struct {
	VLRSearchURL string
	MaxSearches  int
	MaxResults   int
}

func New(c Config) MissingEpisodes {
	log := logger.Get(NAME, colors.LoggerMissingEpsColor)
	meps := MissingEpisodes{
		ctx:   c.Ctx,
		log:   log,
		fseps: c.FSEps,
		imdb:  c.IMDBEps,
	}
	dbConf := utils.DBConfig{
		Ctx:        c.Ctx,
		FilePath:   c.CacheFilePath,
		ValType:    dbValue{},
		Logger:     log,
		SyncStatus: c.DefaultSyncStatus,
		SyncEveryFunc: func() time.Duration {
			return time.Duration(rand.Int63n(SYNC_EVERY_MAX_SECS-SYNC_EVERY_MIN_SECS)+SYNC_EVERY_MIN_SECS) * time.Second
		},
		SyncFunc: meps.syncWithSource,
		SyncWithSourceConfig: SyncConfig{
			VLRSearchURL: c.VLRSearchURL,
			// MaxSearches:  2,
			MaxResults: 5,
		},
	}

	c.MasterServer.SetDBSyncConfig(&dbConf, NAME)

	log.Info("loading from cache")
	db, err := utils.NewDB(NAME, dbConf)
	meps.DB = db
	if err != nil {
		log.Err(err, "failed loading db")
	}
	log.Infof("loaded db len:%d", meps.DB.Len())

	if err := meps.DB.StartSyncJob(); err != nil {
		log.Err(err, "failed to start sync job")
	}

	return meps
}

func (meps *MissingEpisodes) syncWithSource(ctx context.Context, c interface{}) {
	meps.log.Info("start sync-with-source")
	conf := c.(SyncConfig)

	if !strings.HasPrefix(conf.VLRSearchURL, "http") {
		meps.log.Info("bail sync-with-source: invalid vlrSearchURL")
		return
	}

	if meps.fseps.DB.Len() == 0 {
		meps.log.Info("bail sync-with-source: filesystem db is empty")
		return
	}

	meps.log.Info("find missing episodes on disk")
	yesterday := time.Now().Add(time.Duration(-24) * time.Hour).Unix()
	newDbKeys := []utils.DBKey{}

	for _, imdbEp := range meps.imdb.Episodes() {
		// episodes must be aired at least 1 day ago
		if imdbEp.AirTime > yesterday {
			continue
		}

		if meps.fseps.EpisodeExists(imdbEp.ShowName, imdbEp.SeasonName, imdbEp.EpisodeNumber) {
			continue
		}

		// if we already have it in our DB, use the data from there!
		ep, ok := meps.DB.Load(imdbEp.ID)
		if !ok {
			newEp, err := newEpisode(meps.ctx, imdbEp)
			if err != nil {
				meps.log.Err(err, "failed creating new episode struct")
				continue
			}

			ep = newEp
		}
		meps.DB.Store(imdbEp.ID, ep)
		newDbKeys = append(newDbKeys, imdbEp.ID)
	}

	meps.DB.DeleteOldKeys(newDbKeys)
	// save now just to be sure
	meps.DB.SaveWithLogging(meps.log)

	meps.log.Info("find episodes to search for")
	skippedCount := 0
	searchEps := []episode{}

	meps.DB.Range(func(k, v any) bool {
		ep := v.(dbValue)

		if utils.IsCanceled(ctx) {
			meps.log.Error("bail sync-with-source: context has ended")
			return false
		}

		srchStatus := ep.searchStatus()
		srchLogVars := []any{srchStatus.logMsg, ep.IMDBEpisode.LogMeta()}
		if !srchStatus.search {
			meps.log.Verbosef("skipping. %s %s", srchLogVars...)
			skippedCount++
		} else {
			meps.log.Infof("including! %s %s", srchLogVars...)
			searchEps = append(searchEps, ep)
		}

		if conf.MaxSearches > 0 && len(searchEps) >= conf.MaxSearches {
			meps.log.Infof("bail sync-with-source: reached max search count")
			return false
		}

		return true
	})

	meps.log.Infof("search for torrents total:%d", len(searchEps))

	for i, ep := range searchEps {
		logPrefix := fmt.Sprintf("(%d of %d)", (i + 1), len(searchEps))
		meps.log.Infof("%s running torrent search %s", logPrefix, ep.IMDBEpisode.LogMeta())
		ep.LastSearchTime = time.Now().Unix()

		// TODO how can we see if we are stuck on some CAPTCHA page?
		//   - If we are CAPTCHA locked, we need to bail out or risk our "reputation" getting bad
		searchResults, err := findTorrents(conf, ep.IMDBEpisode)
		if err != nil {
			meps.log.Err(err, "failed to search for torrents")
			continue
		}

		// log the result metadata and check if we had any successfull searches
		torrents := []torrent{}
		allErr := true
		for _, sr := range searchResults {
			ep.logSearch(sr)
			if sr.err == nil {
				torrents = append(torrents, sr.torrents...)
				allErr = false
			}
		}

		if allErr {
			meps.log.Errorf("all searches failed %s", ep.IMDBEpisode.LogMeta())
			meps.DB.Store(ep.ID, ep)
			meps.DB.SaveWithLogging(meps.log)
			continue
		}

		meps.log.Infof("%s found %d torrents %s", logPrefix, len(torrents), ep.IMDBEpisode.LogMeta())

		// set old "inactive" torrents to inactive status
		ep.Torrents.Range(func(k, v any) bool {
			t := v.(torrentsDBValue)
			t.Active = false
			for _, newT := range torrents {
				if newT.MagnetLink == t.MagnetLink {
					t.Active = true
					break
				}
			}

			ep.Torrents.Store(t.ID, t)

			return true
		})

		// now update seeders and add new torrents
		for _, newT := range torrents {
			if tV, ok := ep.Torrents.Load(newT.ID); ok {
				tl := tV.(torrentsDBValue)
				tl.Seeders = newT.Seeders
				ep.Torrents.Store(newT.ID, tl)
			} else {
				ep.Torrents.Store(newT.ID, newT)
			}
		}

		meps.DB.Store(ep.ID, ep)
		meps.DB.SaveWithLogging(meps.log)

		// backoff torrent websites so we dont get banned
		sleepMs := rand.Intn(7000-2000) + 2000
		if !utils.CanceleableSleep(meps.ctx, time.Duration(sleepMs)*time.Millisecond) {
			break
		}
	}

	// save again after the hard torrent finding work
	meps.DB.SaveWithLogging(meps.log)
	meps.log.Infof("finish sync-with-source skipped:%d searched:%d", skippedCount, len(searchEps))
}

func (meps MissingEpisodes) SelectedTorrents() []torrent {
	tls := []torrent{}

	meps.DB.Range(func(k, v any) bool {
		ep := v.(dbValue)
		ep.Torrents.Range(func(k, v any) bool {
			t := v.(torrentsDBValue)
			if t.TransmissionID != "" {
				tls = append(tls, t)
			}

			return true
		})

		return true
	})

	return tls
}

func (meps MissingEpisodes) SelectTorrent(mepID utils.DBKey, torID utils.DBKey, tranID string) error {
	v, ok := meps.DB.Load(mepID)
	if !ok {
		return errors.New("failed to find episode for id:" + mepID.String())
	}

	// TODO finish this???? Is there something more to do?
	mep := v.(dbValue)
	mep.selectTorrent(torID, tranID)
	meps.DB.SaveWithLogging(meps.log)

	return nil
}

func (meps MissingEpisodes) UnselectTorrent(transmissionId string) error {
	found := false
	meps.DB.Range(func(k, v any) bool {
		ep := v.(dbValue)
		ep.Torrents.Range(func(k, v any) bool {
			t := v.(torrentsDBValue)
			if t.TransmissionID == transmissionId {
				t.TransmissionID = ""
				t.log("removed")
				ep.log("removed torrentId:" + t.TransmissionID)
				ep.Torrents.Store(t.ID, t)
				meps.DB.Store(ep.ID, ep)
				meps.DB.SaveWithLogging(meps.log)
				found = true
			}

			return !found
		})

		return !found
	})

	if found {
		return nil
	}

	return errors.New("missing episode torrent index not found")
}

func (meps MissingEpisodes) EpisodeForTorrent(magnet, transmissionId string) (episode, bool) {
	var foundEp episode
	found := false
	meps.DB.Range(func(k, v any) bool {
		ep := v.(dbValue)
		ep.Torrents.Range(func(k, v any) bool {
			t := v.(torrentsDBValue)
			if t.MagnetLink == magnet || t.TransmissionID == transmissionId {
				foundEp = ep
				found = true
			}

			return !found
		})

		return !found
	})

	return foundEp, found
}

func (meps MissingEpisodes) RemoveEpisode(mep episode) {
	meps.DB.Delete(mep.ID)
	meps.DB.SaveWithLogging(meps.log)
}

func (meps MissingEpisodes) ForKey(id utils.DBKey) (episode, bool) {
	v, ok := meps.DB.Load(id)
	if !ok {
		return episode{}, false
	}

	ep := v.(dbValue)
	return ep, true
}

func (meps MissingEpisodes) Ignore(id utils.DBKey, ignore bool) error {
	v, ok := meps.DB.Load(id)
	if !ok {
		return errors.New("episode for ID:" + id.String() + " was not found")
	}

	ep := v.(dbValue)
	ep.log("ignored")
	ep.Ignore = ignore
	meps.DB.Store(id, ep)
	meps.DB.SaveWithLogging(meps.log)

	return nil
}

func (meps MissingEpisodes) AddEpisodeLog(mep episode, msg string) {
	mep.log(msg)
	meps.DB.Store(mep.ID, mep)
	meps.DB.SaveWithLogging(meps.log)
}
