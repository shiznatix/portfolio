import shutil
from pathlib import Path

import rhpy
from config import Config

log = rhpy.logs('history')

def save_audio(*, tmp_path: Path | str, dest_file_name: Path | str):
	dest_path = Config.history_dir / dest_file_name
	shutil.copy(tmp_path, dest_path)
	size_b = rhpy.file_size(dest_path, 'b')
	size_mb = rhpy.round(rhpy.convert_size(size_b, 'mb'), 2)
	log.info(f'Saved file: {dest_file_name} ({size_mb}MB)')
	return dest_path, size_b

def run_cleanup_loop():
	while rhpy.running():
		log.info('Running history cleanup loop')
		try:
			files = sorted(Config.history_dir.glob('*.ogg'), key=lambda f: f.stat().st_mtime)
			file_count = len(files)

			if file_count > Config.history_max_items:
				files_to_delete = file_count - Config.history_max_items
				for file in files[:files_to_delete]:
					file.unlink()
					log.info(f'Deleted old file: {file.name}')
				log.info(f'Cleaned up {files_to_delete} old files')
		except Exception as e:
			log.error(f'Error in cleanup: {e}')
		rhpy.wait(300)
