import { desktopService } from '../../core/service/service-factory';

export type BrowserKioskProps = {
	url: string;
	icon?: string;
	kioskMode?: boolean;
};

const UNIT_FILE_TEMPLATE = `[Desktop Entry]
Version=0.0.1
Type=Application
Name=BrowserKiosk
# remove the "Singleton*" lock, this lock can cause problems and we don't really care about a profile
Exec=sh -c "rm -rf ~/.config/chromium/Singleton*; until ping -c 1 -W 2 $(echo '{{URL}}' | sed 's|.*://\\([^/]*\\).*|\\1|') > /dev/null 2>&1; do sleep 10; done; chromium {{FLAGS}}"
Icon={{ICON}}
`;

export default desktopService<BrowserKioskProps>()({
	name: 'browser-kiosk',
})(Base => class extends Base {
	unitFileTemplate = UNIT_FILE_TEMPLATE;
	unitFileReplacements = {
		URL: this.props.url.toString(),
		FLAGS: [
			'--start-maximized',
			'--hide-scrollbars',
			'--password-store=basic',
			`--app=${this.props.url}`,
			this.props.kioskMode && '--kiosk',
		].filter(Boolean).join(' '),
		ICON: this.props.icon || 'applications-multimedia',
	};
});
