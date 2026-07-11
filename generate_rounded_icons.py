#!/usr/bin/env python3
"""
Generate rounded icons and adaptive icon XML configurations.
"""

import os
from PIL import Image, ImageDraw

# Source paths
ICON_SOURCE = '/app/729566844_1038277455317687_4603145883188865134_n.jpg'

def generate_rounded_icons():
    """Generate rounded launcher icons for all Android densities."""
    print("\n🔵 Generating rounded launcher icons...")
    
    densities = {
        'mdpi': 48,
        'hdpi': 72,
        'xhdpi': 96,
        'xxhdpi': 144,
        'xxxhdpi': 192,
    }
    
    img = Image.open(ICON_SOURCE).convert('RGBA')
    
    for density, size in densities.items():
        # Resize the image
        rounded = img.resize((size, size), Image.Resampling.LANCZOS)
        
        # Create circular mask
        mask = Image.new('L', (size, size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size, size), fill=255)
        
        # Apply circular mask
        rounded_output = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        rounded_output.paste(rounded, (0, 0), mask)
        
        output_path = f'/app/frontend/android/app/src/main/res/mipmap-{density}/ic_launcher_round.png'
        rounded_output.save(output_path, 'PNG')
        print(f"✓ Generated rounded {density}: {size}x{size}")

def create_adaptive_icon_xml():
    """Create adaptive icon XML configuration."""
    print("\n📱 Creating adaptive icon XML...")
    
    # Create or update ic_launcher.xml (adaptive icon definition)
    launcher_xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'''
    
    launcher_path = '/app/frontend/android/app/src/main/res/mipmap/ic_launcher.xml'
    os.makedirs('/app/frontend/android/app/src/main/res/mipmap', exist_ok=True)
    
    with open(launcher_path, 'w') as f:
        f.write(launcher_xml)
    print(f"✓ Created adaptive icon XML at {launcher_path}")

def create_background_color_xml():
    """Create background color for adaptive icons."""
    print("\n🎨 Creating adaptive icon background color...")
    
    background_xml = '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#2980B9</color>
</resources>
'''
    
    bg_path = '/app/frontend/android/app/src/main/res/values/ic_launcher_background.xml'
    os.makedirs('/app/frontend/android/app/src/main/res/values', exist_ok=True)
    
    with open(bg_path, 'w') as f:
        f.write(background_xml)
    print(f"✓ Created background color XML")

def main():
    """Main execution."""
    print("🚀 Generating rounded icons and adaptive icon configurations...\n")
    
    try:
        generate_rounded_icons()
        create_adaptive_icon_xml()
        create_background_color_xml()
        print("\n✅ Rounded icons and adaptive icon configs created successfully!")
        return True
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
