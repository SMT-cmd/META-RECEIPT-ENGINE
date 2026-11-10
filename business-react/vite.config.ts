import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins:[react()],
  base:'/business/',
  build:{
    outDir:'../business',
    emptyOutDir:false,
    assetsDir:'assets',
    sourcemap:false
  }
});
