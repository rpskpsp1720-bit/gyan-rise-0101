#!/usr/bin/env python3
"""
Generate all required app icons from the uploaded logo image.
Generates Android launcher icons, PWA icons, favicons, and adaptive icons.
"""

import os
import subprocess
from PIL import Image, ImageDraw
import json

# Input image
SOURCE_IMAGE = "/app/729566844_1038277455317687_4603145883188865134_n.jpg"

# Android icon configuration
ANDROID_ICONS = {
    'mdpi': {'size': 48, 'dpi': 160},
    'hdpi': {'size': 72, 'dpi': 240},
    'xhdpi': {'size': 96, 'dpi': 320},
    'xxhdpi': {'size': 144, 'dpi': 480},
    'xxxhdpi': {'size': 192, 'dpi': 640},
}

# PWA icon sizes
PWA_ICONS = {
    '192x192': 192,
    '256x256': 256,
    '384x384': 384,
    '512x512': 512,
}

# Favicon sizes
FAVICON_SIZES = {
    '16x16': 16,
    '32x32': 32,
    '192x192': 192,
}

def create_directory_structure():
    """Create necessary directory structures."""
    dirs = [
        '/app/frontend/public/icons',
        '/app/frontend/android/app/src/main/res/mipmap-mdpi',
        '/app/frontend/android/app/src/main/res/mipmap-hdpi',
        '/app/frontend/android/app/src/main/res/mipmap-xhdpi',
        '/app/frontend/android/app/src/main/res/mipmap-xxhdpi',
        '/app/frontend/android/app/src/main/res/mipmap-xxxhdpi',
        '/app/frontend/android/app/src/main/res/drawable',
    ]
    
    for dir_path in dirs:
        os.makedirs(dir_path, exist_ok=True)
        print(f"✓ Created/verified directory: {dir_path}")

def generate_android_icons():
    """Generate Android launcher icons for all densities."""
    print("\n📱 Generating Android launcher icons...")
    
    img = Image.open(SOURCE_IMAGE).convert('RGBA')
    
    for density, config in ANDROID_ICONS.items():
        size = config['size']
        # Square the icon for Android
        output = img.resize((size, size), Image.Resampling.LANCZOS)
        
        output_path = f'/app/frontend/android/app/src/main/res/mipmap-{density}/ic_launcher.png'
        output.save(output_path, 'PNG')
        print(f"✓ Generated {density}: {size}x{size} → {output_path}")

def generate_adaptive_icons():
    """Generate adaptive icons for Android (foreground + background)."""
    print("\n🎨 Generating adaptive icons...")
    
    img = Image.open(SOURCE_IMAGE).convert('RGBA')
    
    # Generate adaptive icon foreground (should be 1:1 at smaller size with safe area)
    # Android adaptive icons use 108dp as the canvas, but safe icon area is 72dp
    foreground_size = 108
    foreground = img.resize((foreground_size, foreground_size), Image.Resampling.LANCZOS)
    
    # Save foreground
    foreground_path = '/app/frontend/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png'
    foreground.save(foreground_path, 'PNG')
    print(f"✓ Generated adaptive icon foreground: {foreground_size}x{foreground_size}")
    
    # Create monochromatic version for background
    bg_color = (41, 128, 185)  # Professional blue color
    background = Image.new('RGBA', (foreground_size, foreground_size), bg_color + (255,))
    background_path = '/app/frontend/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_background.png'
    background.save(background_path, 'PNG')
    print(f"✓ Generated adaptive icon background: {foreground_size}x{foreground_size}")

def generate_pwa_icons():
    """Generate PWA icons."""
    print("\n📦 Generating PWA icons...")
    
    img = Image.open(SOURCE_IMAGE).convert('RGBA')
    
    for size_label, size in PWA_ICONS.items():
        output = img.resize((size, size), Image.Resampling.LANCZOS)
        
        output_path = f'/app/frontend/public/icons/icon-{size}.png'
        output.save(output_path, 'PNG')
        print(f"✓ Generated PWA icon: {size_label} → {output_path}")
    
    # Generate maskable icon (for progressive web apps)
    maskable = img.resize((512, 512), Image.Resampling.LANCZOS)
    maskable_path = '/app/frontend/public/icons/icon-maskable-512.png'
    maskable.save(maskable_path, 'PNG')
    print(f"✓ Generated maskable PWA icon: 512x512")

def generate_favicons():
    """Generate favicon files."""
    print("\n🔖 Generating favicons...")
    
    img = Image.open(SOURCE_IMAGE).convert('RGBA')
    
    # Generate favicon.ico (using the 32x32 version)
    ico_img = img.resize((32, 32), Image.Resampling.LANCZOS)
    ico_path = '/app/frontend/public/favicon.ico'
    ico_img.save(ico_path, 'ICO')
    print(f"✓ Generated favicon.ico: 32x32")
    
    # Generate PNG favicons
    for size_label, size in FAVICON_SIZES.items():
        output = img.resize((size, size), Image.Resampling.LANCZOS)
        
        output_path = f'/app/frontend/public/favicon-{size}.png'
        output.save(output_path, 'PNG')
        print(f"✓ Generated {size_label} favicon → {output_path}")
    
    # Apple touch icon
    apple_img = img.resize((180, 180), Image.Resampling.LANCZOS)
    apple_path = '/app/frontend/public/apple-touch-icon.png'
    apple_img.save(apple_path, 'PNG')
    print(f"✓ Generated apple-touch-icon.png: 180x180")

def update_manifest_json():
    """Update manifest.json with new icon references."""
    print("\n📄 Updating manifest.json...")
    
    manifest_path = '/app/frontend/public/manifest.json'
    
    with open(manifest_path, 'r') as f:
        manifest = json.load(f)
    
    # Update icons array
    manifest['icons'] = [
        {
            "src": "/icons/icon-192.png",
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "any"
        },
        {
            "src": "/icons/icon-192.png",
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "maskable"
        },
        {
            "src": "/icons/icon-256.png",
            "sizes": "256x256",
            "type": "image/png",
            "purpose": "any"
        },
        {
            "src": "/icons/icon-384.png",
            "sizes": "384x384",
            "type": "image/png",
            "purpose": "any"
        },
        {
            "src": "/icons/icon-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any"
        },
        {
            "src": "/icons/icon-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "maskable"
        }
    ]
    
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"✓ Updated manifest.json with new icon references")

def generate_splash_xml():
    """Generate Android splash screen XML."""
    print("\n💦 Generating Android splash screen...")
    
    splash_xml = '''<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Background color -->
    <item
        android:drawable="@color/background_color"/>
    
    <!-- App logo centered -->
    <item
        android:gravity="center"
        android:drawable="@mipmap/ic_launcher"
        android:width="192dp"
        android:height="192dp"/>
</layer-list>
'''
    
    splash_path = '/app/frontend/android/app/src/main/res/drawable/splash.xml'
    with open(splash_path, 'w') as f:
        f.write(splash_xml)
    
    print(f"✓ Generated splash.xml")

def verify_all_files():
    """Verify all generated files exist."""
    print("\n✅ Verifying generated files...")
    
    files_to_check = [
        # Favicons
        '/app/frontend/public/favicon.ico',
        '/app/frontend/public/favicon-16.png',
        '/app/frontend/public/favicon-32.png',
        '/app/frontend/public/apple-touch-icon.png',
        # PWA icons
        '/app/frontend/public/icons/icon-192.png',
        '/app/frontend/public/icons/icon-256.png',
        '/app/frontend/public/icons/icon-384.png',
        '/app/frontend/public/icons/icon-512.png',
        '/app/frontend/public/icons/icon-maskable-512.png',
        # Android icons
        '/app/frontend/android/app/src/main/res/mipmap-mdpi/ic_launcher.png',
        '/app/frontend/android/app/src/main/res/mipmap-hdpi/ic_launcher.png',
        '/app/frontend/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png',
        '/app/frontend/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png',
        '/app/frontend/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
        '/app/frontend/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png',
        '/app/frontend/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_background.png',
        # Splash
        '/app/frontend/android/app/src/main/res/drawable/splash.xml',
    ]
    
    all_exist = True
    for file_path in files_to_check:
        if os.path.exists(file_path):
            size = os.path.getsize(file_path)
            print(f"  ✓ {file_path} ({size} bytes)")
        else:
            print(f"  ✗ MISSING: {file_path}")
            all_exist = False
    
    return all_exist

def main():
    """Main execution function."""
    print("🚀 Starting icon generation process...\n")
    
    if not os.path.exists(SOURCE_IMAGE):
        print(f"❌ ERROR: Source image not found at {SOURCE_IMAGE}")
        return False
    
    try:
        create_directory_structure()
        generate_android_icons()
        generate_adaptive_icons()
        generate_pwa_icons()
        generate_favicons()
        update_manifest_json()
        generate_splash_xml()
        
        if verify_all_files():
            print("\n✅ All icons generated successfully!")
            return True
        else:
            print("\n⚠️  Some files are missing!")
            return False
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
