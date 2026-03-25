package systm

import (
	"context"
	"os/exec"
	"shiznatix/vlr/colors"
	"shiznatix/vlr/logger"
)

type System struct {
	ctx    context.Context
	log    logger.Logger
	cancel context.CancelFunc
}

type Config struct {
	Ctx    context.Context
	Cancel context.CancelFunc
}

func New(c Config) System {
	return System{
		ctx:    c.Ctx,
		log:    logger.Get("system", colors.LoggerSystemColor),
		cancel: c.Cancel,
	}
}

func (s System) Close() {
	s.log.Info("closing system via context cancel")
	s.cancel()
}

func (s System) Vol() (int, error) {
	return 0, nil
}

func (s System) SetVol(percent int) error {
	// TODO finish
	// https://www.baeldung.com/linux/volume-level-command-line
	// amixer
	return nil
}

func (s System) Reboot() error {
	return exec.Command("sudo", "reboot").Run()
}
