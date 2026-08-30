---
name: "Tekizog no Koya"
description: "An immersive cherry-blossom threshold leading into a quiet personal reading space."
colors:
  primary: "oklch(0.70 0.14 var(--hue))"
  page-light: "oklch(0.95 0.01 var(--hue))"
  page-dark: "oklch(0.16 0.014 var(--hue))"
  card-light: "#ffffff"
  card-dark: "oklch(0.23 0.015 var(--hue))"
  navigation-glass: "rgba(18, 29, 50, 0.36)"
  quote-glass: "rgba(18, 29, 50, 0.20)"
  glass-text: "rgba(255, 255, 255, 0.96)"
  shadow-strong: "rgba(0, 0, 0, 0.80)"
  shadow-medium: "rgba(0, 0, 0, 0.45)"
  quote-shadow: "rgba(2, 8, 20, 0.18)"
typography:
  body:
    fontFamily: "Roboto, sans-serif"
    fontSize: "14px / 16px from 768px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  title:
    fontFamily: "Roboto, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: "2.75rem"
    letterSpacing: "0"
  home-quote:
    fontFamily: "Roboto, sans-serif"
    fontSize: "clamp(1.15rem, 2.1vw, 1.6rem)"
    fontWeight: 500
    lineHeight: 1.7
    letterSpacing: "0"
  label:
    fontFamily: "Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0"
  icon-sm:
    fontSize: "0.75rem"
  icon-md:
    fontSize: "1.25rem"
  icon-lg:
    fontSize: "1.75rem"
rounded:
  compact: "8px"
  feather: "12px"
  card: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  site-glass-nav:
    backgroundColor: "{colors.navigation-glass}"
    textColor: "{colors.glass-text}"
    rounded: "{rounded.compact}"
    height: "64px"
    padding: "0 16px"
  home-quote:
    backgroundColor: "{colors.quote-glass}"
    textColor: "{colors.glass-text}"
    typography: "{typography.home-quote}"
    rounded: "{rounded.compact}"
    padding: "16px 22px"
  article-card:
    backgroundColor: "{colors.card-light}"
    rounded: "{rounded.card}"
    padding: "24px"
---

# Design System: Tekizog no Koya

## Overview

**Creative North Star: "The Cherry-Glass Threshold"**

The visual system separates atmosphere from reading. The home page is a quiet,
full-screen encounter with the existing cherry-blossom media; one translucent
sentence provides orientation without competing with the scene. The same glass
navigation now anchors every route, while reading content returns to the
established light cards, pink-blue accent system, profile sidebar, and dense
article metadata.

The interface is warm and personal rather than editorially dramatic. The authored
background and navigation persist between routes while reading content changes
with a short crossfade. Controls stay familiar, high contrast, and usable in both
light and dark themes.

**Key Characteristics:**

- Full-bleed authored media on the home route.
- A consistent translucent navigation bar without background blur across all routes.
- A complete translucent rounded quote layer without background blur on the home route.
- Opaque, content-first cards for articles and reading tools.
- Pink-blue accents inherited from the configurable hue system.
- Compact controls with clear iconography and restrained motion.

## Colors

The configurable accent hue supplies personality; neutral surfaces protect long
reading, while dark translucent glass protects white text over moving imagery.

### Primary

- **Petal Accent:** the configurable primary color used for active navigation,
  metadata icons, links, and small emphasis marks.

### Neutral

- **Reading Paper:** the light card and page surfaces used behind article content.
- **Night Reading Surface:** the paired dark theme surfaces.
- **Navigation Glass:** the shared translucent navigation surface without backdrop blur.
- **Quote Surface:** the translucent home-only layer without backdrop blur.
- **Clear White:** home navigation, icons, and quote text over media.

**The Two-Surface Rule.** Navigation may use atmospheric glass everywhere;
article cards, sidebars, archives, and long-form content remain opaque reading surfaces.

## Typography

**Display Font:** Roboto with the system sans-serif fallback.
**Body Font:** Roboto with the system sans-serif fallback.
**Label/Mono Font:** JetBrains Mono Variable is reserved for code.

**Character:** The type system is direct and familiar. Personality comes from
the media, copy, and accent color rather than decorative letterforms.

### Hierarchy

- **Home Quote:** medium weight, fluid but bounded, centered, and limited to one
  short sentence.
- **Article Title:** bold and compact enough to scan quickly in repeated cards.
- **Body:** regular weight with comfortable reading rhythm and responsive base size.
- **Label:** small, medium-weight metadata paired with a real icon.

**The One-Sentence Rule.** The home glass panel contains one literary sentence,
not a heading stack, feature explanation, or call-to-action cluster.

## Layout

The project uses a centered maximum-width shell for navigation and a two-column
desktop reading grid with a 17.5rem sidebar and 1rem gap. At smaller widths the
article content becomes a single column and the sidebar follows the content.

Reading routes begin 0.75rem below the navigation bar. Their vertical start is
tied to the navigation height rather than the viewport-height banner, so article
lists, posts, and sidebars stay close to navigation at every screen size.

The home route is exactly one small viewport high and does not scroll. Navigation
keeps a small safe-area-aware inset from the top. The quote is centered in the
viewport with horizontal breathing room and a bounded 38rem maximum width.

Navigation and background media live outside the route-replacement shell. Swup
replaces one consistent page container across home, lists, and posts, preserving
video playback and avoiding full-document refreshes.

## Elevation & Depth

Reading cards rely mainly on tonal separation. Navigation uses a translucent
dark tint, a light edge, and soft depth without background blur. The home quote
uses a translucent deep surface without blur. Text and icons
receive local dark shadows so bright petals or sky cannot erase their edges.

### Shadow Vocabulary

- **Glass Lift:** a broad, low-opacity shadow below navigation and quote surfaces.
- **Media Text Protection:** a tight offset shadow plus a diffuse dark shadow on
  white text and a small drop shadow on icons.

**The Protected Transparency Rule.** Transparency may reveal the background, but
never at the cost of readable labels, placeholders, or icons.

## Shapes

Glass surfaces use gently compact corners. Reading cards use the established
larger radius. Icon buttons stay square with the compact radius; pills are kept
for small metadata or filter controls only.

## Components

### Buttons

- **Shape:** compact square or short rectangular controls.
- **Hover / Focus:** a translucent or tonal fill with a short transition and a
  visible keyboard focus state.
- **Icons:** use the existing Astro/Iconify library and consistent symbol weight.

### Cards / Containers

- **Article cards:** opaque reading surfaces with the large project radius,
  strong titles, compact metadata, and a clearly separated enter control.
- **Home quote:** a compact translucent note with a subtle light edge and no backdrop blur; it is not a reusable content card.

### Inputs / Fields

- **Search:** transparent inside home navigation with protected white placeholder
  text on every route.
- **Focus:** background contrast increases without changing the field dimensions.

### Navigation

Desktop navigation exposes Home, Articles, Archive, About, and GitHub directly.
Mobile preserves the brand and essential icon controls while placing text routes
in the menu. Every route uses the same dark glass navigation. Current routes
receive a quiet tonal highlight and `aria-current`.

### Home Quote

The signature component combines one line of Chinese copy, a very light dark
veil, restrained blur, and soft depth. It is visible in its final state on hard
loads and participates only in the shared route crossfade.

## Do's and Don'ts

### Do:

- **Do** keep the animated background as the dominant home-page signal.
- **Do** use local shadow protection when white text crosses bright media.
- **Do** preserve the existing article cards, sidebar, metadata, and responsive order.
- **Do** force a complete navigation load when crossing between incompatible page shells.

### Don't:

- **Don't** place article lists, profile panels, or explanatory blocks on the home route.
- **Don't** turn glass into an opaque slab or use it for reading-content containers.
- **Don't** add multiple quotes, buttons, or decorative layers over the background.
- **Don't** hide Articles on desktop or make it unreachable from the mobile menu.
