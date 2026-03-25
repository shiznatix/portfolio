package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type MasterServer struct {
	Host string
}

type vlrResponse struct {
	Data interface{} `json:"data"`
}

func NewMasterServer(host string) MasterServer {
	return MasterServer{
		Host: host,
	}
}

func (ms MasterServer) IsMaster() bool {
	return ms.Host == ""
}

func (ms MasterServer) SetDBSyncConfig(dbConf *DBConfig, remoteDBName string) {
	if ms.Host == "" {
		if dbConf.SyncEveryFunc == nil {
			dbConf.SyncEvery = 5 * time.Minute
		}
	} else {
		dbConf.RemoteURL = fmt.Sprintf("http://%s/api/databases/%s", ms.Host, remoteDBName)
		dbConf.SyncEvery = 1 * time.Minute
	}
}

func (ms MasterServer) ForwardRequest(r *http.Request, body interface{}, localFunc func() (interface{}, error)) (interface{}, error) {
	if ms.Host == "" {
		if localFunc != nil {
			return localFunc()
		}

		return nil, nil
	}

	var data interface{}
	var reqBody io.Reader

	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewReader(b)
	}

	url := fmt.Sprintf("http://%s%s", ms.Host, r.URL)
	req, err := http.NewRequest(r.Method, url, reqBody)
	if err != nil {
		return data, err
	}

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return data, err
	}

	if res.StatusCode < 200 && res.StatusCode > 299 {
		return data, fmt.Errorf("non 2xx status code:'%d'", res.StatusCode)
	}

	b, err := io.ReadAll(res.Body)
	if err != nil {
		return data, err
	}

	tmp := vlrResponse{
		Data: b,
	}
	if err := json.Unmarshal(b, &tmp); err != nil {
		return data, err
	}

	return tmp.Data, nil
}
