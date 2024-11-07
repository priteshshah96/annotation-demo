{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "builds": [
    {
      "src": "src/api/**/*.js",
      "use": "@vercel/node"
    },
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "zeroConfig": true }
    }
  ],
  "rewrites": [
    { 
      "source": "/api/files/upload",
      "destination": "/src/api/files/upload.js"
    },
    {
      "source": "/api/files/:fileId",
      "destination": "/src/api/files/[fileId].js"
    },
    {
      "source": "/api/annotations/:fileId",
      "destination": "/src/api/annotations/[fileId].js"
    },
    {
      "source": "/(.*)",
      "destination": "/dist/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,PUT,DELETE,OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        { "key": "Access-Control-Allow-Credentials", "value": "true" }
      ]
    }
  ]
}