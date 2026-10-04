import os
import math
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import imageio_ffmpeg

# Paths
PUBLIC_DIR = os.path.join(os.getcwd(), "frontend", "public")
LOGO_PATH = os.path.join(PUBLIC_DIR, "foodsaver_logo.png")
FOOD_IMG_1 = os.path.join(PUBLIC_DIR, "cinematic_south_indian_meal.jpg")
FOOD_IMG_2 = os.path.join(PUBLIC_DIR, "cinematic_fresh_food.jpg")

FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()

# Try loading fonts
def get_font(size, bold=False):
    font_names = ["arialbd.ttf" if bold else "arial.ttf", "segoeui.ttf", "dejavusans.ttf"]
    for font_name in font_names:
        try:
            return ImageFont.truetype(font_name, size)
        except Exception:
            continue
    return ImageFont.load_default()

def draw_rounded_rectangle(draw, xy, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

def create_glass_card(width, height, bg_color=(30, 41, 59, 200), border_color=(255, 255, 255, 40), radius=20):
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, width - 1, height - 1], radius=radius, fill=bg_color, outline=border_color, width=2)
    return img

def render_frame(frame_idx, total_frames, width, height, logo_img, food1_img, food2_img):
    fps = 30
    time_sec = frame_idx / fps
    img = Image.new("RGBA", (width, height), (15, 23, 42, 255)) # Slate 900
    draw = ImageDraw.Draw(img)

    is_portrait = height > width

    # Background Ambient Radial Glows (Emerald & Amber)
    glow1_x = int(width * 0.3 + math.sin(time_sec * 1.5) * 40)
    glow1_y = int(height * 0.4 + math.cos(time_sec * 1.2) * 40)
    glow2_x = int(width * 0.7 + math.cos(time_sec * 1.5) * 40)
    glow2_y = int(height * 0.6 + math.sin(time_sec * 1.2) * 40)

    # Simple background gradient / glow spots
    for r in range(120, 0, -10):
        alpha = int(15 * (r / 120))
        draw.ellipse([glow1_x - r * 3, glow1_y - r * 3, glow1_x + r * 3, glow1_y + r * 3], fill=(16, 185, 129, alpha))
        draw.ellipse([glow2_x - r * 3, glow2_y - r * 3, glow2_x + r * 3, glow2_y + r * 3], fill=(245, 158, 11, alpha))

    # Scene Routing
    # Scene 1: 0.0s - 1.8s (frames 0 - 54) -> Logo + Intro
    # Scene 2: 1.8s - 3.8s (frames 54 - 114) -> Day Mode Ordering
    # Scene 3: 3.8s - 5.8s (frames 114 - 174) -> Night Mode Surplus Rescue
    # Scene 4: 5.8s - 7.5s (frames 174 - 225) -> NGO Food Rescue
    # Scene 5: 7.5s - 9.0s (frames 225 - 270) -> Real Stats Dashboard
    # Scene 6: 9.0s - 10.0s (frames 270 - 300) -> Outro & CTA

    font_title = get_font(int(height * 0.045), bold=True)
    font_sub = get_font(int(height * 0.028), bold=False)
    font_badge = get_font(int(height * 0.022), bold=True)
    font_caption = get_font(int(height * 0.026), bold=True)

    caption_text = ""

    if time_sec < 1.8:
        # --- SCENE 1: INTRO LOGO & TAGLINE ---
        caption_text = "FoodSaver Direct Connect: Great food. Zero waste."
        t_prog = min(1.0, time_sec / 1.0)
        scale = 0.8 + 0.2 * math.sin(t_prog * math.pi / 2)
        
        logo_w = int((width * 0.25 if is_portrait else height * 0.25) * scale)
        logo_resized = logo_img.resize((logo_w, logo_w), Image.Resampling.LANCZOS)
        
        lx = (width - logo_w) // 2
        ly = (height - logo_w) // 2 - int(height * 0.08)
        img.paste(logo_resized, (lx, ly), logo_resized)

        # Title
        t_str = "FoodSaver Direct Connect"
        draw.text((width // 2, ly + logo_w + 30), t_str, font=font_title, fill=(255, 255, 255, 255), anchor="mm")
        
        # Subtitle
        s_str = "Great food. Zero waste."
        draw.text((width // 2, ly + logo_w + 80), s_str, font=font_sub, fill=(16, 185, 129, 255), anchor="mm")

        # Location Tag
        loc_str = "📍 Tamil Nadu • 38 Districts"
        draw.text((width // 2, ly + logo_w + 120), loc_str, font=font_badge, fill=(245, 158, 11, 255), anchor="mm")

    elif time_sec < 3.8:
        # --- SCENE 2: DAY MODE ORDERING ---
        caption_text = "DAY MODE: Order fresh meals & collect parcel when ready"
        
        # Header Badge
        badge_card = create_glass_card(int(width * 0.7), 60, (16, 185, 129, 40), (16, 185, 129, 120))
        img.paste(badge_card, ((width - int(width * 0.7)) // 2, int(height * 0.08)), badge_card)
        draw.text((width // 2, int(height * 0.08) + 30), "☀️ DAY MODE • Regular Food Ordering", font=font_badge, fill=(52, 211, 153, 255), anchor="mm")

        # Mockup Container (Phone view)
        mw = int(width * 0.75 if is_portrait else width * 0.35)
        mh = int(height * 0.55 if is_portrait else height * 0.65)
        mx = (width - mw) // 2
        my = int(height * 0.18)

        mockup_glass = create_glass_card(mw, mh, (30, 41, 59, 230), (52, 211, 153, 100))
        img.paste(mockup_glass, (mx, my), mockup_glass)

        # Draw Hotel Card Inside Mockup
        draw.text((mx + 30, my + 30), "Hotel Saravana Bhavan", font=font_sub, fill=(255, 255, 255, 255))
        draw.text((mx + 30, my + 65), "Chennai • South Indian • ⭐ 4.8", font=get_font(int(height * 0.018)), fill=(148, 163, 184, 255))

        # Food Thumbnail
        fw = mw - 60
        fh = int(mh * 0.4)
        food_thumb = food1_img.resize((fw, fh), Image.Resampling.LANCZOS)
        img.paste(food_thumb, (mx + 30, my + 100))

        draw.text((mx + 30, my + 110 + fh), "Special South Indian Thali", font=font_badge, fill=(255, 255, 255, 255))
        draw.text((mx + 30, my + 140 + fh), "₹180 • Freshly Prepared", font=get_font(int(height * 0.02), bold=True), fill=(52, 211, 153, 255))

        # Notification Popup Banner at 2.8s
        if time_sec >= 2.6:
            notif_w = int(width * 0.85 if is_portrait else width * 0.5)
            notif_card = create_glass_card(notif_w, 80, (16, 185, 129, 230), (255, 255, 255, 150))
            nx = (width - notif_w) // 2
            ny = int(height * 0.72)
            img.paste(notif_card, (nx, ny), notif_card)

            draw.text((nx + 30, ny + 25), "🔔 ORDER READY FOR PICKUP!", font=font_badge, fill=(255, 255, 255, 255))
            draw.text((nx + 30, ny + 50), "Token: FS-88291A • Collect at counter", font=get_font(int(height * 0.018)), fill=(241, 245, 249, 255))

    elif time_sec < 5.8:
        # --- SCENE 3: NIGHT MODE SURPLUS RESCUE ---
        caption_text = "NIGHT MODE: Live surplus deals at huge discounts"
        
        # Header Badge
        badge_card = create_glass_card(int(width * 0.7), 60, (245, 158, 11, 40), (245, 158, 11, 120))
        img.paste(badge_card, ((width - int(width * 0.7)) // 2, int(height * 0.08)), badge_card)
        draw.text((width // 2, int(height * 0.08) + 30), "🌙 NIGHT MODE • Surplus Food Rescue", font=font_badge, fill=(251, 191, 36, 255), anchor="mm")

        # Laptop + Phone Mockup View
        mw = int(width * 0.8 if is_portrait else width * 0.45)
        mh = int(height * 0.55 if is_portrait else height * 0.65)
        mx = (width - mw) // 2
        my = int(height * 0.18)

        mockup_glass = create_glass_card(mw, mh, (30, 41, 59, 230), (245, 158, 11, 100))
        img.paste(mockup_glass, (mx, my), mockup_glass)

        draw.text((mx + 30, my + 30), "Anjappar Chettinad Restaurant", font=font_sub, fill=(255, 255, 255, 255))
        draw.text((mx + 30, my + 65), "Madurai • Chettinad Surplus • ⭐ 4.7", font=get_font(int(height * 0.018)), fill=(148, 163, 184, 255))

        fw = mw - 60
        fh = int(mh * 0.4)
        food_thumb = food2_img.resize((fw, fh), Image.Resampling.LANCZOS)
        img.paste(food_thumb, (mx + 30, my + 100))

        # Discount Badge Over Thumbnail
        disc_glass = create_glass_card(140, 45, (225, 29, 72, 230), (255, 255, 255, 100), radius=10)
        img.paste(disc_glass, (mx + 45, my + 115), disc_glass)
        draw.text((mx + 115, my + 137), "60% OFF", font=get_font(int(height * 0.022), bold=True), fill=(255, 255, 255, 255), anchor="mm")

        # Countdown & Price
        draw.text((mx + 30, my + 110 + fh), "Special Chicken Biryani Surplus", font=font_badge, fill=(255, 255, 255, 255))
        
        # Countdown simulation
        secs_left = max(10, 1800 - int((time_sec - 3.8) * 300))
        mins = secs_left // 60
        secs = secs_left % 60
        timer_str = f"⏳ {mins:02d}:{secs:02d} left • 4 portions remaining"
        draw.text((mx + 30, my + 140 + fh), timer_str, font=get_font(int(height * 0.018), bold=True), fill=(251, 191, 36, 255))

        draw.text((mx + 30, my + 170 + fh), "Original: ₹220  👉  NOW ₹88", font=get_font(int(height * 0.022), bold=True), fill=(52, 211, 153, 255))

    elif time_sec < 7.5:
        # --- SCENE 4: NGO FREE DONATION HANDOFF ---
        caption_text = "NGO RELIEF: Unsold surplus automatically offered free to NGOs"
        
        # Header Badge
        badge_card = create_glass_card(int(width * 0.7), 60, (59, 130, 246, 40), (59, 130, 246, 120))
        img.paste(badge_card, ((width - int(width * 0.7)) // 2, int(height * 0.08)), badge_card)
        draw.text((width // 2, int(height * 0.08) + 30), "🤝 NGO RELIEF QUEUE • Zero Food Waste", font=font_badge, fill=(96, 165, 250, 255), anchor="mm")

        mw = int(width * 0.8 if is_portrait else width * 0.5)
        mh = int(height * 0.5)
        mx = (width - mw) // 2
        my = int(height * 0.22)

        ngo_card = create_glass_card(mw, mh, (30, 41, 59, 230), (96, 165, 250, 100))
        img.paste(ngo_card, (mx, my), ngo_card)

        draw.text((mx + 30, my + 40), "Anbu Trust Foundation NGO", font=font_sub, fill=(255, 255, 255, 255))
        draw.text((mx + 30, my + 80), "📍 Kovilpatti, Thoothukudi District", font=get_font(int(height * 0.02)), fill=(148, 163, 184, 255))
        
        draw.text((mx + 30, my + 130), "🎁 Claimed Bulk Surplus: 25 Meals Rescued", font=get_font(int(height * 0.022), bold=True), fill=(52, 211, 153, 255))
        draw.text((mx + 30, my + 170), "Status: Verified Free Community Donation", font=get_font(int(height * 0.02)), fill=(251, 191, 36, 255))
        
        cert_badge = create_glass_card(mw - 60, 50, (16, 185, 129, 60), (16, 185, 129, 150), radius=10)
        img.paste(cert_badge, (mx + 30, my + 210), cert_badge)
        draw.text((mx + mw // 2, my + 235), "📜 Verified Food Saver Certificate Generated", font=get_font(int(height * 0.018), bold=True), fill=(255, 255, 255, 255), anchor="mm")

    elif time_sec < 9.0:
        # --- SCENE 5: AUTHENTIC IMPACT STATS ---
        caption_text = "REAL IMPACT: 38 Districts • 86 Hotels • 345+ Listings"
        
        draw.text((width // 2, int(height * 0.12)), "REAL PLATFORM IMPACT", font=font_title, fill=(255, 255, 255, 255), anchor="mm")
        draw.text((width // 2, int(height * 0.17)), "Powering Zero Waste Across Tamil Nadu", font=font_sub, fill=(16, 185, 129, 255), anchor="mm")

        # 3 Stats Cards
        card_w = int(width * 0.85 if is_portrait else width * 0.26)
        card_h = int(height * 0.22 if is_portrait else height * 0.45)
        
        stats_data = [
            ("38", "TAMIL NADU", "DISTRICTS", (16, 185, 129)),
            ("86", "VERIFIED", "HOTELS", (245, 158, 11)),
            ("345+", "SURPLUS MEALS", "RESCUED", (59, 130, 246))
        ]

        if is_portrait:
            for i, (val, sub1, sub2, col) in enumerate(stats_data):
                cx = (width - card_w) // 2
                cy = int(height * 0.25) + i * (card_h + 20)
                scard = create_glass_card(card_w, card_h, (30, 41, 59, 230), col + (120,), radius=15)
                img.paste(scard, (cx, cy), scard)

                draw.text((cx + card_w // 2, cy + 45), val, font=get_font(int(height * 0.05), bold=True), fill=col + (255,), anchor="mm")
                draw.text((cx + card_w // 2, cy + 95), f"{sub1} {sub2}", font=get_font(int(height * 0.02), bold=True), fill=(255, 255, 255, 255), anchor="mm")
        else:
            spacing = (width - (card_w * 3)) // 4
            for i, (val, sub1, sub2, col) in enumerate(stats_data):
                cx = spacing + i * (card_w + spacing)
                cy = int(height * 0.3)
                scard = create_glass_card(card_w, card_h, (30, 41, 59, 230), col + (120,), radius=20)
                img.paste(scard, (cx, cy), scard)

                draw.text((cx + card_w // 2, cy + card_h * 0.35), val, font=get_font(int(height * 0.08), bold=True), fill=col + (255,), anchor="mm")
                draw.text((cx + card_w // 2, cy + card_h * 0.7), sub1, font=get_font(int(height * 0.022), bold=True), fill=(255, 255, 255, 255), anchor="mm")
                draw.text((cx + card_w // 2, cy + card_h * 0.82), sub2, font=get_font(int(height * 0.02), bold=False), fill=(148, 163, 184, 255), anchor="mm")

    else:
        # --- SCENE 6: OUTRO CARD & CALL TO ACTION ---
        caption_text = "Great food. Zero waste. Download FoodSaver Direct Connect!"
        
        logo_w = int(height * 0.22)
        logo_resized = logo_img.resize((logo_w, logo_w), Image.Resampling.LANCZOS)
        lx = (width - logo_w) // 2
        ly = int(height * 0.2)
        img.paste(logo_resized, (lx, ly), logo_resized)

        draw.text((width // 2, ly + logo_w + 40), "FoodSaver Direct Connect", font=font_title, fill=(255, 255, 255, 255), anchor="mm")
        draw.text((width // 2, ly + logo_w + 90), "Great food. Zero waste.", font=font_sub, fill=(16, 185, 129, 255), anchor="mm")

        # CTA Button
        btn_w = int(width * 0.7 if is_portrait else width * 0.35)
        btn_card = create_glass_card(btn_w, 70, (16, 185, 129, 230), (255, 255, 255, 150), radius=35)
        bx = (width - btn_w) // 2
        by = ly + logo_w + 140
        img.paste(btn_card, (bx, by), btn_card)

        draw.text((width // 2, by + 35), "🚀 Download App • Join the Movement", font=font_badge, fill=(255, 255, 255, 255), anchor="mm")

    # Lower Subtitle / Caption Bar Overlay
    if caption_text:
        cap_w = int(width * 0.9)
        cap_card = create_glass_card(cap_w, 54, (15, 23, 42, 230), (16, 185, 129, 100), radius=15)
        cx = (width - cap_w) // 2
        cy = height - int(height * 0.09)
        img.paste(cap_card, (cx, cy), cap_card)

        draw.text((width // 2, cy + 27), caption_text, font=font_caption, fill=(255, 255, 255, 255), anchor="mm")

    return cv2_or_pillow_to_rgb(img)

def cv2_or_pillow_to_rgb(pil_img):
    rgb = pil_img.convert("RGB")
    data = bytes(rgb.tobytes())
    del rgb
    return data

def render_video_variant(resolution, output_filename, total_seconds=10, fps=30):
    import gc
    width, height = resolution
    print(f"[VIDEO] Rendering {output_filename} ({width}x{height}) @ {fps} FPS...")

    # Load Assets
    logo_img = Image.open(LOGO_PATH).convert("RGBA")
    food1_img = Image.open(FOOD_IMG_1).convert("RGBA")
    food2_img = Image.open(FOOD_IMG_2).convert("RGBA")

    total_frames = int(total_seconds * fps)

    # Prepare Pipe to FFmpeg
    raw_video_file = output_filename.replace(".mp4", "_raw.mp4")

    cmd = [
        FFMPEG_EXE,
        "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{width}x{height}",
        "-pix_fmt", "rgb24",
        "-r", str(fps),
        "-i", "-",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "ultrafast",
        "-crf", "20",
        raw_video_file
    ]

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    for i in range(total_frames):
        rgb_bytes = render_frame(i, total_frames, width, height, logo_img, food1_img, food2_img)
        proc.stdin.write(rgb_bytes)

        if i % 50 == 0 or i == total_frames - 1:
            print(f"  Frame {i}/{total_frames} ({int(i/total_frames*100)}%)")
            gc.collect()

    proc.stdin.close()
    proc.wait()

    # Mux Audio
    audio_file = "final_audio.mp3"
    print(f"[AUDIO] Muxing audio track {audio_file} into {output_filename}...")

    mux_cmd = [
        FFMPEG_EXE,
        "-y",
        "-i", raw_video_file,
        "-i", audio_file,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        output_filename
    ]
    subprocess.run(mux_cmd, check=True)

    if os.path.exists(raw_video_file):
        os.remove(raw_video_file)

    print(f"[SUCCESS] Created {output_filename} successfully!")

if __name__ == "__main__":
    # Render Landscape 1920x1080 (16:9)
    render_video_variant((1920, 1080), "foodsaver_intro_16x9.mp4")

    # Render Portrait 1080x1920 (9:16)
    render_video_variant((1080, 1920), "foodsaver_intro_9x16.mp4")

    print("\n[COMPLETE] ALL APP INTRO VIDEOS CREATED SUCCESSFULLY!")
