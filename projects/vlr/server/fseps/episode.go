package fseps

import (
	"errors"
	"os"
	"path/filepath"
	"shiznatix/vlr/utils"
	"shiznatix/vlr/xattr"
	"strings"
)

type Episode struct {
	utils.DBRecord
	utils.Episode
	xattr.VLRAttrs
	FileName string `json:"fileName"`
	FilePath string `json:"filePath"`
	showDir  string
}

func (ep *Episode) reload() error {
	if ep.FilePath == "" {
		return errors.New("cannot reload episode with empty path")
	}

	if !utils.IsPlayableExtension(ep.FilePath) {
		return errors.New("unplayable file extension")
	}

	fInfo, err := os.Stat(ep.FilePath)
	if err != nil {
		return errors.New("cannot get file info for path")
	} else if fInfo.IsDir() {
		return errors.New("path is a dir")
	}

	fileDir, fileName := filepath.Split(ep.FilePath)

	fileDir = strings.TrimPrefix(fileDir, ep.showDir)
	dirParts := utils.DeleteEmpty(strings.Split(fileDir, string(os.PathSeparator)))
	dirPLen := len(dirParts)
	showName := ""
	seasonName := ""

	if dirPLen > 1 {
		showName = dirParts[0]
		seasonFolder := dirParts[1]
		if strings.HasPrefix(strings.ToLower(seasonFolder), "season ") {
			parts := strings.Split(seasonFolder, " ")
			if len(parts) > 1 {
				seasonName = strings.TrimPrefix(parts[1], "0")
			}
		}
	} else if dirPLen == 1 {
		showName = dirParts[0]
	}

	nameParts := strings.Split(fileName, " -")
	name := ""
	num := ""

	if len(nameParts) == 1 {
		name = nameParts[0]
	} else if len(nameParts) > 1 {
		n, names := nameParts[0], nameParts[1:]
		num = strings.TrimSpace(n)
		name = strings.TrimSpace(strings.Join(names, " -"))
		nameParts = strings.Split(name, ".")
		name = strings.Join(nameParts[:len(nameParts)-1], ".")
	}

	baseEp := utils.Episode{
		ShowName:      showName,
		SeasonName:    seasonName,
		EpisodeNumber: num,
		EpisodeName:   name,
	}

	ep.ID = baseEp.DBKey()
	ep.FileName = fileName
	ep.Episode = baseEp

	return nil
}
