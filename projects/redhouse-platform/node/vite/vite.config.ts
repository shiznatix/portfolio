import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default (appRoot: string = process.cwd()) => defineConfig({
	plugins: [react()],
	resolve: {
		dedupe: ['react', 'react-dom'],
	},
	build: {
		outDir: path.resolve(appRoot, 'public'),
		emptyOutDir: true,
	}
})
