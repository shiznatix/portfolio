package fseps

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"
	"shiznatix/vlr/colors"
	"shiznatix/vlr/logger"
	"shiznatix/vlr/utils"
	"shiznatix/vlr/xattr"
	"sort"
	"strings"
	"time"
)

const NAME = "fseps"

type dbValue = Episode

type FileSystemEpisodes struct {
	ctx      context.Context
	log      logger.Logger
	DB       utils.DB
	showDirs []string
}
type Config struct {
	Ctx           context.Context
	CacheFilePath string
	ShowDirs      []string
}

type DBFilter struct {
	AutoDownloaded bool
	PlayedCount    int
	SkipInRandom   bool
}

func New(c Config) FileSystemEpisodes {
	log := logger.Get(NAME, colors.LoggerFSEpsColor)
	fe := FileSystemEpisodes{
		ctx:      c.Ctx,
		log:      log,
		showDirs: c.ShowDirs,
	}
	dbConf := utils.DBConfig{
		Ctx:       c.Ctx,
		FilePath:  c.CacheFilePath,
		ValType:   dbValue{},
		Logger:    log,
		SyncFunc:  fe.syncWithSource,
		SyncEvery: 5 * time.Minute,
	}

	log.Info("loading from cache")
	db, err := utils.NewDB(NAME, dbConf)
	fe.DB = db
	if err != nil {
		log.Err(err, "failed loading db")
	}
	log.Infof("loaded db len:%d", fe.DB.Len())

	if db.Len() == 0 {
		fe.syncWithSource(fe.ctx, nil)
	}

	log.Infof("initialized db len:%d", db.Len())
	if err := fe.DB.StartSyncJob(); err != nil {
		log.Err(err, "failed to start sync job")
	}

	return fe
}

func (fe FileSystemEpisodes) NewRandom(conf RandomConfig) random {
	skipPaths := []string{}
	for _, plItem := range conf.Playlist {
		skipPaths = append(skipPaths, plItem.Path)
	}

	return random{
		fe:        fe,
		amount:    conf.Amount,
		slots:     conf.Slots,
		skipPaths: skipPaths,
		episodes:  []dbValue{},
	}
}

func (fe FileSystemEpisodes) walkShowsDirs(ctx context.Context, f func(path string) error) error {
	for _, dir := range fe.showDirs {
		if utils.IsCanceled(ctx) {
			return errors.New("context canceled")
		}

		err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, e error) error {
			if utils.IsCanceled(ctx) {
				return ctx.Err()
			}

			if e != nil {
				return e
			} else if d.IsDir() {
				return nil
			} else if !utils.IsPlayableExtension(d.Name()) {
				return nil
			}

			return f(path)
		})
		if err != nil {
			return fmt.Errorf("failed walking show dir:'%s' err:'%v'", dir, err)
		}
	}

	return nil
}

func (fe *FileSystemEpisodes) syncWithSource(ctx context.Context, c interface{}) {
	fe.log.Info("start sync-with-source")
	totFiles := 0
	newDbKeys := []utils.DBKey{}
	var err error

	err = fe.walkShowsDirs(ctx, func(path string) error {
		totFiles++
		return nil
	})
	if err != nil {
		fe.log.Err(err, "failed getting total files count")
		return
	}

	fe.log.Infof("sync-with-source total files:%d", totFiles)

	perDoneShown := []int{}
	err = fe.walkShowsDirs(ctx, func(path string) error {
		ep := Episode{
			FilePath: path,
			VLRAttrs: xattr.New(path).VLRAttrs(),
		}
		if err := fe.store(&ep); err != nil {
			return fmt.Errorf("failed adding path:'%s' to db err:'%v'", path, err)
		} else {
			newDbKeys = append(newDbKeys, ep.ID)
			perDone := int((float64(len(newDbKeys)) / float64(totFiles)) * 100)
			if (perDone == 0 || perDone%10 == 0) && !utils.Contains(perDoneShown, perDone) {
				fe.log.Infof("sync-with-source progress done:%d%%", perDone)
				perDoneShown = append(perDoneShown, perDone)
			}
		}

		return nil
	})
	if err != nil {
		fe.log.Err(err, "failed sync-with-source")
		return
	}

	fe.DB.DeleteOldKeys(newDbKeys)
	fe.DB.SaveWithLogging(fe.log)
	fe.log.Infof("finish sync-with-source with size:%d", len(newDbKeys))
}

func (fe FileSystemEpisodes) Filtered(f DBFilter) []Episode {
	eps := []Episode{}

	fe.DB.Range(func(k, v any) bool {
		ep := v.(dbValue)
		if ep.AutoDownloaded == f.AutoDownloaded && ep.PlayedCount == f.PlayedCount && ep.SkipInRandom == f.SkipInRandom {
			eps = append(eps, ep)
		}

		return true
	})

	return eps
}

func (fe FileSystemEpisodes) ShowNames() []string {
	names := []string{}

	fe.DB.Range(func(k, v any) bool {
		ep := v.(dbValue)
		if ep.ShowName != "" && !utils.ContainsStr(names, ep.ShowName) {
			names = append(names, ep.ShowName)
		}

		return true
	})

	sort.Strings(names)

	return names
}

func (fe FileSystemEpisodes) ShowEpisodes(showName string) []dbValue {
	eps := []dbValue{}

	fe.DB.Range(func(k, v any) bool {
		ep := v.(dbValue)
		if ep.ShowName == showName {
			eps = append(eps, ep)
		}

		return true
	})

	return eps
}

func (fe FileSystemEpisodes) EpisodeExists(showName string, seasonName string, episodeNum string) bool {
	found := false
	fe.DB.Range(func(k, v any) bool {
		ep := v.(dbValue)
		if ep.ShowName == showName && ep.SeasonName == seasonName && utils.Contains(ep.ExpandEpisodeNumber(), episodeNum) {
			found = true
			return false
		}

		return true
	})

	return found
}

func (fe FileSystemEpisodes) FindByPath(path string) (Episode, bool) {
	var foundEp dbValue
	found := false
	fe.DB.Range(func(k, v any) bool {
		ep := v.(dbValue)
		if ep.FilePath == path {
			foundEp = ep
			found = true
			return false
		}

		return true
	})

	return foundEp, found
}

func (fe FileSystemEpisodes) StorePath(path string) error {
	err := fe.store(&Episode{
		FilePath: path,
		VLRAttrs: xattr.New(path).VLRAttrs(),
	})
	if err != nil {
		return err
	}

	fe.DB.SaveWithLogging(fe.log)

	return nil
}

func (fe FileSystemEpisodes) store(ep *Episode) error {
	ep.showDir = ""
	for _, v := range fe.showDirs {
		if strings.HasPrefix(ep.FilePath, v) {
			ep.showDir = v
			break
		}
	}

	if ep.showDir == "" {
		return fmt.Errorf("failed to find show dir for path:'%s'", ep.FilePath)
	}

	if err := ep.reload(); err != nil {
		return err
	}

	fe.DB.Store(ep.ID, *ep)

	return nil
}
