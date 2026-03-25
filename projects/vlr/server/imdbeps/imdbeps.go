package imdbeps

import (
	"context"
	"shiznatix/vlr/colors"
	"shiznatix/vlr/logger"
	"shiznatix/vlr/utils"
	"time"
)

const NAME = "imdb"

type dbValue = show
type showName = string
type imdbID = string

type IMDBEpisodes struct {
	ctx       context.Context
	log       logger.Logger
	DB        utils.DB
	showIDMap map[showName]imdbID
}

type Config struct {
	Ctx           context.Context
	CacheFilePath string
	ShowIDMap     map[showName]imdbID
	MasterServer  utils.MasterServer
}

func New(c Config) IMDBEpisodes {
	log := logger.Get(NAME, colors.LoggerIMDBColor)
	imdb := IMDBEpisodes{
		ctx:       c.Ctx,
		log:       log,
		showIDMap: c.ShowIDMap,
	}
	dbConf := utils.DBConfig{
		Ctx:      c.Ctx,
		FilePath: c.CacheFilePath,
		ValType:  dbValue{},
		Logger:   log,
		SyncFunc: imdb.syncWithSource,
	}

	c.MasterServer.SetDBSyncConfig(&dbConf, NAME)

	log.Info("loading from cache")
	db, err := utils.NewDB(NAME, dbConf)
	imdb.DB = db
	if err != nil {
		log.Err(err, "failed loading db")
	}
	log.Infof("loaded db len:%d", imdb.DB.Len())

	if err := imdb.DB.StartSyncJob(); err != nil {
		log.Err(err, "failed to start sync job")
	}

	return imdb
}

func (imdb *IMDBEpisodes) syncWithSource(ctx context.Context, c interface{}) {
	imdb.log.Info("update imdb episodes database")

	allShowIDs := []utils.DBKey{}

	for showName, imdbID := range imdb.showIDMap {
		if utils.IsCanceled(ctx) {
			imdb.log.Error("imdb context has ended")
			return
		}

		id := utils.NewDBKey(imdbID)
		allShowIDs = append(allShowIDs, id)
		if _, ok := imdb.DB.Load(id); !ok {
			imdb.log.Infof("show not in db, loading blank show:'%s'", showName)
			sh, err := newShow(imdb.ctx, showName, imdbID)
			if err != nil {
				imdb.log.Err(err, "failed creating new show struct")
				continue
			}

			imdb.DB.Store(id, sh)
		}
		v, _ := imdb.DB.Load(id)
		sh := v.(dbValue)
		hSince := time.Since(time.Unix(sh.LastCheckTime, 0)).Hours()

		// if hSince > -1 {
		if hSince > 24 {
			imdb.log.Infof("last imdb crawl was %d hours ago for:'%s'", int(hSince), sh.Name)
			err := sh.crawl(imdb.ctx)
			if err != nil {
				imdb.log.Err(err, "failed fetching for show:'%s'", sh.Name)
			} else {
				imdb.DB.Store(id, sh)

				imdb.log.Infof("finished imdb crawl for:'%s'", sh.Name)
				// save right away because crawling takes a long time and we want to always save our state
				imdb.DB.SaveWithLogging(imdb.log)
			}
		} else {
			imdb.log.Infof("skipping '%s' IMDB check due to crawl %d hours ago", sh.Name, int(hSince))
		}
	}

	// ensure our db does not have old shows in it
	imdb.DB.DeleteOldKeys(allShowIDs)
	imdb.DB.SaveWithLogging(imdb.log)

	imdb.log.Info("finish update imdb episodes database")
}

func (imdb IMDBEpisodes) Episodes() []Episode {
	eps := []Episode{}

	imdb.DB.Range(func(k, v any) bool {
		sh := v.(dbValue)
		sh.Episodes.Range(func(k, v any) bool {
			ep := v.(episodesDBValue)
			eps = append(eps, ep)

			return true
		})

		return true
	})

	return eps
}

func (imdb IMDBEpisodes) Episode(publicId utils.DBKey) (Episode, bool) {
	eps := imdb.Episodes()

	for _, ep := range eps {
		if ep.ID == publicId {
			return ep, true
		}
	}

	return Episode{}, false
}
