package utils

import (
	"context"
	"encoding/json"
	"errors"
	"hash/fnv"
	"os"
	"reflect"
	"strconv"
	"sync"
	"time"
)

var SYNC_STATUS_PAUSED = "paused"

type DB struct {
	*sync.Map
	ctx                  context.Context
	filePath             string
	remoteURL            string
	valType              reflect.Type
	log                  logger
	syncStarted          bool
	syncPaused           bool
	syncFunc             func(ctx context.Context, conf interface{})
	syncEvery            time.Duration
	syncEveryFunc        func() time.Duration
	syncContext          context.Context
	syncCancel           context.CancelFunc
	syncWithSourceConfig interface{}
}

type DBConfig struct {
	Ctx                  context.Context
	FilePath             string
	RemoteURL            string
	ValType              any
	Logger               logger
	SyncStatus           string
	SyncFunc             func(ctx context.Context, conf interface{})
	SyncEvery            time.Duration
	SyncEveryFunc        func() time.Duration
	SyncWithSourceConfig interface{}
}

func NewDB(name string, c DBConfig) (DB, error) {
	db := DB{
		ctx:                  c.Ctx,
		Map:                  &sync.Map{},
		valType:              reflect.TypeOf(c.ValType),
		filePath:             c.FilePath,
		remoteURL:            c.RemoteURL,
		log:                  c.Logger,
		syncPaused:           c.SyncStatus == SYNC_STATUS_PAUSED,
		syncFunc:             c.SyncFunc,
		syncEvery:            c.SyncEvery,
		syncEveryFunc:        c.SyncEveryFunc,
		syncWithSourceConfig: c.SyncWithSourceConfig,
	}

	if db.valType == nil {
		return db, errors.New("db value type must be provied")
	}

	if db.filePath != "" {
		b, err := os.ReadFile(db.filePath)
		if err != nil {
			return db, errors.New("failed reading from cache: " + err.Error())
		} else if err := db.LoadFromJSON(b); err != nil {
			return db, errors.New("failed unmarshaling from cache: " + err.Error())
		}
	}

	if db.remoteURL != "" {
		if err := db.LoadFromRemote(); err != nil {
			return db, err
		}
	}

	return db, nil
}

func (d *DB) StartSyncJob() error {
	if d.ctx == nil {
		return errors.New("db ctx must be provided")
	}

	if d.syncStarted {
		return nil
	}

	if d.syncEvery == 0 && d.syncEveryFunc == nil {
		return errors.New("sync interval must be provided")
	}

	d.syncStarted = true

	go func() {
		d.sync(d.syncWithSourceConfig)

		syncEvery := d.syncEvery
		if d.syncEveryFunc != nil {
			syncEvery = d.syncEveryFunc()
		}
		ticker := time.NewTicker(syncEvery)

		for {
			select {
			case <-d.ctx.Done():
				d.log.Info("stopping db sync worker")
				ticker.Stop()
				return
			case <-ticker.C:
				d.sync(d.syncWithSourceConfig)

				if d.syncEveryFunc != nil {
					syncEvery = d.syncEveryFunc()
					d.log.Infof("setting syncing interval to %s", syncEvery)
					ticker.Reset(syncEvery)
				}
			}
		}
	}()

	return nil
}

func (d *DB) StopSyncJob() {
	if d.syncCancel != nil {
		d.syncCancel()
	}
}

func (d *DB) ManualSync(conf interface{}) {
	d.log.Info("manual sync triggered")
	d.StopSyncJob()
	d.sync(conf)
}

func (d *DB) PauseSync() {
	d.syncPaused = true
	d.StopSyncJob()
	d.log.Info("sync paused")
}

func (d *DB) ResumeSync() {
	d.syncPaused = false
	d.StartSyncJob()
	d.log.Info("sync resumed")
}

func (d DB) Len() int {
	l := 0
	d.Range(func(k, v any) bool {
		l++
		return true
	})
	return l
}

func (d DB) LoadFromRemote() error {
	b, err := HTTPGet(d.remoteURL, 3*time.Second)
	if err != nil {
		return err
	}

	tmp := struct {
		Data interface{} `json:"data"`
	}{
		Data: b,
	}
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}

	b, err = json.Marshal(tmp.Data)
	if err != nil {
		return err
	}

	if err := d.LoadFromJSON(b); err != nil {
		return err
	}

	return d.Save()
}

func (d DB) LoadFromJSON(jsonB []byte) error {
	defer RecoverPanicWithLogging(d.log)

	var arr []interface{}
	if err := json.Unmarshal(jsonB, &arr); err != nil {
		return err
	}

	newKeys := []DBKey{}
	for _, v := range arr {
		entryJson, err := json.Marshal(v)
		if err != nil {
			return err
		}

		newPtrVal := reflect.New(d.valType)
		newPtr := newPtrVal.Interface()
		err = json.Unmarshal(entryJson, newPtr)
		if err != nil {
			return err
		}

		strct := reflect.Indirect(newPtrVal)
		dbInt := strct.FieldByName("ID").Interface().(DBKey)
		dbKey := DBKey(dbInt)
		newVal := strct.Interface()

		d.Store(dbKey, newVal)
		newKeys = append(newKeys, dbKey)
	}

	d.DeleteOldKeys(newKeys)

	return nil
}

func (d DB) LoadFromSlice(slice interface{}) {
	defer RecoverPanicWithLogging(d.log)

	newKeys := []DBKey{}
	s := reflect.ValueOf(slice)

	for i := 0; i < s.Len(); i++ {
		v := s.Index(i)
		strct := reflect.Indirect(v)
		dbID := strct.FieldByName("ID").Interface().(DBKey)
		d.Store(dbID, strct.Interface())
		newKeys = append(newKeys, dbID)
	}

	d.DeleteOldKeys(newKeys)
}

func (d DB) MarshalJSON() ([]byte, error) {
	defer RecoverPanicWithLogging(d.log)

	var err error
	arr := []interface{}{}
	d.Range(func(k, v any) bool {
		arr = append(arr, v)
		return true
	})

	if err != nil {
		return []byte{}, err
	}

	return json.Marshal(arr)
}

func (d DB) Save() error {
	defer RecoverPanicWithLogging(d.log)

	if d.filePath == "" {
		return errors.New("no db file path provided to save")
	}

	b, err := json.MarshalIndent(d, "", "  ")
	if err != nil {
		return err
	} else if err := os.WriteFile(d.filePath, append(b[:], '\n'), 0644); err != nil {
		return err
	}

	return nil
}

func (d DB) SaveWithLogging(l logger) {
	if err := d.Save(); err != nil {
		l.Err(err, "failed saving cache file'%s'", d.filePath)
	} else {
		l.Infof("saved cache at %s", d.filePath)
	}
}

func (d DB) DeleteOldKeys(newDbKeys []DBKey) {
	d.Range(func(k, v any) bool {
		if !Contains(newDbKeys, k.(DBKey)) {
			d.Delete(k)
		}

		return true
	})
}

func (d *DB) isSyncing() bool {
	return d.syncContext != nil && d.syncContext.Err() == nil
}

func (d *DB) sync(conf interface{}) {
	if d.syncPaused {
		d.log.Debug("sync paused")
		return
	}

	if d.isSyncing() {
		d.log.Info("sync already in progress")
		return
	}

	d.log.Info("start sync")

	if d.remoteURL != "" {
		if err := d.LoadFromRemote(); err != nil {
			d.log.Err(err, "failed syncing from remote")
		}
	} else if d.syncFunc != nil {
		ctx, cancel := context.WithCancel(d.ctx)
		d.syncContext = ctx
		d.syncCancel = cancel
		d.syncFunc(ctx, conf)
		d.syncCancel()
	} else {
		d.log.Error("no sync function found")
	}

	d.log.Info("finish sync")
}

type DBKey uint32

func NewDBKey[T any](key T) DBKey {
	t := reflect.TypeOf(key).Kind()
	i := reflect.ValueOf(key).Interface()

	if t == reflect.Uint32 {
		return DBKey(i.(uint32))
	} else if t != reflect.String {
		panic("invalid type for DBKey")
	}

	h := fnv.New32a()
	h.Write([]byte(i.(string)))
	return DBKey(h.Sum32())
}

func (k DBKey) String() string {
	return strconv.FormatUint(uint64(k), 10)
}

type DBRecord struct {
	ID DBKey `json:"id"`
}
