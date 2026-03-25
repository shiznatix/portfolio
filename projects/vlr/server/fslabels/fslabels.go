package fslabels

import (
	"context"
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

const NAME = "fslabels"

type dbValue = pathLabels

type LabelsFilter struct {
	PathPrefix string
}

type labelsResult struct {
	Name  string
	Paths []string
}

type PathsFilter struct {
	Labels           []string
	PathPrefix       string
	RequireAllLabels bool
}

type pathsResult struct {
	Labels []string
	Paths  []string
}

type FileSystemLabels struct {
	ctx  context.Context
	log  logger.Logger
	DB   utils.DB
	dirs []string
}

type Config struct {
	Ctx           context.Context
	CacheFilePath string
	Dirs          []string
}

func New(c Config) FileSystemLabels {
	log := logger.Get(NAME, colors.LoggerFSLabelsColor)
	fl := FileSystemLabels{
		ctx:  c.Ctx,
		log:  log,
		dirs: c.Dirs,
	}
	dbConf := utils.DBConfig{
		Ctx:       c.Ctx,
		FilePath:  c.CacheFilePath,
		ValType:   dbValue{},
		Logger:    log,
		SyncFunc:  fl.syncWithSource,
		SyncEvery: 5 * time.Minute,
	}

	log.Info("loading from cache")
	db, err := utils.NewDB(NAME, dbConf)
	fl.DB = db
	if err != nil {
		log.Err(err, "failed loading db")
	}
	log.Infof("loaded db len:%d", fl.DB.Len())

	if err := fl.DB.StartSyncJob(); err != nil {
		log.Err(err, "failed to start sync job")
	}

	return fl
}

func (fl *FileSystemLabels) syncWithSource(ctx context.Context, c interface{}) {
	fl.log.Info("start sync-with-source")
	newDbKeys := []utils.DBKey{}

	for _, dir := range fl.dirs {
		if utils.IsCanceled(ctx) {
			fl.log.Error("context canceled")
			return
		}

		err := filepath.WalkDir(dir, func(path string, entry fs.DirEntry, err error) error {
			if utils.IsCanceled(ctx) {
				return nil
			}

			if err != nil {
				return err
			} else if !entry.IsDir() && !utils.IsPlayableExtension(entry.Name()) {
				return nil
			}

			labels := xattr.New(path).Labels()
			if len(labels) == 0 {
				return nil
			}

			pl := newPathLabels(fl.ctx, path, labels)
			fl.DB.Store(pl.ID, pl)
			newDbKeys = append(newDbKeys, pl.ID)

			return nil
		})
		if err != nil {
			fl.log.Err(err, "failed walking labels dir:'%s'", dir)
			return
		}
	}

	fl.DB.DeleteOldKeys(newDbKeys)
	fl.DB.SaveWithLogging(fl.log)
	fl.log.Infof("finish sync-with-source with size:%d", len(newDbKeys))
}

func (fl FileSystemLabels) Labels(filter LabelsFilter) []labelsResult {
	resMap := map[string][]string{}

	fl.DB.Range(func(k, v any) bool {
		pl := v.(dbValue)
		if filter.PathPrefix != "" && !strings.HasPrefix(pl.Path, filter.PathPrefix) {
			return true
		}

		for _, l := range pl.Labels {
			paths, ok := resMap[l]
			if !ok {
				paths = []string{}
			}

			paths = append(paths, pl.Path)
			resMap[l] = paths
		}

		return true
	})

	res := []labelsResult{}
	for n, v := range resMap {
		res = append(res, labelsResult{
			Name:  n,
			Paths: v,
		})
	}

	return res
}

func (fl FileSystemLabels) Paths(filter PathsFilter) []pathsResult {
	resMap := map[string]pathsResult{}
	ftrLblsLen := len(filter.Labels)

	fl.DB.Range(func(k, v any) bool {
		pl := v.(dbValue)
		if filter.PathPrefix != "" && !strings.HasPrefix(pl.Path, filter.PathPrefix) {
			return true
		}

		lbls := utils.FilterByValue(pl.Labels, filter.Labels)
		sort.Slice(lbls, func(i, j int) bool {
			return lbls[i] > lbls[j]
		})

		lblsLen := len(lbls)
		if lblsLen == 0 {
			return true
		}

		lblsStr := strings.Join(lbls, ":")
		lenRes, ok := resMap[lblsStr]
		if !ok {
			lenRes = pathsResult{
				Labels: lbls,
				Paths:  []string{},
			}
		}

		if filter.RequireAllLabels {
			if lblsLen == ftrLblsLen {
				lenRes.Paths = append(lenRes.Paths, pl.Path)
				resMap[lblsStr] = lenRes
			}
		} else {
			lenRes.Paths = append(lenRes.Paths, pl.Path)
			resMap[lblsStr] = lenRes
		}

		return true
	})

	res := []pathsResult{}
	for _, pRes := range resMap {
		res = append(res, pRes)
	}

	return res
}

func (fl FileSystemLabels) StorePath(path string) {
	labels := xattr.New(path).Labels()
	dbID := utils.NewDBKey(path)
	_, ok := fl.DB.Load(dbID)

	if len(labels) == 0 {
		if ok {
			fl.DB.Delete(dbID)
		}
	}

	pl := newPathLabels(fl.ctx, path, labels)
	fl.DB.Store(pl.ID, pl)
	fl.DB.SaveWithLogging(fl.log)
}
