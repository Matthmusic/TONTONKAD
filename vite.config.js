import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'

const projectRoot = process.cwd()

// Plugin pour servir un dossier du projet sous un préfixe URL donné
function serveDir(urlPrefix, dirPath) {
  const ext2mime = {
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.csv': 'text/plain; charset=utf-8',
    '.json': 'application/json',
  }
  return {
    name: `serve-dir-${urlPrefix.replace(/\//g, '-')}`,
    configureServer(server) {
      server.middlewares.use(urlPrefix, (req, res, next) => {
        const filePath = path.join(dirPath, req.url.replace(/^\//, ''))
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const mime = ext2mime[path.extname(filePath)] || 'application/octet-stream'
          res.setHeader('Content-Type', mime)
          fs.createReadStream(filePath).pipe(res)
        } else {
          next()
        }
      })
    }
  }
}

export default defineConfig({
  root: 'src/renderer',
  server: {
    port: 5173,
    open: true,
  },
  plugins: [
    // Sert /assets/ depuis le dossier assets/ à la racine du projet
    serveDir('/assets', path.join(projectRoot, 'assets')),
    // Sert /data/ depuis le dossier data/ à la racine du projet
    serveDir('/data', path.join(projectRoot, 'data')),
  ],
})
