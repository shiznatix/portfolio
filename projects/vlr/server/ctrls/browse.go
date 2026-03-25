package ctrls

import (
	"io/fs"
	"os"
	"path/filepath"
	"shiznatix/vlr/utils"
	"shiznatix/vlr/xattr"
	"strings"
)

type browseFile struct {
	xattr.VLRAttrs
	FilePath          string `json:"filePath"`
	IsDir             bool   `json:"isDir"`
	FileName          string `json:"fileName"`
	ModifiedTime      int64  `json:"modifiedTime"`
	PlayableExtension bool   `json:"playableExtension"`
	// Episode           fseps.Episode `json:"episode,omitempty"`
	// TODO `episodeData` if the file is in one of our `config.ShowDirs`
	//  * We need this to make our browse UI pretty when browsing by `labels`
	//  * Move the logic from `fseps.episode` to `utils.Episode` with a `NewEpisode` func which takes a path and returns the rest!
}
type browseGroup struct {
	Files []browseFile `json:"files"`
}

func newBrowseFile(dir string, fInfo fs.FileInfo) browseFile {
	var fullPath string

	if dir == "/" {
		fullPath = dir + fInfo.Name()
	} else {
		fullPath = dir + "/" + fInfo.Name()
	}

	isDir := fInfo.IsDir()
	return browseFile{
		FilePath:          fullPath,
		IsDir:             isDir,
		FileName:          fInfo.Name(),
		ModifiedTime:      fInfo.ModTime().Unix(),
		PlayableExtension: !isDir && utils.IsPlayableExtension(fInfo.Name()),
		VLRAttrs:          xattr.New(fullPath).VLRAttrs(),
	}
}

func newBrowseFilesFromFileInfos(dir string, fInfos []fs.FileInfo) []browseFile {
	files := []browseFile{}

	for _, f := range fInfos {
		files = append(files, newBrowseFile(dir, f))
	}

	return files
}

func newBrowseFilesFromDirEntries(dir string, entries []fs.DirEntry) []browseFile {
	fInfos := []fs.FileInfo{}
	for _, e := range entries {
		if !strings.HasPrefix(e.Name(), ".") {
			f, err := os.Stat(dir + "/" + e.Name())
			if err != nil {
				continue
			}
			fInfos = append(fInfos, f)
		}
	}

	return newBrowseFilesFromFileInfos(dir, fInfos)
}

func newBrowseFilesFromPaths(paths []string) []browseFile {
	files := []browseFile{}
	for _, path := range paths {
		f, err := os.Stat(path)
		if err != nil {
			continue
		}

		parentDir := filepath.Dir(path)
		files = append(files, newBrowseFile(parentDir, f))
	}

	return files
}

func validateDir(dir string) (bool, string) {
	if dir == "" {
		return false, "dir is required"
	}

	fInfo, err := os.Stat(dir)
	if err != nil {
		return false, "dir does not exist on filesystem"
	}

	if !fInfo.IsDir() {
		return false, "dir is not a dir"
	}

	return true, ""
}
