package transmission

import (
	"errors"
	"os"
	"path/filepath"
	"shiznatix/vlr/config"
	"shiznatix/vlr/imdbeps"
	"shiznatix/vlr/logger"
	"shiznatix/vlr/utils"
	"strings"
)

type DownloadFile struct {
	ID               string `json:"id"`
	DonePercent      string `json:"donePercent"`
	AmountDownloaded string `json:"amountDownloaded"`
	ETA              string `json:"eta"`
	UploadSpeed      string `json:"uploadSpeed"`
	DownloadSpeed    string `json:"downloadSpeed"`
	ShareRatio       string `json:"shareRatio"`
	Status           string `json:"status"`
	SimpleStatus     string `json:"simpleStatus"`
	Name             string `json:"name"`
	log              logger.Logger
}

func (d DownloadFile) getPlayableFile(baseDir string) (string, error) {
	path := baseDir + "/" + d.Name
	fInfo, err := os.Stat(path)
	if err != nil {
		return "", err
	}

	if fInfo.IsDir() {
		files, err := os.ReadDir(path)
		if err != nil {
			return "", err
		}

		for _, file := range files {
			if utils.IsPlayableExtension(file.Name()) {
				return path + "/" + file.Name(), nil
			}
		}
	}

	return path, nil
}

func (d DownloadFile) copy(imdbEp imdbeps.Episode) (string, error) {
	// TODO no config here!
	playableFile, err := d.getPlayableFile(config.Config.DownloadsDir)
	d.log.Debugf("DL-COPY-START playableFile:'%s' config.DownloadsDir:'%s'", playableFile, config.Config.DownloadsDir)
	if err != nil {
		return "", err
	}

	showDir := utils.GetShowDir(config.Config.ShowDirs, imdbEp.ShowName)
	destDir := showDir + "/Season " + utils.PrefixZero(imdbEp.SeasonName)
	destInfo, err := os.Stat(destDir)
	if err != nil {
		if err := os.MkdirAll(destDir, os.ModePerm); err != nil {
			return "", err
		}
	} else if !destInfo.IsDir() {
		return "", errors.New("destination path is not a dir")
	}

	epName := strings.Replace(imdbEp.EpisodeName, "/", "-", -1)
	fileExt := filepath.Ext(playableFile)
	destFile := utils.PrefixZero(imdbEp.EpisodeNumber) + " - " + epName + fileExt
	destPath := destDir + "/" + destFile
	d.log.Infof("copying '%s' to '%s'", playableFile, destPath)
	if err := utils.CopyFile(playableFile, destPath); err != nil {
		return "", err
	}
	d.log.Info("file coppied successfully")

	return destPath, nil
}

func (d DownloadFile) orphan() error {
	if err := utils.EnsureDir(config.Config.OrphansDir); err != nil {
		return err
	}
	oldPath := config.Config.DownloadsDir + "/" + d.Name
	newPath := config.Config.OrphansDir + "/" + d.Name

	return utils.CopyFile(oldPath, newPath)
}
