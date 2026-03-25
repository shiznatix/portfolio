import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

export default defineConfig(
	eslint.configs.recommended,
	tseslint.configs.recommended,
	{
		rules: {
			'@typescript-eslint/ban-ts-comment': 'off',
		},
	},
	{
		plugins: { 'simple-import-sort': simpleImportSort },
		rules: {
			'simple-import-sort/imports': 'error',
			'simple-import-sort/exports': 'error',
		},
	},
	{
		rules: {
			'no-restricted-imports': ['error', {
				paths: [
					{
						name: '@mui/material',
						message: 'Use direct imports instead, e.g. import Button from "@mui/material/Button"',
					},
					{
						name: '@mui/icons-material',
						message: 'Use direct imports instead, e.g. import AddIcon from "@mui/icons-material/Add"',
					},
				],
			}],
		},
	},
);
