import { sysdService } from '../../core/service/service-factory';

const UNIT_TEMPLATE = `
[Unit]
Description=Hide Console Cursor on tty1
After=getty@tty1.service

[Service]
Type=oneshot
RemainAfterExit=yes
# ASCII escape code to hide the cursor (sleep gives getty time to finish rendering)
ExecStart=/bin/sh -c 'sleep 2 && echo -e "\\033[?25l" > /dev/tty1'

[Install]
WantedBy=multi-user.target
`;

export default sysdService()({
	isInstallDir: true,
	name: 'hide-cursor',
	unitFileTemplate: UNIT_TEMPLATE,
})();
