import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@engine': path.resolve(__dirname, './src/engine'),
            '@ui': path.resolve(__dirname, './src/ui'),
            '@store': path.resolve(__dirname, './src/store'),
            '@utils': path.resolve(__dirname, './src/utils'),
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    three: ['three'],
                    react: ['react', 'react-dom'],
                },
            },
        },
    },
    server: {
        port: 3000,
        strictPort: true,
    },
});
