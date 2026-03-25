package transmission

import (
	"context"
	"fmt"
	"shiznatix/vlr/colors"
	"shiznatix/vlr/fseps"
	"shiznatix/vlr/logger"
	"shiznatix/vlr/missingeps"
	"shiznatix/vlr/utils"
	"shiznatix/vlr/xattr"
	"time"
)

type transmission struct {
	ctx         context.Context
	log         logger.Logger
	syncStarted bool
	fseps       fseps.FileSystemEpisodes
	meps        missingeps.MissingEpisodes
	Remote      Remote
}

type Config struct {
	Ctx          context.Context
	FSEps        fseps.FileSystemEpisodes
	MissingEps   missingeps.MissingEpisodes
	Remote       Remote
	MasterServer utils.MasterServer
}

func New(c Config) Remote {
	t := transmission{
		ctx:         c.Ctx,
		log:         logger.Get("transmission", colors.LoggerTransmissionColor),
		syncStarted: false,
		fseps:       c.FSEps,
		meps:        c.MissingEps,
		Remote:      c.Remote,
	}

	if c.MasterServer.IsMaster() {
		t.startSyncJob()
	}

	return t.Remote
}

func (t *transmission) startSyncJob() {
	if t.syncStarted {
		return
	}

	t.syncStarted = true

	go func() {
		t.syncWithSource()

		ticker := time.NewTicker(1 * time.Minute)

		for {
			select {
			case <-t.ctx.Done():
				t.log.Info("stopping transmission worker")
				ticker.Stop()
				return
			case <-ticker.C:
				t.syncWithSource()
			}
		}
	}()
}

func (t transmission) syncWithSource() {
	t.log.Info("start sync-with-source")

	currDls, err := t.Remote.List()
	if err != nil {
		t.log.Err(err, "failed sync-with-source")
		return
	}

	// clear out selected torrent that are no longer in transmission
	selectedDls := t.meps.SelectedTorrents()
	for _, selectedDl := range selectedDls {
		found := false
		for _, currDl := range currDls {
			if currDl.ID == selectedDl.TransmissionID {
				found = true
				break
			}
		}

		if !found {
			t.log.Error("clearing orphaned transmission id " + selectedDl.TransmissionID + " from selected list (" + selectedDl.FileName + ")")
			t.meps.UnselectTorrent(selectedDl.TransmissionID)
		}
	}

	// TODO this should be split out. Maybe have more specific flags and runners or something?
	// move done files
	for _, dl := range currDls {
		if utils.IsCanceled(t.ctx) {
			t.log.Info("bail sync-with-source: context was canceled")
			return
		}

		if dl.ETA != "Done" || dl.DonePercent != "100%" {
			continue
		}

		mep, ok := t.meps.EpisodeForTorrent(t.Remote.MagnetLink(dl.ID), dl.ID)
		var cpErr error

		if ok {
			newPath, err := dl.copy(mep.IMDBEpisode)
			if err != nil {
				cpErr = err
				t.log.Err(err, "failed copying file")
				t.meps.AddEpisodeLog(mep, fmt.Sprintf("failed copying err:'%s'", err.Error()))

				if err := dl.orphan(); err != nil {
					cpErr = err
					t.log.Err(err, "failed orphaning download")
					t.meps.AddEpisodeLog(mep, fmt.Sprintf("failed orphaning err:'%s'", err.Error()))
				}
			} else {
				if err := xattr.New(newPath).SetNewDownload(); err != nil {
					t.log.Err(err, "failed setting download xattr")
				}

				if err := t.fseps.StorePath(newPath); err != nil {
					t.log.Err(err, "failed adding download to fseps")
				}
			}

			if cpErr != nil {
				t.meps.UnselectTorrent(dl.ID)
			} else {
				t.meps.RemoveEpisode(mep)
			}
		} else {
			t.log.Error("no missing episode found for transmission id " + dl.ID + ", sending to orpahan dir (" + dl.Name + ")")
			if err := dl.orphan(); err != nil {
				t.log.Err(err, "failed orphaning download")
			}
		}

		// only remove if we didn't have errors copying it
		if cpErr == nil {
			if err := t.Remote.Remove(dl.ID); err != nil {
				t.log.Errorf("failed to remove torrent id %s", dl.ID)
				if err := t.Remote.Stop(dl.ID); err != nil {
					t.log.Errorf("failed to stop torrent id %s", dl.ID)
				}
			}
		}
	}

	t.log.Info("finish sync-with-source")
}
