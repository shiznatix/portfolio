package utils

import (
	"bufio"
	"io"
	"os/exec"
)

func ReadCommandPipe(pipe func() (io.ReadCloser, error), msgHandler func(string)) error {
	stream, err := pipe()
	if err != nil {
		return err
	}

	go func() {
		scanner := bufio.NewScanner(stream)
		for scanner.Scan() {
			msgHandler(scanner.Text())
		}
	}()

	return nil
	// stderr, err := p.cmd.StderrPipe()
	// if err != nil {
	// 	return err
	// }
}

func ReadCommandPipes(cmd *exec.Cmd, msgHandler func(string)) error {
	if err := ReadCommandPipe(cmd.StdoutPipe, msgHandler); err != nil {
		return err
	}
	if err := ReadCommandPipe(cmd.StderrPipe, msgHandler); err != nil {
		return err
	}

	return nil
}
