import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const iconsDir = path.join(__dirname, '../public/icons')

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

// Create SVG icon with shopping cart design
const svgIcon = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Background with rounded corners -->
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f766e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#115e56;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <rect width="512" height="512" fill="url(#bgGradient)" rx="90"/>
  
  <!-- Shopping cart icon - centered and prominent -->
  <g transform="translate(256, 256)">
    <!-- Cart body (main rectangle) -->
    <path d="M -110 -50 L -100 90 Q -100 110 -80 110 L 110 110 Q 130 110 130 90 L 140 -50 Z" 
          fill="none" stroke="white" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Cart handle (arc at top) -->
    <path d="M -80 -50 Q -80 -150 80 -150" 
          fill="none" stroke="white" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Product items inside cart (3 simple lines) -->
    <line x1="-80" y1="20" x2="100" y2="20" stroke="white" stroke-width="14" stroke-linecap="round"/>
    <line x1="-70" y1="55" x2="95" y2="55" stroke="white" stroke-width="14" stroke-linecap="round" opacity="0.8"/>
    
    <!-- Wheels -->
    <circle cx="-50" cy="130" r="18" fill="white"/>
    <circle cx="90" cy="130" r="18" fill="white"/>
  </g>
  
  <!-- Subtle highlight effect -->
  <rect width="512" height="512" fill="white" opacity="0.05" rx="90"/>
</svg>`

// Save base SVG
const svgPath = path.join(iconsDir, 'icon.svg')
fs.writeFileSync(svgPath, svgIcon)
console.log('✓ Created icon.svg')

// Generate PNG icons in different sizes
const sizes = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
]

// Generate maskable variants (for Android Adaptive Icons)
const maskableSizes = [
  { size: 192, name: 'icon-maskable-192x192.png' },
  { size: 512, name: 'icon-maskable-512x512.png' },
]

;(async () => {
  try {
    console.log('📦 Generating PWA icons from SVG...\n')

    // Generate standard icons
    for (const { size, name } of sizes) {
      await sharp(Buffer.from(svgIcon))
        .resize(size, size, {
          fit: 'cover',
          position: 'center',
        })
        .png()
        .toFile(path.join(iconsDir, name))
      console.log(`✓ Generated ${name}`)
    }

    console.log()

    // Generate maskable icons (slightly smaller content for safe area)
    const maskableSvg = `<svg width="512" height="512" viewBox="30 30 452 452" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f766e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#115e56;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <rect width="512" height="512" fill="url(#bgGradient)" rx="90"/>
  
  <g transform="translate(256, 256)">
    <path d="M -110 -50 L -100 90 Q -100 110 -80 110 L 110 110 Q 130 110 130 90 L 140 -50 Z" 
          fill="none" stroke="white" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    
    <path d="M -80 -50 Q -80 -150 80 -150" 
          fill="none" stroke="white" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    
    <line x1="-80" y1="20" x2="100" y2="20" stroke="white" stroke-width="14" stroke-linecap="round"/>
    <line x1="-70" y1="55" x2="95" y2="55" stroke="white" stroke-width="14" stroke-linecap="round" opacity="0.8"/>
    
    <circle cx="-50" cy="130" r="18" fill="white"/>
    <circle cx="90" cy="130" r="18" fill="white"/>
  </g>
  
  <rect width="512" height="512" fill="white" opacity="0.05" rx="90"/>
</svg>`

    for (const { size, name } of maskableSizes) {
      await sharp(Buffer.from(maskableSvg))
        .resize(size, size, {
          fit: 'cover',
          position: 'center',
        })
        .png()
        .toFile(path.join(iconsDir, name))
      console.log(`✓ Generated ${name} (maskable)`)
    }

    console.log()
    console.log('✅ All PWA icons generated successfully!')
    console.log('📁 Icons saved to: public/icons/')
  } catch (error) {
    console.error('❌ Error generating icons:', error.message)
    console.error('\n⚠️  Make sure you have sharp installed:')
    console.error('   npm install --save-dev sharp')
    process.exit(1)
  }
})()
