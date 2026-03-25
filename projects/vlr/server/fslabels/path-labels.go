package fslabels

import (
	"context"
	"shiznatix/vlr/utils"
)

type pathLabels struct {
	utils.DBRecord
	Path   string   `json:"path"`
	Labels []string `json:"labels"`
}

func newPathLabels(ctx context.Context, path string, labels []string) pathLabels {
	return pathLabels{
		DBRecord: utils.DBRecord{
			ID: utils.NewDBKey(path),
		},
		Path:   path,
		Labels: labels,
	}
}
