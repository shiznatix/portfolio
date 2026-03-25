package missingeps

import (
	"bytes"
	"encoding/json"
	"shiznatix/vlr/utils"
	"time"
)

type vlrSearchBody struct {
	URL         string `json:"url"`
	SearchStr   string `json:"search_str"`
	ResMatchStr string `json:"result_match_str"`
	MaxResults  int    `json:"max_results"`
}
type vlrSearchResultEntry struct {
	FileName   string `json:"fileName"`
	Seeders    int    `json:"seeders"`
	FileSize   string `json:"fileSize"`
	MagnetLink string `json:"magnetLink"`
}
type vlrSearchResult struct {
	Success bool                   `json:"success"`
	Results []vlrSearchResultEntry `json:"results"`
}

func vlrSearch(url string, body vlrSearchBody) ([]vlrSearchResultEntry, error) {
	jBody, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	b, err := utils.HTTPPost(url, jBody, 2*time.Minute)
	if err != nil {
		return nil, err
	}

	j := json.NewDecoder(bytes.NewReader(b))
	res := vlrSearchResult{}
	err = j.Decode(&res)
	if err != nil {
		return nil, err
	}

	return res.Results, nil
}
