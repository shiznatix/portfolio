package hdmicec

import (
	"context"
	"shiznatix/vlr/colors"
	"shiznatix/vlr/logger"
	"sync"
	"time"
)

type Status struct {
	Connected bool   `json:"connected"`
	Power     string `json:"power"`
}

type HDMICEC struct {
	ctx         context.Context
	log         logger.Logger
	tvAddress   string
	syncStarted bool
	conn        *connection
}

type Config struct {
	Ctx       context.Context
	TVAddress string
}

func New(c Config) HDMICEC {
	hc := HDMICEC{
		ctx:         c.Ctx,
		log:         logger.Get("hdmi-cec", colors.LoggerHDMICECColor),
		tvAddress:   c.TVAddress,
		syncStarted: false,
		conn: &connection{
			mutex:  &sync.Mutex{},
			ctx:    c.Ctx,
			log:    logger.Get("hdmi-cec-conn", colors.LoggerHDMICECConnectionColor),
			rawLog: logger.NewQueue(),
		},
	}

	hc.keepConnection()

	return hc
}

func (hc *HDMICEC) keepConnection() {
	if hc.tvAddress == "" {
		hc.log.Error("refusing to start hdmi-cec connection, no tv address supplied")
		return
	}

	if hc.syncStarted {
		return
	}

	hc.syncStarted = true

	go func() {
		if err := hc.conn.connect(); err != nil {
			hc.log.Err(err, "failed initial connect")
		} else {
			hc.log.Info("initial connect established")
		}

		ticker := time.NewTicker(5 * time.Second)

		for {
			select {
			case <-hc.ctx.Done():
				hc.log.Info("stopping hdmi-cec worker")
				if err := hc.conn.disconnect(); err != nil {
					hc.log.Err(err, "failed to disconnect")
				}
				ticker.Stop()
				return
			case <-ticker.C:
				if hc.conn.readyForInput() {
					break
				}

				if err := hc.conn.connect(); err != nil {
					hc.log.Err(err, "failed to connect")
				}
			}
		}
	}()
}

func (hc HDMICEC) On() error {
	return hc.conn.write("on " + hc.tvAddress)
}

func (hc HDMICEC) Off() error {
	return hc.conn.write("standby " + hc.tvAddress)
}

func (hc HDMICEC) VolUp() error {
	return hc.conn.write("volup")
}

func (hc HDMICEC) VolDown() error {
	return hc.conn.write("voldown")
}

func (hc HDMICEC) Mute() error {
	return hc.conn.write("mute")
}

func (hc HDMICEC) Status() (Status, error) {
	s := Status{
		Connected: hc.conn.readyForInput(),
	}

	if s.Connected {
		if err := hc.conn.write("pow " + hc.tvAddress); err != nil {
			return s, err
		}

		pow := hc.conn.getLogLine("power status: ")

		s.Power = pow
	}

	return s, nil
}
