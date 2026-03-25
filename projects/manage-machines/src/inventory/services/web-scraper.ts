import { stackService } from '../../core/service/service-factory';

export type WebScraperProps = {
	marionetteHost?: string;
	ports?: {
		http?: number;
		marionette?: number;
	};
};

const DESKTOP_UNIT_TEMPLATE = `[Desktop Entry]
Version=0.0.1
Type=Application
Name=Web Scraper Firefox
Icon=go-home-symbolic
Exec=systemd-run --user --scope --unit=web-scraper-firefox firefox --marionette --remote-allow-system-access
`;

export default stackService<WebScraperProps>()({
	name: 'web-scraper',
	props: {
		marionetteHost: '127.0.0.1',
	},
	ports: {
		http: 7245,
		marionette: 2828,
	},
})

.sysd('web-scraper', {
	isDirMaster: true,
	isDev: true,
	isPython: true,
	configJson: true,
	unitFileTemplate: 'service',
	unitStartAfter: 'graphical-session.target',
})
(Base => class extends Base {
})

.desktop('web-scraper-firefox', {
	unitFileTemplate: DESKTOP_UNIT_TEMPLATE,
})
(Base => class extends Base {
})

.build()();
